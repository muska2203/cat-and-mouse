import { generateMazeRun } from "./maze.js?v=0.4.3-pre-alpha";
import { getLootPool } from "./loadout.js?v=0.4.3-pre-alpha";
import { getItemById } from "./loadout.js?v=0.4.3-pre-alpha";
import { addLootItemToPlayer } from "./loadout.js?v=0.4.3-pre-alpha";
import { PROGRESSION_CONFIG } from "./state.js?v=0.4.3-pre-alpha";
import { getSkillById } from "./skills.js?v=0.4.3-pre-alpha";

function inBounds(x, y, run) {
  return x >= 0 && y >= 0 && x < run.width && y < run.height;
}

const DIRS_8 = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
];

const ACTOR_KIND = {
  PLAYER: "player",
  ENEMY: "enemy",
};

function isObjectBlockingForActor(object, actorKind) {
  if (!object) {
    return false;
  }
  if (actorKind === ACTOR_KIND.ENEMY) {
    if (object.type === "enemy") {
      return true;
    }
    return object.blocksEnemyMovement === true;
  }
  if (actorKind === ACTOR_KIND.PLAYER) {
    if (object.type === "enemy") {
      return true;
    }
    return object.blocksMovement !== false;
  }
  return object.blocksMovement !== false;
}

function isWall(x, y, run) {
  return run.grid[y][x] === 1;
}

function createMask(width, height, value = false) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function weightedPick(weightedEntries) {
  const total = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return weightedEntries[0]?.value ?? null;
  }
  const roll = Math.random() * total;
  let acc = 0;
  for (const entry of weightedEntries) {
    acc += entry.weight;
    if (roll <= acc) {
      return entry.value;
    }
  }
  return weightedEntries[weightedEntries.length - 1]?.value ?? null;
}

function getChestSpawnWeights(level) {
  const levelShift = Math.max(0, level - 1);
  const unique = Math.min(0.35, 0.1 + levelShift * 0.015);
  const rare = Math.max(0.15, 0.3 - levelShift * 0.0075);
  const common = Math.max(0.05, 1 - unique - rare);
  return { common, rare, unique };
}

function getChestCountsForLevel(level) {
  const totalChests = randomInt(5, 8);
  const weights = getChestSpawnWeights(level);
  const counts = { chest_common: 0, chest_rare: 0, chest_unique: 0 };
  for (let i = 0; i < totalChests; i += 1) {
    const picked = weightedPick([
      { value: "chest_common", weight: weights.common },
      { value: "chest_rare", weight: weights.rare },
      { value: "chest_unique", weight: weights.unique },
    ]);
    counts[picked] += 1;
  }
  return counts;
}

function rollLootPoolByChestRarity(chestRarity) {
  const tables = {
    common: [
      { value: "common", weight: 90 },
      { value: "rare", weight: 9 },
      { value: "unique", weight: 1 },
    ],
    rare: [
      { value: "common", weight: 80 },
      { value: "rare", weight: 18 },
      { value: "unique", weight: 2 },
    ],
    unique: [
      { value: "common", weight: 50 },
      { value: "rare", weight: 30 },
      { value: "unique", weight: 20 },
    ],
  };
  return weightedPick(tables[chestRarity] || tables.common);
}

function getLootCountFromChest(chestRarity) {
  const ranges = {
    common: { min: 1, max: 2 },
    rare: { min: 2, max: 3 },
    unique: { min: 3, max: 4 },
  };
  const range = ranges[chestRarity] || ranges.common;
  return randomInt(range.min, range.max);
}

function isManaSustainItem(item) {
  const manaItemIds = new Set([
    "common_mint_drop",
    "common_warm_milk",
    "cheese_ration",
    "rare_focus_tonic",
    "rare_dual_elixir",
    "rare_royal_cheese",
    "unique_aether_draught",
    "unique_twilight_mix",
  ]);
  return Boolean(item?.id && manaItemIds.has(item.id));
}

function getLootFromChest(chestRarity, classId, excludedItemIds = new Set()) {
  const rolledPool = rollLootPoolByChestRarity(chestRarity);
  const fallbackPools = {
    common: ["common", "rare", "unique"],
    rare: ["rare", "common", "unique"],
    unique: ["unique", "rare", "common"],
  };
  const poolOrder = [rolledPool, ...(fallbackPools[chestRarity] || fallbackPools.common)]
    .filter((poolName, index, list) => list.indexOf(poolName) === index);
  for (const poolName of poolOrder) {
    const pool = getLootPool(poolName, classId).filter((item) => !excludedItemIds.has(item.id));
    if (pool.length > 0) {
      const manaWeightedChance = {
        common: 0.38,
        rare: 0.5,
        unique: 0.62,
      };
      const manaCandidates = pool.filter((item) => isManaSustainItem(item));
      const manaChance = manaWeightedChance[chestRarity] ?? manaWeightedChance.common;
      if (manaCandidates.length > 0 && Math.random() < manaChance) {
        return randomPick(manaCandidates);
      }
      return randomPick(pool);
    }
  }
  return null;
}

function collectChestDropCells(run, x, y) {
  const cells = [];
  for (const dir of DIRS_8) {
    const nx = x + dir.x;
    const ny = y + dir.y;
    if (!inBounds(nx, ny, run) || isWall(nx, ny, run)) continue;
    const occupied = getObjectsAt(run, nx, ny);
    const hasEnemy = occupied.some((object) => object.type === "enemy");
    if (hasEnemy) continue;
    cells.push({ x: nx, y: ny });
  }
  return cells;
}

function spawnGroundLootObjects(run, lootItems, sourceX, sourceY, sourceName) {
  const candidateCells = collectChestDropCells(run, sourceX, sourceY);
  let ord = 0;
  const dropMotions = [];
  for (const item of lootItems) {
    if (!item?.id) continue;
    const targetCell = candidateCells.shift() || { x: sourceX, y: sourceY };
    const lootObject = {
      id: `ground_loot_${Date.now()}_${targetCell.x}_${targetCell.y}_${ord}_${Math.floor(Math.random() * 10000)}`,
      name: `Лут: ${item.name}`,
      type: "ground_loot",
      purpose: "ground_loot",
      icon: "📦",
      oneTime: true,
      blocksMovement: false,
      blocksEnemyMovement: false,
      activation: { by: [ACTOR_KIND.PLAYER], effect: "pickup_loot" },
      x: targetCell.x,
      y: targetCell.y,
      data: {
        itemId: item.id,
        itemName: item.name,
        itemIcon: item.icon || "📦",
        sourceName,
      },
    };
    run.objects.push(lootObject);
    if (targetCell.x !== sourceX || targetCell.y !== sourceY) {
      dropMotions.push({
        actorId: lootObject.id,
        kind: "move",
        from: { x: sourceX, y: sourceY },
        to: { x: targetCell.x, y: targetCell.y },
      });
    }
    ord += 1;
  }
  if (dropMotions.length > 0) {
    run.environmentMotion = {
      kind: "object-move-batch",
      actors: dropMotions,
      durationMs: 220,
      startMs: null,
    };
  }
}

function rollChestLootItems(chestRarity, classId) {
  const lootCount = getLootCountFromChest(chestRarity);
  const picks = [];
  const excluded = new Set();
  for (let i = 0; i < lootCount; i += 1) {
    const item = getLootFromChest(chestRarity, classId, excluded);
    if (!item) continue;
    picks.push(item);
    excluded.add(item.id);
  }
  return picks;
}

function weightedEnemyType(level) {
  const t = Math.max(0, Math.min(1, (level - 1) / 9));
  const pSmall = 0.62 - t * 0.47;
  const pMid = 0.28 + t * 0.15;
  const roll = Math.random();
  if (roll < pSmall) return "cat_small";
  if (roll < pSmall + pMid) return "cat_mid";
  return "cat_big";
}

function getEnemyCountsForLevel(level, walkableCells = 120) {
  const mapScaleFactor = Math.max(1, walkableCells / 120);
  const total = randomInt(6, 10) + Math.floor((mapScaleFactor - 1) * 5);
  const counts = { cat_small: 0, cat_mid: 0, cat_big: 0 };
  for (let i = 0; i < total; i += 1) {
    counts[weightedEnemyType(level)] += 1;
  }
  return counts;
}

function buildDistanceMapFromCell(maze, start) {
  const distances = createMask(maze.width, maze.height, -1);
  const queue = [{ x: start.x, y: start.y }];
  distances[start.y][start.x] = 0;
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  while (queue.length > 0) {
    const current = queue.shift();
    const base = distances[current.y][current.x];
    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) continue;
      if (maze.grid[ny][nx] === 1) continue;
      if (distances[ny][nx] !== -1) continue;
      distances[ny][nx] = base + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return distances;
}

