import { ACTOR_KIND } from "./cellObjects.js?v=0.4.10-pre-alpha";
import { getChestCountsForLevel } from "./chestLoot.js?v=0.4.10-pre-alpha";
import { getEnemyCountsForLevel } from "./enemySpawn.js?v=0.4.10-pre-alpha";
import { getEnemyDefByType } from "./enemyDefs.js?v=0.4.10-pre-alpha";
import { randomInt } from "./rng.js?v=0.4.10-pre-alpha";

export function generateObjects(maze, level = 1, options = {}) {
  const rng = options.rng && typeof options.rng.nextFloat === "function" ? options.rng : null;
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
      type: "enemy",
      purpose: "enemy",
      oneTime: false,
      blocksMovement: true,
      activation: { by: [], effect: null },
    },
    cat_mid: {
      id: "cat_mid",
      type: "enemy",
      purpose: "enemy",
      oneTime: false,
      blocksMovement: true,
      activation: { by: [], effect: null },
    },
    cat_big: {
      id: "cat_big",
      type: "enemy",
      purpose: "enemy",
      oneTime: false,
      blocksMovement: true,
      activation: { by: [], effect: null },
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
  const enemyCounts = getEnemyCountsForLevel(level, walkableCells, rng);
  const chestCounts = getChestCountsForLevel(level, rng);
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
    const j = randomInt(0, i, rng);
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
      const j = randomInt(0, i, rng);
      const tmp = bucket.deadEnds[i];
      bucket.deadEnds[i] = bucket.deadEnds[j];
      bucket.deadEnds[j] = tmp;
    }
    for (let i = bucket.regular.length - 1; i > 0; i -= 1) {
      const j = randomInt(0, i, rng);
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
    const enemyDef = template.type === "enemy" ? getEnemyDefByType(template.id) : null;
    reserved.add(keyOf(cell.x, cell.y));
    list.push({
      id: `${template.id}_${ordinal}_${cell.x}_${cell.y}`,
      name: enemyDef?.name || template.name,
      type: template.type,
      purpose: template.purpose || template.type,
      icon: enemyDef?.icon || template.icon,
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
      data: enemyDef
        ? {
            hp: enemyDef.hp,
            maxHp: enemyDef.hp,
            damage: enemyDef.damage,
            enemyType: template.id,
          }
        : { ...template.data },
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