function getWalkableCellsInRoom(maze, room) {
  const cells = [];
  const maxY = Math.min(maze.height - 1, room.y + room.h - 1);
  const maxX = Math.min(maze.width - 1, room.x + room.w - 1);
  for (let y = Math.max(0, room.y); y <= maxY; y += 1) {
    for (let x = Math.max(0, room.x); x <= maxX; x += 1) {
      if (maze.grid[y][x] === 0) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function isEdgeRoom(maze, room) {
  return (
    room.x <= 1 ||
    room.y <= 1 ||
    room.x + room.w >= maze.width - 1 ||
    room.y + room.h >= maze.height - 1
  );
}

function planStartAndGoalSpawn(maze) {
  const rooms = Array.isArray(maze.rooms) ? maze.rooms : [];
  const roomCandidates = rooms
    .map((room, index) => ({ room, index, cells: getWalkableCellsInRoom(maze, room) }))
    .filter((entry) => entry.cells.length > 0);

  if (roomCandidates.length === 0) {
    return {
      start: maze.start,
      goal: maze.goal,
      playerRoomIndex: -1,
      blockedSpawnKeys: new Set(),
    };
  }

  const edgeCandidates = roomCandidates.filter((entry) => isEdgeRoom(maze, entry.room));
  const startRoomEntry = randomPick(edgeCandidates.length > 0 ? edgeCandidates : roomCandidates);
  const start = randomPick(startRoomEntry.cells);
  const blockedSpawnKeys = new Set(startRoomEntry.cells.map((cell) => `${cell.x}:${cell.y}`));

  const distances = buildDistanceMapFromCell(maze, start);
  const targetRoomCandidates = roomCandidates.filter((entry) => entry.index !== startRoomEntry.index);
  let chosenGoalCell = null;
  let chosenDistance = -1;

  for (const entry of targetRoomCandidates) {
    const reachableCells = entry.cells
      .map((cell) => ({ ...cell, d: distances[cell.y][cell.x] }))
      .filter((cell) => cell.d >= 0);
    if (reachableCells.length === 0) {
      continue;
    }
    reachableCells.sort((a, b) => b.d - a.d);
    const bestDistance = reachableCells[0].d;
    if (bestDistance < chosenDistance) {
      continue;
    }
    const farthestGroup = reachableCells.filter((cell) => cell.d === bestDistance);
    const picked = randomPick(farthestGroup);
    if (bestDistance > chosenDistance || Math.random() < 0.5) {
      chosenDistance = bestDistance;
      chosenGoalCell = { x: picked.x, y: picked.y };
    }
  }

  if (!chosenGoalCell) {
    const fallbackCells = [];
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const d = distances[y][x];
        if (d < 0 || (x === start.x && y === start.y)) continue;
        fallbackCells.push({ x, y, d });
      }
    }
    if (fallbackCells.length > 0) {
      fallbackCells.sort((a, b) => b.d - a.d);
      const maxD = fallbackCells[0].d;
      const farthest = fallbackCells.filter((cell) => cell.d === maxD);
      const picked = randomPick(farthest);
      chosenGoalCell = { x: picked.x, y: picked.y };
    } else {
      chosenGoalCell = maze.goal;
    }
  }

  return {
    start,
    goal: chosenGoalCell,
    playerRoomIndex: startRoomEntry.index,
    blockedSpawnKeys,
  };
}

function generateObjects(maze, level = 1, options = {}) {
  const freeCells = [];
  const reserved = new Set();
  const rooms = Array.isArray(maze.rooms) ? maze.rooms : [];
  const roomIndexByCellKey = new Map();
  const blockedSpawnKeys = options.blockedSpawnKeys instanceof Set
    ? options.blockedSpawnKeys
    : new Set(options.blockedSpawnKeys || []);

  const objectTemplates = {
    cat_small: {
      id: "cat_small",
      name: "Котенок",
      type: "enemy",
      purpose: "enemy",
      icon: "🐱",
      oneTime: false,
      blocksMovement: true,
      activation: { by: [], effect: null },
      data: { hp: 18, damage: 2 },
    },
    cat_mid: {
      id: "cat_mid",
      name: "Домашний кот",
      type: "enemy",
      purpose: "enemy",
      icon: "🐈",
      oneTime: false,
      blocksMovement: true,
      activation: { by: [], effect: null },
      data: { hp: 27, damage: 5 },
    },
    cat_big: {
      id: "cat_big",
      name: "Дворовый кот",
      type: "enemy",
      purpose: "enemy",
      icon: "😾",
      oneTime: false,
      blocksMovement: true,
      activation: { by: [], effect: null },
      data: { hp: 38, damage: 7 },
    },
    chest_common: {
      id: "chest_common",
      name: "Обычный сундук",
      type: "chest",
      purpose: "chest",
      icon: "📦",
      oneTime: true,
      blocksMovement: true,
      blocksEnemyMovement: false,
      activation: { by: [ACTOR_KIND.PLAYER], effect: "open_chest" },
      data: { chestRarity: "common" },
    },
    chest_rare: {
      id: "chest_rare",
      name: "Редкий сундук",
      type: "chest",
      purpose: "chest",
      icon: "🎁",
      oneTime: true,
      blocksMovement: true,
      blocksEnemyMovement: false,
      activation: { by: [ACTOR_KIND.PLAYER], effect: "open_chest" },
      data: { chestRarity: "rare" },
    },
    chest_unique: {
      id: "chest_unique",
      name: "Уникальный сундук",
      type: "chest",
      purpose: "chest",
      icon: "👑",
      oneTime: true,
      blocksMovement: true,
      blocksEnemyMovement: false,
      activation: { by: [ACTOR_KIND.PLAYER], effect: "open_chest" },
      data: { chestRarity: "unique" },
    },
  };

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (maze.grid[y][x] === 1) continue;
      if (x === maze.start.x && y === maze.start.y) continue;
      if (x === maze.goal.x && y === maze.goal.y) continue;
      if (blockedSpawnKeys.has(`${x}:${y}`)) continue;
      freeCells.push({ x, y });
    }
  }

  const roomCellKeySet = new Set();
  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
    const room = rooms[roomIndex];
    const maxY = Math.min(maze.height - 1, room.y + room.h - 1);
    const maxX = Math.min(maze.width - 1, room.x + room.w - 1);
    for (let y = Math.max(0, room.y); y <= maxY; y += 1) {
      for (let x = Math.max(0, room.x); x <= maxX; x += 1) {
        if (maze.grid[y][x] === 1) continue;
        if (x === maze.start.x && y === maze.start.y) continue;
        if (x === maze.goal.x && y === maze.goal.y) continue;
        if (blockedSpawnKeys.has(`${x}:${y}`)) continue;
        const key = `${x}:${y}`;
        roomCellKeySet.add(key);
        roomIndexByCellKey.set(key, roomIndex);
      }
    }
  }

  const walkableCells = freeCells.length;
  const enemyCounts = getEnemyCountsForLevel(level, walkableCells);
  const chestCounts = getChestCountsForLevel(level);
  const extraChests = Math.max(0, Math.floor((walkableCells - 120) / 45));
  const byTypeCount = {
    cat_small: enemyCounts.cat_small,
    cat_mid: enemyCounts.cat_mid,
    cat_big: enemyCounts.cat_big,
    chest_common: chestCounts.chest_common + extraChests,
    chest_rare: chestCounts.chest_rare + Math.floor(extraChests / 2),
    chest_unique: chestCounts.chest_unique + (extraChests >= 3 ? 1 : 0),
  };

  for (let i = freeCells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = freeCells[i];
    freeCells[i] = freeCells[j];
    freeCells[j] = tmp;
  }

  function keyOf(x, y) {
    return `${x}:${y}`;
  }

  function neighbors4(x, y) {
    const result = [];
    for (const dir of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) continue;
      if (maze.grid[ny][nx] === 1) continue;
      if (nx === maze.start.x && ny === maze.start.y) continue;
      if (nx === maze.goal.x && ny === maze.goal.y) continue;
      if (blockedSpawnKeys.has(`${nx}:${ny}`)) continue;
      result.push({ x: nx, y: ny });
    }
    return result;
  }

  const deadEnds = freeCells.filter((cell) => neighbors4(cell.x, cell.y).length === 1);
  const nonDeadEnds = freeCells.filter((cell) => neighbors4(cell.x, cell.y).length !== 1);
  const roomCells = freeCells.filter((cell) => roomCellKeySet.has(keyOf(cell.x, cell.y)));
  const corridorCells = freeCells.filter((cell) => !roomCellKeySet.has(keyOf(cell.x, cell.y)));
  const roomDeadEnds = deadEnds.filter((cell) => roomCellKeySet.has(keyOf(cell.x, cell.y)));
  const corridorDeadEnds = deadEnds.filter((cell) => !roomCellKeySet.has(keyOf(cell.x, cell.y)));
  const spawnableCellKeySet = new Set(freeCells.map((cell) => keyOf(cell.x, cell.y)));

  function takeCellFrom(pool) {
    while (pool.length > 0) {
      const cell = pool.pop();
      if (!reserved.has(keyOf(cell.x, cell.y))) return cell;
    }
    return null;
  }

  const roomBuckets = rooms.map((_, roomIndex) => ({
    roomIndex,
    deadEnds: [],
    regular: [],
  }));
  for (const cell of freeCells) {
    const roomIndex = roomIndexByCellKey.get(keyOf(cell.x, cell.y));
    if (!Number.isInteger(roomIndex)) continue;
    const bucket = roomBuckets[roomIndex];
    if (!bucket) continue;
    const isDeadEnd = neighbors4(cell.x, cell.y).length === 1;
    if (isDeadEnd) {
      bucket.deadEnds.push(cell);
    } else {
      bucket.regular.push(cell);
    }
  }
  for (const bucket of roomBuckets) {
    for (let i = bucket.deadEnds.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = bucket.deadEnds[i];
      bucket.deadEnds[i] = bucket.deadEnds[j];
      bucket.deadEnds[j] = tmp;
    }
    for (let i = bucket.regular.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = bucket.regular[i];
      bucket.regular[i] = bucket.regular[j];
      bucket.regular[j] = tmp;
    }
  }
  let roomBucketCursor = 0;
  function takeCellFromRoomsRoundRobin(kind = "regular") {
    if (roomBuckets.length === 0) {
      return null;
    }
    const targetKind = kind === "deadEnds" ? "deadEnds" : "regular";
    for (let attempt = 0; attempt < roomBuckets.length; attempt += 1) {
      const bucket = roomBuckets[roomBucketCursor % roomBuckets.length];
      roomBucketCursor += 1;
      const pool = bucket[targetKind];
      while (pool.length > 0) {
        const cell = pool.pop();
        if (!reserved.has(keyOf(cell.x, cell.y))) return cell;
      }
    }
    return null;
  }

  function placeObject(list, template, cell, ordinal) {
    reserved.add(keyOf(cell.x, cell.y));
    list.push({
      id: `${template.id}_${ordinal}_${cell.x}_${cell.y}`,
      name: template.name,
      type: template.type,
      purpose: template.purpose || template.type,
      icon: template.icon,
      oneTime: template.oneTime,
      blocksMovement: template.blocksMovement !== false,
      blocksEnemyMovement: template.blocksEnemyMovement === true,
      activation: template.activation
        ? {
            by: Array.isArray(template.activation.by) ? [...template.activation.by] : [],
            effect: template.activation.effect || null,
          }
        : { by: [], effect: null },
      x: cell.x,
      y: cell.y,
      data: { ...template.data },
    });
  }

  const chestPlacementPlan = [
    { key: "chest_unique", fromDeadEnd: true },
    { key: "chest_rare", fromDeadEnd: true },
    { key: "chest_common", fromDeadEnd: true },
  ];
  const objects = [];

  // 1) Сначала ставим сундуки, в приоритете в тупики.
  for (const plan of chestPlacementPlan) {
    const template = objectTemplates[plan.key];
    const count = byTypeCount[plan.key];
    for (let i = 0; i < count; i += 1) {
      let cell = null;
      if (plan.fromDeadEnd) {
        cell = takeCellFromRoomsRoundRobin("deadEnds") || takeCellFrom(roomDeadEnds);
      }
      if (!cell) {
        cell = takeCellFromRoomsRoundRobin("regular") || takeCellFrom(roomCells);
      }
      if (!cell) break;
      placeObject(objects, template, cell, i);
    }
  }

  // 2) Затем выставляем охрану рядом с сундуками.
  const enemyQueue = [];
  for (let i = 0; i < byTypeCount.cat_big; i += 1) enemyQueue.push("cat_big");
  for (let i = 0; i < byTypeCount.cat_mid; i += 1) enemyQueue.push("cat_mid");
  for (let i = 0; i < byTypeCount.cat_small; i += 1) enemyQueue.push("cat_small");

  let enemyOrdinal = 0;
  for (const chest of objects.filter((object) => object.type === "chest")) {
    if (enemyQueue.length === 0) break;
    const guardCell = neighbors4(chest.x, chest.y).find(
      (cell) => spawnableCellKeySet.has(keyOf(cell.x, cell.y)) && !reserved.has(keyOf(cell.x, cell.y))
    );
    if (!guardCell) continue;
    const enemyKey = enemyQueue.shift();
    const enemyTemplate = objectTemplates[enemyKey];
    placeObject(objects, enemyTemplate, guardCell, enemyOrdinal);
    enemyOrdinal += 1;
  }

  // 3) Остальных котов досыпаем случайно.
  while (enemyQueue.length > 0) {
    const cell = takeCellFromRoomsRoundRobin("regular")
      || takeCellFrom(roomCells)
      || takeCellFrom(nonDeadEnds)
      || takeCellFrom(corridorCells)
      || takeCellFrom(deadEnds);
    if (!cell) break;
    const enemyKey = enemyQueue.shift();
    const enemyTemplate = objectTemplates[enemyKey];
    placeObject(objects, enemyTemplate, cell, enemyOrdinal);
    enemyOrdinal += 1;
  }

  return objects;
}

function getObjectsAt(run, x, y) {
  return (run.objects || []).filter((object) => object.x === x && object.y === y);
}

function getObjectAt(run, x, y) {
  return getObjectsAt(run, x, y)[0] || null;
}

function getBlockingObjectAt(run, x, y, actorKind, ignoreObjectId = null) {
  const objects = getObjectsAt(run, x, y);
  if (actorKind === ACTOR_KIND.PLAYER) {
    const enemyFirst = objects.find((object) => {
      if (ignoreObjectId && object.id === ignoreObjectId) return false;
      return object.type === "enemy";
    });
    if (enemyFirst) {
      return enemyFirst;
    }
  }
  return objects.find((object) => {
    if (ignoreObjectId && object.id === ignoreObjectId) return false;
    return isObjectBlockingForActor(object, actorKind);
  }) || null;
}

function canObjectBeActivatedBy(object, actorKind) {
  const allowed = object?.activation?.by;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return false;
  }
  return allowed.includes(actorKind) || allowed.includes("any");
}

function ensureEnemyStatus(enemy) {
  if (!enemy?.data) return { stunTurns: 0, poisonTurns: 0, poisonDamage: 0 };
  if (!enemy.data.status) {
    enemy.data.status = { stunTurns: 0, poisonTurns: 0, poisonDamage: 0 };
  }
  return enemy.data.status;
}

function ensurePlayerStatus(run) {
  if (!run.playerStatus) {
    run.playerStatus = {
      stunTurns: 0,
    };
  }
  return run.playerStatus;
}

function applyTrapEffectToEnemy(run, enemy, trapConfig) {
  if (!enemy) return "";
  const status = ensureEnemyStatus(enemy);
  const parts = [];
  const damage = Math.max(0, trapConfig?.damage || 0);
  if (damage > 0) {
    enemy.data.hp = Math.max(0, (enemy.data?.hp || 0) - damage);
    run.floatingTexts.push({
      x: enemy.x,
      y: enemy.y,
      value: `-${damage}`,
      color: "#fca5a5",
      durationMs: 620,
      scale: 1.05,
      startMs: null,
    });
    parts.push(`получает ${damage} урона`);
  }
  const stunTurns = Math.max(0, trapConfig?.stunTurns || 0);
  if (stunTurns > 0) {
    status.stunTurns = Math.max(status.stunTurns || 0, stunTurns);
    parts.push(`оглушен на ${stunTurns} ход`);
  }
  const poisonTurns = Math.max(0, trapConfig?.poisonTurns || 0);
  const poisonDamage = Math.max(0, trapConfig?.poisonDamage || 0);
  if (poisonTurns > 0 && poisonDamage > 0) {
    status.poisonTurns = Math.max(status.poisonTurns || 0, poisonTurns);
    status.poisonDamage = Math.max(status.poisonDamage || 0, poisonDamage);
    parts.push(`отравлен (${poisonDamage} x ${poisonTurns})`);
  }
  return parts.join(", ");
}

function applyTrapEffectToPlayer(run, playerSheet, trapConfig) {
  const parts = [];
  const damage = Math.max(0, trapConfig?.damage || 0);
  if (damage > 0) {
    const hpNow = playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0;
    const nextHp = Math.max(0, hpNow - damage);
    playerSheet.stats.HP = nextHp;
    playerSheet.baseStats.HP = nextHp;
    run.floatingTexts.push({
      x: run.player.x,
      y: run.player.y,
      value: `-${damage}`,
      color: "#fda4af",
      durationMs: 620,
      scale: 1.05,
      startMs: null,
    });
    parts.push(`получает ${damage} урона`);
  }
  const poisonTurns = Math.max(0, trapConfig?.poisonTurns || 0);
  const poisonDamage = Math.max(0, trapConfig?.poisonDamage || 0);
  if (poisonTurns > 0 && poisonDamage > 0) {
    run.overTimeEffects = [...(run.overTimeEffects || []), {
      type: "poison_player",
      turnsLeft: poisonTurns,
      poisonDamage,
    }];
    parts.push(`отравлен (${poisonDamage} x ${poisonTurns})`);
  }
  const stunTurns = Math.max(0, trapConfig?.stunTurns || 0);
  if (stunTurns > 0) {
    const playerStatus = ensurePlayerStatus(run);
    playerStatus.stunTurns = Math.max(playerStatus.stunTurns || 0, stunTurns);
    parts.push(`оглушен на ${stunTurns} ход`);
  }
  return parts.join(", ");
}

function spawnPoisonCloudObjects(run, centerX, centerY, sourceName, trapConfig) {
  const durationTurns = Math.max(1, trapConfig?.cloudDurationTurns || 2);
  const cloudDamage = Math.max(0, trapConfig?.cloudDamage || 0);
  const cloudPoisonTurns = Math.max(0, trapConfig?.cloudPoisonTurns || 0);
  const cloudPoisonDamage = Math.max(0, trapConfig?.cloudPoisonDamage || 0);
  const cells = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (!inBounds(x, y, run) || isWall(x, y, run)) {
        continue;
      }
      cells.push({ x, y });
    }
  }
  for (const cell of cells) {
    run.objects.push({
      id: `poison_cloud_${Date.now()}_${cell.x}_${cell.y}_${Math.floor(Math.random() * 10000)}`,
      name: "Ядовитый туман",
      type: "trap_cloud",
      purpose: "trap_cloud",
      icon: "☠",
      oneTime: false,
      blocksMovement: false,
      blocksEnemyMovement: false,
      activation: { by: ["player", "enemy"], effect: "trigger_poison_cloud" },
      x: cell.x,
      y: cell.y,
      data: {
        sourceName,
        durationTurns,
        trapConfig: {
          damage: cloudDamage,
          poisonTurns: cloudPoisonTurns,
          poisonDamage: cloudPoisonDamage,
        },
      },
    });
  }
}

function tickTemporaryObjects(run) {
  const objects = run.objects || [];
  const alive = [];
  for (const object of objects) {
    if (object.type !== "trap_cloud") {
      alive.push(object);
      continue;
    }
    const turnsLeft = Math.max(0, (object.data?.durationTurns || 0) - 1);
    if (turnsLeft > 0) {
      object.data.durationTurns = turnsLeft;
      alive.push(object);
    }
  }
  run.objects = alive;
}

function applyObjectActivationOnCell(run, playerSheet, actorKind, x, y, actorEntity = null) {
  const objects = getObjectsAt(run, x, y);
  const logs = [];
  let nextPlayerSheet = playerSheet;
  for (const object of objects) {
    if (!canObjectBeActivatedBy(object, actorKind)) {
      continue;
    }
    if (object.activation?.effect === "open_chest" && actorKind === ACTOR_KIND.PLAYER) {
      removeObject(run, object.id);
      const chestRarity = object?.data?.chestRarity || "common";
      const lootItems = rollChestLootItems(chestRarity, nextPlayerSheet.classId);
      if (lootItems.length > 0) {
        spawnGroundLootObjects(run, lootItems, x, y, object.name);
        logs.push(`${object.name}: лут высыпан рядом (${lootItems.length}).`);
      } else {
        logs.push(`${object.name} оказался пустым.`);
      }
    }
    if (object.activation?.effect === "pickup_loot" && actorKind === ACTOR_KIND.PLAYER) {
      const itemId = object?.data?.itemId || null;
      const item = itemId ? getItemById(itemId) : null;
      if (!item) {
        removeObject(run, object.id);
        logs.push("Предмет испорчен и исчез.");
      } else {
        const lootResult = addLootItemToPlayer(nextPlayerSheet, item.id);
        nextPlayerSheet = lootResult.playerSheet;
        removeObject(run, object.id);
        if (lootResult.addedTo === "equip") {
          logs.push(`Подобрано: ${item.name}. Автоэкипировка.`);
        } else if (lootResult.addedTo === "bag") {
          logs.push(`Подобрано: ${item.name}. В сумке.`);
        } else {
          logs.push(`Подобрано: ${item.name}.`);
        }
      }
    }
    if (object.activation?.effect === "trigger_trap" && object.type === "trap") {
      const trapConfig = object?.data?.trapConfig || {};
      let effectLog = "";
      if (actorKind === ACTOR_KIND.ENEMY) {
        effectLog = applyTrapEffectToEnemy(run, actorEntity, trapConfig);
      } else if (actorKind === ACTOR_KIND.PLAYER) {
        effectLog = applyTrapEffectToPlayer(run, playerSheet, trapConfig);
      }
      if (trapConfig?.spawnPoisonCloud) {
        spawnPoisonCloudObjects(run, object.x, object.y, object.name, trapConfig);
      }
      removeObject(run, object.id);
      const triggerLog = effectLog ? `${object.name}: ${effectLog}.` : `${object.name}: сработала.`;
      logs.push(triggerLog);
    }
    if (object.activation?.effect === "trigger_poison_cloud" && object.type === "trap_cloud") {
      const cloudConfig = object?.data?.trapConfig || {};
      let effectLog = "";
      if (actorKind === ACTOR_KIND.ENEMY) {
        effectLog = applyTrapEffectToEnemy(run, actorEntity, cloudConfig);
      } else if (actorKind === ACTOR_KIND.PLAYER) {
        effectLog = applyTrapEffectToPlayer(run, playerSheet, cloudConfig);
      }
      if (effectLog) {
        logs.push(`${object.name}: ${effectLog}.`);
      }
    }
  }
  if (actorKind === ACTOR_KIND.PLAYER && run.player.x === run.goal.x && run.player.y === run.goal.y) {
    if ((run.level || 1) >= (run.maxLevel || 10)) {
      run.status = "victory";
    } else {
      run.status = "level_complete";
      run.levelTransition = {
        phase: "out",
        startedMs: null,
        durationMs: 420,
        nextLevel: (run.level || 1) + 1,
      };
      logs.push(`Уровень ${run.level} пройден. Переход на ${run.level + 1}...`);
    }
  }
  return { log: logs.join(" "), playerSheet: nextPlayerSheet };
}

function removeObject(run, objectId) {
  run.objects = run.objects.filter((object) => object.id !== objectId);
}

function getEnemyById(run, enemyId) {
  return run.objects.find((object) => object.id === enemyId && object.type === "enemy") || null;
}

function isDiagonalCutBlocked(run, fromX, fromY, toX, toY) {
  // По текущим правилам всем сущностям разрешен "срез угла" при диагональном ходе.
  return false;
}

function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function defaultCellBlocked(run, x, y, options = {}) {
  if (!inBounds(x, y, run) || isWall(x, y, run)) {
    return true;
  }
  if (options.allowGoal !== true && run.goal?.x === x && run.goal?.y === y) {
    return true;
  }
  if (options.allowPlayer !== true && run.player?.x === x && run.player?.y === y) {
    return true;
  }
  if (options.blockObjects !== false) {
    const blocker = getBlockingObjectAt(run, x, y, ACTOR_KIND.PLAYER, options.ignoreObjectId);
    if (blocker) {
      return true;
    }
  }
  return false;
}

export function buildPathToCell(run, start, target, options = {}) {
  if (!run || !start || !target) {
    return [];
  }
  if (!inBounds(start.x, start.y, run) || !inBounds(target.x, target.y, run)) {
    return [];
  }
  const blockCell = options.isCellBlocked || ((x, y) => defaultCellBlocked(run, x, y, options));
  const open = [{ x: start.x, y: start.y }];
  const cameFrom = new Map();
  const gScore = new Map([[`${start.x}:${start.y}`, 0]]);
  const fScore = new Map([[`${start.x}:${start.y}`, chebyshevDistance(start, target)]]);

  while (open.length > 0) {
    open.sort((a, b) => (fScore.get(`${a.x}:${a.y}`) ?? Infinity) - (fScore.get(`${b.x}:${b.y}`) ?? Infinity));
    const current = open.shift();
    const currentKey = `${current.x}:${current.y}`;
    if (current.x === target.x && current.y === target.y) {
      const path = [{ x: current.x, y: current.y }];
      let key = currentKey;
      while (cameFrom.has(key)) {
        const prev = cameFrom.get(key);
        path.push({ x: prev.x, y: prev.y });
        key = `${prev.x}:${prev.y}`;
      }
      path.reverse();
      return path;
    }

    for (const dir of DIRS_8) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!inBounds(nx, ny, run)) continue;
      if (nx === target.x && ny === target.y) {
        // allow target explicitly
      } else if (blockCell(nx, ny)) {
        continue;
      }
      if (isDiagonalCutBlocked(run, current.x, current.y, nx, ny)) {
        continue;
      }

      const tentative = (gScore.get(currentKey) ?? Infinity) + (dir.x !== 0 && dir.y !== 0 ? 1.4142 : 1);
      const nKey = `${nx}:${ny}`;
      if (tentative >= (gScore.get(nKey) ?? Infinity)) {
        continue;
      }
      cameFrom.set(nKey, { x: current.x, y: current.y });
      gScore.set(nKey, tentative);
      fScore.set(nKey, tentative + chebyshevDistance({ x: nx, y: ny }, target));
      if (!open.some((n) => n.x === nx && n.y === ny)) {
        open.push({ x: nx, y: ny });
      }
    }
  }
  return [];
}

function buildPathTowardTarget(run, start, target, options = {}) {
  if (!run || !start || !target) {
    return [];
  }
  if (!inBounds(start.x, start.y, run) || !inBounds(target.x, target.y, run)) {
    return [];
  }
  const blockCell = options.isCellBlocked || ((x, y) => defaultCellBlocked(run, x, y, options));
  const open = [{ x: start.x, y: start.y }];
  const cameFrom = new Map();
  const gScore = new Map([[`${start.x}:${start.y}`, 0]]);
  const fScore = new Map([[`${start.x}:${start.y}`, chebyshevDistance(start, target)]]);
  let bestNode = { x: start.x, y: start.y };
  let bestHeuristic = chebyshevDistance(start, target);
  let bestCost = 0;

  while (open.length > 0) {
    open.sort((a, b) => (fScore.get(`${a.x}:${a.y}`) ?? Infinity) - (fScore.get(`${b.x}:${b.y}`) ?? Infinity));
    const current = open.shift();
    const currentKey = `${current.x}:${current.y}`;
    const currentCost = gScore.get(currentKey) ?? Infinity;
    const currentHeuristic = chebyshevDistance(current, target);
    if (currentHeuristic < bestHeuristic || (currentHeuristic === bestHeuristic && currentCost < bestCost)) {
      bestNode = current;
      bestHeuristic = currentHeuristic;
      bestCost = currentCost;
    }
    if (current.x === target.x && current.y === target.y) {
      bestNode = current;
      break;
    }

    for (const dir of DIRS_8) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!inBounds(nx, ny, run)) continue;
      if (nx === target.x && ny === target.y) {
        // allow target explicitly
      } else if (blockCell(nx, ny)) {
        continue;
      }
      if (isDiagonalCutBlocked(run, current.x, current.y, nx, ny)) {
        continue;
      }

      const tentative = currentCost + (dir.x !== 0 && dir.y !== 0 ? 1.4142 : 1);
      const nKey = `${nx}:${ny}`;
      if (tentative >= (gScore.get(nKey) ?? Infinity)) {
        continue;
      }
      cameFrom.set(nKey, { x: current.x, y: current.y });
      gScore.set(nKey, tentative);
      fScore.set(nKey, tentative + chebyshevDistance({ x: nx, y: ny }, target));
      if (!open.some((n) => n.x === nx && n.y === ny)) {
        open.push({ x: nx, y: ny });
      }
    }
  }

  const path = [{ x: bestNode.x, y: bestNode.y }];
  let key = `${bestNode.x}:${bestNode.y}`;
  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key);
    path.push({ x: prev.x, y: prev.y });
    key = `${prev.x}:${prev.y}`;
  }
  path.reverse();
  return path;
}

function buildPathToNearestEnemyAttackCell(run, enemy, options = {}) {
  if (!run?.player || !enemy) {
    return [];
  }
  const isBlockedForEnemy = options.isCellBlocked
    ? (x, y) => options.isCellBlocked(x, y)
    : (x, y) => isCellBlockedForEnemy(run, x, y, enemy.id);
  const attackCellsAll = DIRS_8
    .map((dir) => ({ x: run.player.x + dir.x, y: run.player.y + dir.y }))
    .filter((cell) => inBounds(cell.x, cell.y, run))
    .filter((cell) => !isWall(cell.x, cell.y, run))
    .filter((cell) => !(run.goal?.x === cell.x && run.goal?.y === cell.y));
  const attackCellsFree = attackCellsAll.filter((cell) => !isBlockedForEnemy(cell.x, cell.y));
  const attackCells = attackCellsFree.length > 0 ? attackCellsFree : attackCellsAll;
  if (attackCells.length === 0) {
    return [];
  }

  const currentDistanceToPlayer = chebyshevDistance(enemy, run.player);
  const candidates = [];
  for (const attackCell of attackCells) {
    const path = buildPathTowardTarget(run, { x: enemy.x, y: enemy.y }, attackCell, options);
    if (path.length === 0) {
      continue;
    }
    const end = path[path.length - 1];
    const nextStep = path[1] || end;
    if (
      (nextStep.x !== enemy.x || nextStep.y !== enemy.y)
      && isBlockedForEnemy(nextStep.x, nextStep.y)
    ) {
      continue;
    }
    const distanceToTarget = chebyshevDistance(end, attackCell);
    const nextDistanceToPlayer = chebyshevDistance(nextStep, run.player);
    candidates.push({
      path,
      distanceToTarget,
      nextDistanceToPlayer,
      pathLength: path.length,
    });
  }
  if (candidates.length === 0) {
    return [];
  }

  // Если есть варианты без увеличения дистанции до игрока, не выбираем "убегающие" ходы.
  const nonRetreatCandidates = candidates.filter(
    (candidate) => candidate.nextDistanceToPlayer <= currentDistanceToPlayer
  );
  const pool = nonRetreatCandidates.length > 0 ? nonRetreatCandidates : candidates;

  pool.sort((a, b) => {
    if (a.distanceToTarget !== b.distanceToTarget) {
      return a.distanceToTarget - b.distanceToTarget;
    }
    if (a.nextDistanceToPlayer !== b.nextDistanceToPlayer) {
      return a.nextDistanceToPlayer - b.nextDistanceToPlayer;
    }
    return a.pathLength - b.pathLength;
  });
  return pool[0]?.path || [];
}

export function buildPathToDiscoveredCell(run, start, target, options = {}) {
  return buildPathToCell(run, start, target, {
    ...options,
    isCellBlocked: (x, y) => {
      if (!run?.discovered?.[y]?.[x]) {
        return true;
      }
      if (options.isCellBlocked) {
        return options.isCellBlocked(x, y);
      }
      return defaultCellBlocked(run, x, y, options);
    },
  });
}

function isCellBlockedForEnemy(run, x, y, selfId) {
  if (!inBounds(x, y, run) || isWall(x, y, run)) {
    return true;
  }
  if (run.goal?.x === x && run.goal?.y === y) {
    return true;
  }
  if (run.player?.x === x && run.player?.y === y) {
    return true;
  }
  return Boolean(getBlockingObjectAt(run, x, y, ACTOR_KIND.ENEMY, selfId));
}

function isCellBlockedForEnemyWithReservations(run, x, y, selfId, occupiedKeys, reservedKeys) {
  if (!inBounds(x, y, run) || isWall(x, y, run)) {
    return true;
  }
  if (run.goal?.x === x && run.goal?.y === y) {
    return true;
  }
  if (run.player?.x === x && run.player?.y === y) {
    return true;
  }
  const key = `${x}:${y}`;
  if (reservedKeys?.has(key)) {
    return true;
  }
  const occupiedBy = occupiedKeys?.get(key);
  return Boolean(occupiedBy && occupiedBy !== selfId);
}

function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

function hasLineOfSight(run, fromX, fromY, toX, toY) {
  const points = bresenhamLine(fromX, fromY, toX, toY);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    const isTarget = p.x === toX && p.y === toY;
    if (run.grid[p.y][p.x] === 1) {
      return isTarget;
    }
  }
  return true;
}

function revealAroundPlayer(run, visionRange) {
  const px = run.player.x;
  const py = run.player.y;
  run.discovered[py][px] = true;

  for (let y = py - visionRange; y <= py + visionRange; y += 1) {
    for (let x = px - visionRange; x <= px + visionRange; x += 1) {
      if (!inBounds(x, y, run)) continue;
      const distance = Math.hypot(x - px, y - py);
      if (distance > visionRange) continue;
      if (hasLineOfSight(run, px, py, x, y)) {
        run.discovered[y][x] = true;
      }
    }
  }
}

function findNearestEnemy(run) {
  const enemies = run.objects.filter((object) => object.type === "enemy");
  if (enemies.length === 0) {
    return null;
  }

  let best = enemies[0];
  let bestDistance = Math.abs(best.x - run.player.x) + Math.abs(best.y - run.player.y);
  for (const enemy of enemies.slice(1)) {
    const distance = Math.abs(enemy.x - run.player.x) + Math.abs(enemy.y - run.player.y);
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

function getXpForEnemy(enemyId) {
  if (enemyId?.startsWith("cat_big")) return 15;
  if (enemyId?.startsWith("cat_mid")) return 10;
  return 6;
}

function applyXpGain(playerSheet, gainedXp) {
  if (!playerSheet || gainedXp <= 0) {
    return { playerSheet, levelUps: 0 };
  }

  playerSheet.xp = (playerSheet.xp || 0) + gainedXp;
  let levelUps = 0;
  while ((playerSheet.xp || 0) >= (playerSheet.xpToNext || 1)) {
    playerSheet.xp -= playerSheet.xpToNext;
    playerSheet.level = (playerSheet.level || 1) + 1;
    playerSheet.unspentPoints = (playerSheet.unspentPoints || 0) + PROGRESSION_CONFIG.pointsPerLevel;
    if (playerSheet.level % 2 === 0) {
      playerSheet.skillPoints = (playerSheet.skillPoints || 0) + 1;
    }
    playerSheet.xpToNext = Math.max(1, Math.ceil((playerSheet.xpToNext || PROGRESSION_CONFIG.baseXpToNext) * PROGRESSION_CONFIG.xpGrowthFactor));
    levelUps += 1;
  }

  return { playerSheet, levelUps };
}

export function createRunState(playerSheet, level = 1) {
  const maze = generateMazeRun();
  const spawnPlan = planStartAndGoalSpawn(maze);
  const mazeWithSpawn = {
    ...maze,
    start: { x: spawnPlan.start.x, y: spawnPlan.start.y },
    goal: { x: spawnPlan.goal.x, y: spawnPlan.goal.y },
  };
  const run = {
    ...mazeWithSpawn,
    player: { x: mazeWithSpawn.start.x, y: mazeWithSpawn.start.y },
    level,
    maxLevel: 10,
    turns: 0,
    status: "running",
    objects: generateObjects(mazeWithSpawn, level, { blockedSpawnKeys: spawnPlan.blockedSpawnKeys }),
    lastLog: level === 1 ? "Забег начался." : `Уровень ${level} начался.`,
    nextHitMultiplier: 1,
    visionRange: playerSheet?.stats?.VISION ?? 6,
    discovered: createMask(mazeWithSpawn.width, mazeWithSpawn.height, false),
    motion: null,
    floatingTexts: [],
    screenShake: null,
    overTimeEffects: [],
    turnPhase: "player",
    environmentActionQueue: [],
    environmentMotion: null,
    environmentNextStepAtMs: 0,
    playerStatus: {
      stunTurns: 0,
    },
  };
  revealAroundPlayer(run, run.visionRange);
  return run;
}

function processTurnEffects(run, playerSheet) {
  if (!run || !playerSheet) {
    return;
  }
  const effects = Array.isArray(run.overTimeEffects) ? run.overTimeEffects : [];
  if (effects.length === 0) {
    return;
  }
  const alive = [];
  for (const effect of effects) {
    if (effect.type === "bandage_regen") {
      const healPerTurn = Math.max(1, effect.healPerTurn || 0);
      const hpMax = Math.max(1, playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1);
      const hpNow = Math.max(0, playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const nextHp = Math.min(hpMax, hpNow + healPerTurn);
      playerSheet.stats.HP = nextHp;
      playerSheet.baseStats.HP = nextHp;
      run.floatingTexts.push({
        x: run.player.x,
        y: run.player.y,
        value: `+${Math.max(0, nextHp - hpNow)}`,
        color: "#86efac",
        durationMs: 620,
        scale: 1.05,
        startMs: null,
      });
    } else if (effect.type === "poison_player") {
      const poisonDamage = Math.max(1, effect.poisonDamage || 1);
      const hpNow = Math.max(0, playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const nextHp = Math.max(0, hpNow - poisonDamage);
      playerSheet.stats.HP = nextHp;
      playerSheet.baseStats.HP = nextHp;
      run.floatingTexts.push({
        x: run.player.x,
        y: run.player.y,
        value: `-${poisonDamage}`,
        color: "#86efac",
        durationMs: 620,
        scale: 1.0,
        startMs: null,
      });
    }
    effect.turnsLeft = Math.max(0, (effect.turnsLeft || 0) - 1);
    if (effect.turnsLeft > 0) {
      alive.push(effect);
    }
  }
  run.overTimeEffects = alive;
}

export function createNextLevelRun(previousRun, playerSheet) {
  const nextLevel = (previousRun?.level || 1) + 1;
  const nextRun = createRunState(playerSheet, nextLevel);
  nextRun.nextHitMultiplier = Math.max(1, previousRun?.nextHitMultiplier || 1);
  if (previousRun?.mirrorVeil?.charges > 0) {
    nextRun.mirrorVeil = {
      charges: previousRun.mirrorVeil.charges,
      reduction: previousRun.mirrorVeil.reduction,
    };
  }
  if (Array.isArray(previousRun?.overTimeEffects) && previousRun.overTimeEffects.length > 0) {
    nextRun.overTimeEffects = previousRun.overTimeEffects.map((effect) => ({ ...effect }));
  }
  if (previousRun?.playerStatus) {
    nextRun.playerStatus = {
      stunTurns: Math.max(0, previousRun.playerStatus.stunTurns || 0),
    };
  }
  return nextRun;
}

export function useConsumable(run, playerSheet, item) {
  if (!run || !playerSheet || !item?.isConsumable) {
    return { run, playerSheet, log: "" };
  }
  if (item.isTrapItem) {
    return { run, playerSheet, log: `${item.name}: выбери соседнюю свободную клетку для установки.`, actionConsumed: false };
  }

  let log = `${item.name} применен.`;
  const currentHp = playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0;
  const currentHpMax = playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1;
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const manaByHealingItem = {
    cheese_ration: 4,
    rare_royal_cheese: 8,
  };
  let restoredMana = 0;
  if (item.id === "cheese_ration") {
    const nextHp = Math.min(currentHpMax, currentHp + 10);
    playerSheet.baseStats.HP = nextHp;
    restoredMana = manaByHealingItem[item.id] || 0;
    log = `${item.name}: восстановлено 10 HP.`;
  } else if (item.id === "common_crumb_ration") {
    const nextHp = Math.min(currentHpMax, currentHp + 10);
    playerSheet.baseStats.HP = nextHp;
    log = `${item.name}: восстановлено 10 HP.`;
  } else if (item.id === "common_mint_drop") {
    const nextMana = Math.min(currentManaMax, currentMana + 10);
    playerSheet.mana = nextMana;
    const restored = Math.max(0, nextMana - currentMana);
    log = `${item.name}: восстановлено ${restored} маны.`;
  } else if (item.id === "common_warm_milk") {
    const nextHp = Math.min(currentHpMax, currentHp + 6);
    const nextMana = Math.min(currentManaMax, currentMana + 6);
    playerSheet.baseStats.HP = nextHp;
    playerSheet.mana = nextMana;
    const restoredHp = Math.max(0, nextHp - currentHp);
    const restoredMp = Math.max(0, nextMana - currentMana);
    log = `${item.name}: восстановлено ${restoredHp} HP и ${restoredMp} маны.`;
  } else if (item.id === "common_sharp_pepper") {
    run.nextHitMultiplier = 1.5;
    log = `${item.name}: следующая атака получает множитель x1.5.`;
  } else if (item.id === "rare_hearty_stew") {
    const nextHp = Math.min(currentHpMax, currentHp + 18);
    playerSheet.baseStats.HP = nextHp;
    log = `${item.name}: восстановлено 18 HP.`;
  } else if (item.id === "rare_focus_tonic") {
    const nextMana = Math.min(currentManaMax, currentMana + 16);
    playerSheet.mana = nextMana;
    const restored = Math.max(0, nextMana - currentMana);
    log = `${item.name}: восстановлено ${restored} маны.`;
  } else if (item.id === "rare_dual_elixir") {
    const nextHp = Math.min(currentHpMax, currentHp + 12);
    const nextMana = Math.min(currentManaMax, currentMana + 12);
    playerSheet.baseStats.HP = nextHp;
    playerSheet.mana = nextMana;
    const restoredHp = Math.max(0, nextHp - currentHp);
    const restoredMp = Math.max(0, nextMana - currentMana);
    log = `${item.name}: восстановлено ${restoredHp} HP и ${restoredMp} маны.`;
  } else if (item.id === "rare_battle_pepper") {
    run.nextHitMultiplier = 2;
    log = `${item.name}: следующая атака получает множитель x2.`;
  } else if (item.id === "unique_phoenix_broth") {
    const nextHp = Math.min(currentHpMax, currentHp + 28);
    playerSheet.baseStats.HP = nextHp;
    log = `${item.name}: восстановлено 28 HP.`;
  } else if (item.id === "unique_aether_draught") {
    const nextMana = Math.min(currentManaMax, currentMana + 24);
    playerSheet.mana = nextMana;
    const restored = Math.max(0, nextMana - currentMana);
    log = `${item.name}: восстановлено ${restored} маны.`;
  } else if (item.id === "unique_twilight_mix") {
    const nextHp = Math.min(currentHpMax, currentHp + 20);
    const nextMana = Math.min(currentManaMax, currentMana + 20);
    playerSheet.baseStats.HP = nextHp;
    playerSheet.mana = nextMana;
    const restoredHp = Math.max(0, nextHp - currentHp);
    const restoredMp = Math.max(0, nextMana - currentMana);
    log = `${item.name}: восстановлено ${restoredHp} HP и ${restoredMp} маны.`;
  } else if (item.id === "unique_storm_pepper") {
    run.nextHitMultiplier = 2.5;
    log = `${item.name}: следующая атака получает множитель x2.5.`;
  } else if (item.id === "hard_cheese") {
    playerSheet.baseStats.HP_MAX += 5;
    playerSheet.baseStats.HP = currentHp;
    playerSheet.effectStacks = {
      ...(playerSheet.effectStacks || {}),
      hard_cheese: (playerSheet.effectStacks?.hard_cheese || 0) + 1,
    };
    log = `${item.name}: HP МАКС +5 до конца забега.`;
  } else if (item.id === "common_cracker") {
    playerSheet.baseStats.HP_MAX += 4;
    playerSheet.baseStats.HP = currentHp;
    playerSheet.effectStacks = {
      ...(playerSheet.effectStacks || {}),
      common_cracker: (playerSheet.effectStacks?.common_cracker || 0) + 1,
    };
    log = `${item.name}: HP МАКС +4 до конца забега.`;
  } else if (item.id === "rare_royal_cheese") {
    const nextHp = Math.min(currentHpMax + 1, currentHp + 20);
    playerSheet.baseStats.HP_MAX += 1;
    playerSheet.baseStats.HP = nextHp;
    playerSheet.effectStacks = {
      ...(playerSheet.effectStacks || {}),
      rare_royal_cheese: (playerSheet.effectStacks?.rare_royal_cheese || 0) + 1,
    };
    restoredMana = manaByHealingItem[item.id] || 0;
    log = `${item.name}: +1 HP МАКС и лечение 20 HP.`;
  } else if (item.id === "rare_spice_vial") {
    run.nextHitMultiplier = 2;
    log = `${item.name}: следующий удар мышки x2.`;
  } else if (item.id === "pepper_bomb") {
    const enemy = findNearestEnemy(run);
    if (!enemy) {
      log = `${item.name}: поблизости нет котов.`;
    } else {
      enemy.data.hp = Math.max(0, enemy.data.hp - 8);
      log = `${item.name}: ${enemy.name} получает 8 урона.`;
      if (enemy.data.hp <= 0) {
        const gainedXp = getXpForEnemy(enemy.id);
        const xpResult = applyXpGain(playerSheet, gainedXp);
        removeObject(run, enemy.id);
        const levelUpLog = xpResult.levelUps > 0
          ? ` Уровень повышен: ${playerSheet.level}. Очков прокачки: ${playerSheet.unspentPoints}.`
          : "";
        log += ` Кот повержен. +${gainedXp} XP.${levelUpLog}`;
      }
    }
  }
  if (restoredMana > 0) {
    const nextMana = Math.min(currentManaMax, currentMana + restoredMana);
    const deltaMana = nextMana - currentMana;
    playerSheet.mana = nextMana;
    if (deltaMana > 0) {
      log = `${log} Маны: +${deltaMana}.`;
    }
  }

  run.lastLog = log;
  return { run, playerSheet, log, actionConsumed: true };
}

export function getTrapPlacementCells(run) {
  if (!run?.player) {
    return [];
  }
  const cells = [];
  for (const dir of DIRS_8) {
    const x = run.player.x + dir.x;
    const y = run.player.y + dir.y;
    if (!inBounds(x, y, run) || isWall(x, y, run)) {
      continue;
    }
    if (getObjectsAt(run, x, y).length > 0) {
      continue;
    }
    cells.push({ x, y });
  }
  return cells;
}

export function placeTrap(run, playerSheet, item, targetX, targetY) {
  if (!run || !playerSheet || !item?.isTrapItem || !item?.trapConfig) {
    return { run, playerSheet, ok: false, log: "" };
  }
  const validCells = getTrapPlacementCells(run);
  const canPlace = validCells.some((cell) => cell.x === targetX && cell.y === targetY);
  if (!canPlace) {
    return {
      run,
      playerSheet,
      ok: false,
      log: "Ловушку можно поставить только в соседнюю свободную клетку.",
    };
  }
  const trapType = item.trapConfig?.trapType || "trap";
  run.objects.push({
    id: `trap_${trapType}_${Date.now()}_${targetX}_${targetY}_${Math.floor(Math.random() * 10000)}`,
    name: item.name,
    type: "trap",
    purpose: "trap",
    icon: item.icon || "🪤",
    oneTime: true,
    blocksMovement: false,
    blocksEnemyMovement: false,
    activation: { by: ["player", "enemy"], effect: "trigger_trap" },
    x: targetX,
    y: targetY,
    data: {
      trapType,
      trapConfig: { ...item.trapConfig },
    },
  });
  const log = `${item.name}: ловушка установлена.`;
  run.lastLog = log;
  return { run, playerSheet, ok: true, log };
}

export function useSkill(run, playerSheet, skillId) {
  return useSkillAtCell(run, playerSheet, skillId, run?.player?.x, run?.player?.y);
}

export function getSkillTargetCells(run, playerSheet, skillId) {
  if (!run || !playerSheet || !skillId) {
    return [];
  }
  const skillState = playerSheet.skills?.[skillId];
  if (!skillState?.learned || skillState.level <= 0) {
    return [];
  }
  const px = run.player.x;
  const py = run.player.y;
  const result = [];
  if (skillId === "mage_arc_shot") {
    for (const object of run.objects || []) {
      if (object.type !== "enemy") continue;
      if (!run.discovered?.[object.y]?.[object.x]) continue;
      if (!hasLineOfSight(run, run.player.x, run.player.y, object.x, object.y)) continue;
      result.push({ x: object.x, y: object.y });
    }
  } else if (skillId === "mage_mirror_veil") {
    result.push({ x: px, y: py });
  } else if (skillId === "warrior_power_hit") {
    const neighbors = DIRS_8.map((dir) => ({ x: px + dir.x, y: py + dir.y }));
    for (const cell of neighbors) {
      if (!inBounds(cell.x, cell.y, run)) continue;
      const object = getObjectAt(run, cell.x, cell.y);
      if (object?.type === "enemy") {
        result.push(cell);
      }
    }
  } else if (skillId === "warrior_roll") {
    const deltas = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (const delta of deltas) {
      const midX = px + delta.x;
      const midY = py + delta.y;
      const targetX = px + delta.x * 2;
      const targetY = py + delta.y * 2;
      if (!inBounds(targetX, targetY, run)) continue;
      if (!inBounds(midX, midY, run)) continue;
      if (isWall(midX, midY, run) || isWall(targetX, targetY, run)) continue;
      const targetObject = getObjectAt(run, targetX, targetY);
      if (targetObject?.type === "enemy") continue;
      result.push({ x: targetX, y: targetY });
    }
  } else if (skillId === "warrior_bandage") {
    const hasBandageActive = (run.overTimeEffects || []).some((effect) => effect.type === "bandage_regen");
    if (!hasBandageActive) {
      result.push({ x: px, y: py });
    }
  } else if (skillId === "mage_heal") {
    result.push({ x: px, y: py });
  }
  return result;
}

export function useSkillAtCell(run, playerSheet, skillId, targetX, targetY) {
  if (!run || !playerSheet || !skillId) {
    return { run, playerSheet, ok: false, log: "", actionConsumed: false };
  }
  const skillDef = getSkillById(skillId);
  const skillState = playerSheet.skills?.[skillId];
  if (!skillDef || !skillState?.learned || skillState.level <= 0) {
    return { run, playerSheet, ok: false, log: "Скилл не изучен.", actionConsumed: false };
  }

  const skillLevel = skillState.level;
  const manaCost = Math.max(1, skillDef.manaCost - (skillId === "warrior_roll" ? (skillLevel - 1) : 0));
  const mana = playerSheet.mana ?? 0;
  if (mana < manaCost) {
    return { run, playerSheet, ok: false, log: "Недостаточно маны.", actionConsumed: false };
  }
  const validTargets = getSkillTargetCells(run, playerSheet, skillId);
  const isValidTarget = validTargets.some((cell) => cell.x === targetX && cell.y === targetY);
  if (!isValidTarget) {
    return { run, playerSheet, ok: false, log: "Неверная клетка для скилла.", actionConsumed: false };
  }

  let log = "";
  let ok = false;
  if (skillId === "mage_arc_shot") {
    const enemy = getObjectAt(run, targetX, targetY);
    if (enemy) {
      const base = playerSheet.derived?.ATK_MAGIC ?? 1;
      const damage = Math.max(1, Math.floor(base * (1.1 + skillLevel * 0.2)));
      enemy.data.hp = Math.max(0, enemy.data.hp - damage);
      run.floatingTexts.push({
        x: enemy.x,
        y: enemy.y,
        value: `-${damage}`,
        color: "#93c5fd",
        durationMs: 700,
        scale: 1.2,
        startMs: null,
      });
      if (enemy.data.hp <= 0) {
        const gainedXp = getXpForEnemy(enemy.id);
        const xpResult = applyXpGain(playerSheet, gainedXp);
        removeObject(run, enemy.id);
        const levelUpLog = xpResult.levelUps > 0
          ? ` Уровень повышен: ${playerSheet.level}.`
          : "";
        log = `${skillDef.name}: ${enemy.name} получает ${damage}. Кот повержен. +${gainedXp} XP.${levelUpLog}`;
      } else {
        log = `${skillDef.name}: ${enemy.name} получает ${damage} урона.`;
      }
      ok = true;
    } else {
      log = `${skillDef.name}: рядом нет цели.`;
    }
  } else if (skillId === "mage_mirror_veil") {
    run.mirrorVeil = {
      charges: 1 + skillLevel,
      reduction: 1 + skillLevel,
    };
    log = `${skillDef.name}: защита активна (${run.mirrorVeil.charges} уд.).`;
    ok = true;
  } else if (skillId === "warrior_power_hit") {
    const enemy = getObjectAt(run, targetX, targetY);
    if (enemy) {
      const base = playerSheet.derived?.ATK_PHYS ?? 1;
      const damage = Math.max(1, Math.floor(base * (1.25 + skillLevel * 0.2)));
      enemy.data.hp = Math.max(0, enemy.data.hp - damage);
      run.floatingTexts.push({
        x: enemy.x,
        y: enemy.y,
        value: `-${damage}`,
        color: "#fca5a5",
        durationMs: 700,
        scale: 1.2,
        startMs: null,
      });
      if (enemy.data.hp <= 0) {
        const gainedXp = getXpForEnemy(enemy.id);
        const xpResult = applyXpGain(playerSheet, gainedXp);
        removeObject(run, enemy.id);
        const levelUpLog = xpResult.levelUps > 0
          ? ` Уровень повышен: ${playerSheet.level}.`
          : "";
        log = `${skillDef.name}: ${enemy.name} повержен. +${gainedXp} XP.${levelUpLog}`;
      } else {
        log = `${skillDef.name}: ${enemy.name} получает ${damage} урона.`;
      }
      ok = true;
    } else {
      log = `${skillDef.name}: рядом нет цели.`;
    }
  } else if (skillId === "warrior_roll") {
    const dx = Math.sign(targetX - run.player.x);
    const dy = Math.sign(targetY - run.player.y);
    const midX = run.player.x + dx;
    const midY = run.player.y + dy;
    const midObject = getObjectAt(run, midX, midY);
    if (midObject?.type === "enemy") {
      const rollDamage = Math.max(1, Math.floor((playerSheet?.stats?.AGI || 0) * 0.6 + skillLevel));
      midObject.data.hp = Math.max(0, midObject.data.hp - rollDamage);
      run.floatingTexts.push({
        x: midObject.x,
        y: midObject.y,
        value: `-${rollDamage}`,
        color: "#f59e0b",
        durationMs: 650,
        scale: 1.1,
        startMs: null,
      });
      if (midObject.data.hp <= 0) {
        const gainedXp = getXpForEnemy(midObject.id);
        applyXpGain(playerSheet, gainedXp);
        removeObject(run, midObject.id);
        log = `${skillDef.name}: урон по пути ${rollDamage}. Кот повержен (+${gainedXp} XP). `;
      }
    }
    run.player.x = targetX;
    run.player.y = targetY;
    const activationResult = applyObjectActivationOnCell(run, playerSheet, ACTOR_KIND.PLAYER, targetX, targetY);
    playerSheet = activationResult.playerSheet || playerSheet;
    if (activationResult.log) {
      log += `${skillDef.name}: рывок выполнен, ${activationResult.log.toLowerCase()}`;
    } else {
      log += `${skillDef.name}: рывок выполнен.`;
    }
    ok = true;
  } else if (skillId === "warrior_bandage") {
    const hasBandageActive = (run.overTimeEffects || []).some((effect) => effect.type === "bandage_regen");
    if (hasBandageActive) {
      log = `${skillDef.name}: эффект уже активен.`;
    } else {
      const healPerTurn = 5 + skillLevel;
      run.overTimeEffects = [...(run.overTimeEffects || []), {
        type: "bandage_regen",
        turnsLeft: 3,
        healPerTurn,
        sourceSkillId: skillId,
      }];
      log = `${skillDef.name}: восстановление ${healPerTurn} HP на 3 хода.`;
      ok = true;
    }
  } else if (skillId === "mage_heal") {
    const healValue = 40 + Math.max(0, (skillLevel - 1) * 10);
    const hpMax = Math.max(1, playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1);
    const hpNow = Math.max(0, playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
    const nextHp = Math.min(hpMax, hpNow + healValue);
    const healed = Math.max(0, nextHp - hpNow);
    playerSheet.stats.HP = nextHp;
    playerSheet.baseStats.HP = nextHp;
    run.floatingTexts.push({
      x: run.player.x,
      y: run.player.y,
      value: `+${healed}`,
      color: "#4ade80",
      durationMs: 680,
      scale: 1.15,
      startMs: null,
    });
    log = `${skillDef.name}: восстановлено ${healed} HP.`;
    ok = true;
  }

  if (ok) {
    playerSheet.mana = Math.max(0, mana - manaCost);
    if (playerSheet.stats.HP <= 0) {
      run.status = "defeat";
    } else if (run.player.x === run.goal.x && run.player.y === run.goal.y) {
      // Переход уровня обрабатывается в applyObjectActivationOnCell для единой модели сущностей.
    }
    revealAroundPlayer(run, run.visionRange || 6);
  }
  run.lastLog = log;
  return { run, playerSheet, ok, log, actionConsumed: ok };
}

export function tryStep(run, playerSheet, direction) {
  if (!run || run.status !== "running") {
    return { run, playerSheet, log: "", motion: null, actionConsumed: false };
  }

  const delta = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up_left: { x: -1, y: -1 },
    up_right: { x: 1, y: -1 },
    down_left: { x: -1, y: 1 },
    down_right: { x: 1, y: 1 },
  }[direction];

  if (!delta) {
    return { run, playerSheet, log: "", motion: null, actionConsumed: false };
  }
  run.lastDirection = direction;

  const nx = run.player.x + delta.x;
  const ny = run.player.y + delta.y;

  if (!inBounds(nx, ny, run)) {
    return { run, playerSheet, log: "Нельзя выйти за границы квартиры.", motion: null, actionConsumed: false };
  }

  if (isWall(nx, ny, run)) {
    return { run, playerSheet, log: "Стена перекрывает путь.", motion: null, actionConsumed: false };
  }
  const cellObjects = getObjectsAt(run, nx, ny);
  const enemyAtTarget = cellObjects.find((object) => object.type === "enemy") || null;
  const blockingObject = getBlockingObjectAt(run, nx, ny, ACTOR_KIND.PLAYER);
  // Диагональный "срез угла" блокирует перемещение, но не ближнюю атаку по врагу.
  if (isDiagonalCutBlocked(run, run.player.x, run.player.y, nx, ny) && !enemyAtTarget) {
    return { run, playerSheet, log: "Нельзя пройти по диагонали через угол стены.", motion: null, actionConsumed: false };
  }
  let log = "";
  let motion = null;
  const from = { x: run.player.x, y: run.player.y };

  if (!blockingObject) {
    run.player.x = nx;
    run.player.y = ny;
    const activationResult = applyObjectActivationOnCell(run, playerSheet, ACTOR_KIND.PLAYER, nx, ny);
    playerSheet = activationResult.playerSheet || playerSheet;
    log = activationResult.log || "Переход на соседнюю клетку.";
    motion = { kind: "move", from, to: { x: nx, y: ny }, durationMs: 120 };
  } else if (blockingObject.type === "enemy") {
    const baseDamage = Math.max(
      playerSheet?.derived?.ATK_PHYS || 1,
      playerSheet?.derived?.ATK_MAGIC || 1
    );
    const critChance = Math.max(0, Math.min(100, playerSheet?.derived?.CRIT_CHANCE ?? 0));
    const critMult = Math.max(1, playerSheet?.derived?.CRIT_MULT ?? 1);
    const isCrit = Math.random() * 100 < critChance;
    const totalMultiplier = (run.nextHitMultiplier || 1) * (isCrit ? critMult : 1);
    const playerDamage = Math.max(1, Math.floor(baseDamage * totalMultiplier));
    run.nextHitMultiplier = 1;
    blockingObject.data.hp = Math.max(0, blockingObject.data.hp - playerDamage);
    run.floatingTexts.push({
      x: blockingObject.x,
      y: blockingObject.y,
      value: `-${playerDamage}`,
      color: isCrit ? "#fde047" : "#fca5a5",
      durationMs: isCrit ? 800 : 650,
      scale: isCrit ? 1.45 : 1,
      isCrit,
      startMs: null,
    });
    if (isCrit) {
      run.screenShake = {
        durationMs: 220,
        amplitudePx: 5,
        startMs: null,
      };
    }

    if (blockingObject.data.hp <= 0) {
      const gainedXp = getXpForEnemy(blockingObject.id);
      const xpResult = applyXpGain(playerSheet, gainedXp);
      removeObject(run, blockingObject.id);
      const combatLog = isCrit
        ? `КРИТ! ${blockingObject.name} повержен (-${playerDamage} HP).`
        : `${blockingObject.name} повержен (-${playerDamage} HP).`;
      const levelUpLog = xpResult.levelUps > 0
        ? ` Уровень повышен: ${playerSheet.level}. Очков прокачки: ${playerSheet.unspentPoints}.`
        : "";
      log = `${combatLog} +${gainedXp} XP.${levelUpLog}`;
      motion = { kind: "bounce", from, target: { x: nx, y: ny }, durationMs: 170 };
    } else {
      log = isCrit
        ? `КРИТ! ${blockingObject.name} получает ${playerDamage}.`
        : `${blockingObject.name} получает ${playerDamage}.`;
      motion = { kind: "bounce", from, target: { x: nx, y: ny }, durationMs: 170 };
    }
  } else if (blockingObject.type === "chest") {
    run.player.x = nx;
    run.player.y = ny;
    const activationResult = applyObjectActivationOnCell(run, playerSheet, ACTOR_KIND.PLAYER, nx, ny);
    playerSheet = activationResult.playerSheet || playerSheet;
    log = activationResult.log || "Переход на соседнюю клетку.";
    motion = { kind: "move", from, to: { x: nx, y: ny }, durationMs: 120 };
  }

  if (playerSheet.stats.HP <= 0) {
    run.status = "defeat";
  } else if (run.player.x === run.goal.x && run.player.y === run.goal.y) {
    // Переход уровня обрабатывается в applyObjectActivationOnCell для единой модели сущностей.
  }

  run.lastLog = log;
  revealAroundPlayer(run, run.visionRange || 6);
  return { run, playerSheet, log, motion, actionConsumed: true };
}

export function beginEnvironmentTurn(run) {
  if (!run || run.status !== "running") {
    return run;
  }
  const queue = (run.objects || [])
    .filter((object) => object.type === "enemy")
    .map((object) => object.id);
  run.turnPhase = "environment";
  run.environmentActionQueue = queue;
  run.environmentNextStepAtMs = 0;
  return run;
}

export function stepEnvironmentTurn(run, playerSheet) {
  if (!run || !playerSheet || run.status !== "running" || run.turnPhase !== "environment") {
    return { run, playerSheet, finished: true, progressed: false };
  }

  if ((run.environmentActionQueue || []).length > 0) {
    const actionQueue = [...run.environmentActionQueue];
    run.environmentActionQueue = [];
    const plannedMoves = [];
    const plannedAttacks = [];
    const reservedDestinations = new Set();
    const occupiedByCell = new Map();
    for (const object of run.objects || []) {
      if (!isObjectBlockingForActor(object, ACTOR_KIND.ENEMY)) {
        continue;
      }
      occupiedByCell.set(`${object.x}:${object.y}`, object.id);
    }

    let attackCount = 0;
    let movedCount = 0;
    let effectCount = 0;
    let lastAttackerName = "";

    for (const enemyId of actionQueue) {
      const enemy = getEnemyById(run, enemyId);
      if (!enemy) {
        continue;
      }
      const status = ensureEnemyStatus(enemy);
      if ((status.poisonTurns || 0) > 0 && (status.poisonDamage || 0) > 0) {
        const poisonDamage = Math.max(0, status.poisonDamage || 0);
        enemy.data.hp = Math.max(0, (enemy.data?.hp || 0) - poisonDamage);
        status.poisonTurns = Math.max(0, (status.poisonTurns || 0) - 1);
        run.floatingTexts.push({
          x: enemy.x,
          y: enemy.y,
          value: `-${poisonDamage}`,
          color: "#86efac",
          durationMs: 620,
          scale: 1.0,
          startMs: null,
        });
        effectCount += 1;
        if ((enemy.data?.hp || 0) <= 0) {
          removeObject(run, enemy.id);
          continue;
        }
      }
      if ((status.stunTurns || 0) > 0) {
        status.stunTurns = Math.max(0, (status.stunTurns || 0) - 1);
        effectCount += 1;
        continue;
      }

      // Кот действует только если игрок видит его на карте.
      if (!run.discovered?.[enemy.y]?.[enemy.x]) {
        continue;
      }

      const distance = chebyshevDistance(enemy, run.player);
      if (distance === 1) {
        const veilReduction = run.mirrorVeil?.reduction || 0;
        const damageTaken = Math.max(0, (enemy.data?.damage || 0) - veilReduction);
        if (run.mirrorVeil?.charges) {
          run.mirrorVeil.charges -= 1;
          if (run.mirrorVeil.charges <= 0) {
            delete run.mirrorVeil;
          }
        }
        const hpNow = playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0;
        const nextHp = Math.max(0, hpNow - damageTaken);
        playerSheet.stats.HP = nextHp;
        playerSheet.baseStats.HP = nextHp;
        run.floatingTexts.push({
          x: run.player.x,
          y: run.player.y,
          value: `-${damageTaken}`,
          color: "#fca5a5",
          durationMs: 620,
          scale: 1.05,
          startMs: null,
        });
        attackCount += 1;
        lastAttackerName = enemy.name;
        plannedAttacks.push({
          actorId: enemy.id,
          kind: "bounce",
          from: { x: enemy.x, y: enemy.y },
          target: { x: run.player.x, y: run.player.y },
        });
        if (nextHp <= 0) {
          run.status = "defeat";
          run.lastLog = `${enemy.name} атакует мышонка на ${damageTaken}.`;
          return { run, playerSheet, finished: true, progressed: true };
        }
        continue;
      }

      const path = buildPathToNearestEnemyAttackCell(run, enemy, {
        allowPlayer: false,
        allowGoal: false,
        ignoreObjectId: enemy.id,
        isCellBlocked: (x, y) => {
          if (!run.discovered?.[y]?.[x]) {
            return true;
          }
          return isCellBlockedForEnemyWithReservations(
            run,
            x,
            y,
            enemy.id,
            occupiedByCell,
            reservedDestinations
          );
        },
      });
      if (path.length > 1) {
        const nextCell = path[1];
        const from = { x: enemy.x, y: enemy.y };
        const to = { x: nextCell.x, y: nextCell.y };
        plannedMoves.push({ actorId: enemy.id, kind: "move", from, to });
        reservedDestinations.add(`${to.x}:${to.y}`);
        occupiedByCell.delete(`${from.x}:${from.y}`);
        occupiedByCell.set(`${to.x}:${to.y}`, enemy.id);
        movedCount += 1;
      }
    }

    for (const motion of plannedMoves) {
      const enemy = getEnemyById(run, motion.actorId);
      if (!enemy) continue;
      enemy.x = motion.to.x;
      enemy.y = motion.to.y;
      applyObjectActivationOnCell(run, playerSheet, ACTOR_KIND.ENEMY, enemy.x, enemy.y, enemy);
    }

    const plannedMotions = [...plannedMoves, ...plannedAttacks];
    if (plannedMotions.length > 0) {
      run.environmentMotion = {
        kind: "object-move-batch",
        actors: plannedMotions,
        durationMs: 170,
        startMs: null,
      };
    }

    if (attackCount > 0 && movedCount > 0) {
      run.lastLog = `${lastAttackerName} и другие коты действуют (${attackCount} атак, ${movedCount} перемещений).`;
    } else if (attackCount > 0) {
      run.lastLog = `${lastAttackerName} и другие коты атакуют (${attackCount}).`;
    } else if (movedCount > 0) {
      run.lastLog = `Коты перемещаются (${movedCount}).`;
    } else if (effectCount > 0) {
      run.lastLog = `Коты страдают от эффектов (${effectCount}).`;
    } else {
      run.lastLog = "Коты затаились.";
    }
    return { run, playerSheet, finished: false, progressed: attackCount > 0 || movedCount > 0 || effectCount > 0 };
  }

  while ((run.environmentActionQueue || []).length > 0) {
    const enemyId = run.environmentActionQueue.shift();
    const enemy = getEnemyById(run, enemyId);
    if (!enemy) {
      continue;
    }

    // Кот действует только если игрок видит его на карте.
    if (!run.discovered?.[enemy.y]?.[enemy.x]) {
      continue;
    }

    const distance = Math.abs(enemy.x - run.player.x) + Math.abs(enemy.y - run.player.y);
    if (distance === 1) {
      const veilReduction = run.mirrorVeil?.reduction || 0;
      const damageTaken = Math.max(0, (enemy.data?.damage || 0) - veilReduction);
      if (run.mirrorVeil?.charges) {
        run.mirrorVeil.charges -= 1;
        if (run.mirrorVeil.charges <= 0) {
          delete run.mirrorVeil;
        }
      }
      const hpNow = playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0;
      const nextHp = Math.max(0, hpNow - damageTaken);
      playerSheet.stats.HP = nextHp;
      playerSheet.baseStats.HP = nextHp;
      run.floatingTexts.push({
        x: run.player.x,
        y: run.player.y,
        value: `-${damageTaken}`,
        color: "#fca5a5",
        durationMs: 620,
        scale: 1.05,
        startMs: null,
      });
      run.lastLog = `${enemy.name} атакует мышонка на ${damageTaken}.`;
      if (nextHp <= 0) {
        run.status = "defeat";
      }
      return { run, playerSheet, finished: false, progressed: true };
    }

    const candidates = [
      { x: enemy.x + 1, y: enemy.y },
      { x: enemy.x - 1, y: enemy.y },
      { x: enemy.x, y: enemy.y + 1 },
      { x: enemy.x, y: enemy.y - 1 },
    ]
      .filter((cell) => !isCellBlockedForEnemy(run, cell.x, cell.y, enemy.id))
      .map((cell) => ({
        ...cell,
        d: Math.abs(cell.x - run.player.x) + Math.abs(cell.y - run.player.y),
      }))
      .sort((a, b) => a.d - b.d);

    if (candidates.length > 0 && candidates[0].d < distance) {
      const from = { x: enemy.x, y: enemy.y };
      enemy.x = candidates[0].x;
      enemy.y = candidates[0].y;
      run.environmentMotion = {
        kind: "object-move",
        actorId: enemy.id,
        from,
        to: { x: enemy.x, y: enemy.y },
        durationMs: 170,
        startMs: null,
      };
      run.lastLog = `${enemy.name} приближается к мышонку.`;
      return { run, playerSheet, finished: false, progressed: true };
    }
  }

  run.turnPhase = "player";
  run.turns += 1;
  processTurnEffects(run, playerSheet);
  tickTemporaryObjects(run);
  if ((playerSheet.stats?.HP ?? 0) <= 0) {
    run.status = "defeat";
    run.lastLog = "Мышонок пал от эффекта ловушки.";
    return { run, playerSheet, finished: true, progressed: true };
  }
  const playerStatus = ensurePlayerStatus(run);
  if ((playerStatus.stunTurns || 0) > 0) {
    playerStatus.stunTurns = Math.max(0, (playerStatus.stunTurns || 0) - 1);
    run.lastLog = `Мышонок оглушен и пропускает ход (${playerStatus.stunTurns} осталось).`;
    beginEnvironmentTurn(run);
    return { run, playerSheet, finished: false, progressed: true };
  }
  revealAroundPlayer(run, run.visionRange || 6);
  run.lastLog = "Ход окружения завершен. Ваш ход.";
  return { run, playerSheet, finished: true, progressed: false };
}
