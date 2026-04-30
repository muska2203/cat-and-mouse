import { generateMazeRun } from "./maze.js?v=0.3.0-pre-alpha";
import { getLootPool } from "./loadout.js?v=0.3.0-pre-alpha";
import { PROGRESSION_CONFIG } from "./state.js?v=0.3.0-pre-alpha";
import { getSkillById } from "./skills.js?v=0.3.0-pre-alpha";

function inBounds(x, y, run) {
  return x >= 0 && y >= 0 && x < run.width && y < run.height;
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

function getLootFromChest(chestRarity, classId) {
  const rolledPool = rollLootPoolByChestRarity(chestRarity);
  const fallbackPools = {
    common: ["common", "rare", "unique"],
    rare: ["rare", "common", "unique"],
    unique: ["unique", "rare", "common"],
  };
  const poolOrder = [rolledPool, ...(fallbackPools[chestRarity] || fallbackPools.common)]
    .filter((poolName, index, list) => list.indexOf(poolName) === index);
  for (const poolName of poolOrder) {
    const pool = getLootPool(poolName, classId);
    if (pool.length > 0) {
      return randomPick(pool);
    }
  }
  return null;
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

function generateObjects(maze, level = 1) {
  const freeCells = [];
  const reserved = new Set();
  const rooms = Array.isArray(maze.rooms) ? maze.rooms : [];

  const objectTemplates = {
    cat_small: { id: "cat_small", name: "Котенок", type: "enemy", icon: "🐱", oneTime: false, data: { hp: 18, damage: 2 } },
    cat_mid: { id: "cat_mid", name: "Домашний кот", type: "enemy", icon: "🐈", oneTime: false, data: { hp: 27, damage: 5 } },
    cat_big: { id: "cat_big", name: "Дворовый кот", type: "enemy", icon: "😾", oneTime: false, data: { hp: 38, damage: 7 } },
    chest_common: { id: "chest_common", name: "Обычный сундук", type: "chest", icon: "📦", oneTime: true, data: { chestRarity: "common" } },
    chest_rare: { id: "chest_rare", name: "Редкий сундук", type: "chest", icon: "🎁", oneTime: true, data: { chestRarity: "rare" } },
    chest_unique: { id: "chest_unique", name: "Уникальный сундук", type: "chest", icon: "👑", oneTime: true, data: { chestRarity: "unique" } },
  };

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (maze.grid[y][x] === 1) continue;
      if (x === maze.start.x && y === maze.start.y) continue;
      if (x === maze.goal.x && y === maze.goal.y) continue;
      freeCells.push({ x, y });
    }
  }

  const roomCellKeySet = new Set();
  for (const room of rooms) {
    const maxY = Math.min(maze.height - 1, room.y + room.h - 1);
    const maxX = Math.min(maze.width - 1, room.x + room.w - 1);
    for (let y = Math.max(0, room.y); y <= maxY; y += 1) {
      for (let x = Math.max(0, room.x); x <= maxX; x += 1) {
        if (maze.grid[y][x] === 1) continue;
        if (x === maze.start.x && y === maze.start.y) continue;
        if (x === maze.goal.x && y === maze.goal.y) continue;
        roomCellKeySet.add(`${x}:${y}`);
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

  function takeCellFrom(pool) {
    while (pool.length > 0) {
      const cell = pool.pop();
      if (!reserved.has(keyOf(cell.x, cell.y))) return cell;
    }
    return null;
  }

  function placeObject(list, template, cell, ordinal) {
    reserved.add(keyOf(cell.x, cell.y));
    list.push({
      id: `${template.id}_${ordinal}_${cell.x}_${cell.y}`,
      name: template.name,
      type: template.type,
      icon: template.icon,
      oneTime: template.oneTime,
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
        cell = takeCellFrom(roomDeadEnds) || takeCellFrom(corridorDeadEnds);
      }
      if (!cell) {
        cell = takeCellFrom(roomCells) || takeCellFrom(corridorCells) || takeCellFrom(nonDeadEnds) || takeCellFrom(deadEnds);
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
    const guardCell = neighbors4(chest.x, chest.y).find((cell) => !reserved.has(keyOf(cell.x, cell.y)));
    if (!guardCell) continue;
    const enemyKey = enemyQueue.shift();
    const enemyTemplate = objectTemplates[enemyKey];
    placeObject(objects, enemyTemplate, guardCell, enemyOrdinal);
    enemyOrdinal += 1;
  }

  // 3) Остальных котов досыпаем случайно.
  while (enemyQueue.length > 0) {
    const cell = takeCellFrom(roomCells) || takeCellFrom(nonDeadEnds) || takeCellFrom(corridorCells) || takeCellFrom(deadEnds);
    if (!cell) break;
    const enemyKey = enemyQueue.shift();
    const enemyTemplate = objectTemplates[enemyKey];
    placeObject(objects, enemyTemplate, cell, enemyOrdinal);
    enemyOrdinal += 1;
  }

  return objects;
}

function getObjectAt(run, x, y) {
  return run.objects.find((object) => object.x === x && object.y === y) || null;
}

function removeObject(run, objectId) {
  run.objects = run.objects.filter((object) => object.id !== objectId);
}

function getEnemyById(run, enemyId) {
  return run.objects.find((object) => object.id === enemyId && object.type === "enemy") || null;
}

function isCellBlockedForEnemy(run, x, y, selfId) {
  if (!inBounds(x, y, run) || isWall(x, y, run)) {
    return true;
  }
  if (run.player?.x === x && run.player?.y === y) {
    return false;
  }
  return run.objects.some((object) => object.id !== selfId && object.x === x && object.y === y);
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
  const run = {
    ...maze,
    player: { x: maze.start.x, y: maze.start.y },
    level,
    maxLevel: 10,
    turns: 0,
    status: "running",
    objects: generateObjects(maze, level),
    lastLog: level === 1 ? "Забег начался." : `Уровень ${level} начался.`,
    nextHitMultiplier: 1,
    visionRange: playerSheet?.stats?.VISION ?? 6,
    discovered: createMask(maze.width, maze.height, false),
    motion: null,
    floatingTexts: [],
    screenShake: null,
    overTimeEffects: [],
    turnPhase: "player",
    environmentActionQueue: [],
    environmentMotion: null,
    environmentNextStepAtMs: 0,
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
  return nextRun;
}

export function useConsumable(run, playerSheet, item) {
  if (!run || !playerSheet || !item?.isConsumable) {
    return { run, playerSheet, log: "" };
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
    const neighbors = [
      { x: px + 1, y: py },
      { x: px - 1, y: py },
      { x: px, y: py + 1 },
      { x: px, y: py - 1 },
    ];
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
    const landedObject = getObjectAt(run, targetX, targetY);
    if (landedObject?.type === "chest") {
      removeObject(run, landedObject.id);
      const loot = getLootFromChest(landedObject?.data?.chestRarity || "common", playerSheet.classId);
      if (loot) {
        run.pendingLoot = { itemId: loot.id, source: landedObject.name };
        log += `${skillDef.name}: рывок выполнен, найдено: ${loot.name}.`;
      } else {
        log += `${skillDef.name}: рывок выполнен, сундук пуст.`;
      }
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
      }
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
  const object = getObjectAt(run, nx, ny);
  let log = "";
  let motion = null;
  const from = { x: run.player.x, y: run.player.y };

  if (!object) {
    run.player.x = nx;
    run.player.y = ny;
    log = "Переход на соседнюю клетку.";
    motion = { kind: "move", from, to: { x: nx, y: ny }, durationMs: 120 };
  } else if (object.type === "enemy") {
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
    object.data.hp = Math.max(0, object.data.hp - playerDamage);
    run.floatingTexts.push({
      x: object.x,
      y: object.y,
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

    if (object.data.hp <= 0) {
      const gainedXp = getXpForEnemy(object.id);
      const xpResult = applyXpGain(playerSheet, gainedXp);
      removeObject(run, object.id);
      const combatLog = isCrit
        ? `КРИТ! ${object.name} повержен (-${playerDamage} HP).`
        : `${object.name} повержен (-${playerDamage} HP).`;
      const levelUpLog = xpResult.levelUps > 0
        ? ` Уровень повышен: ${playerSheet.level}. Очков прокачки: ${playerSheet.unspentPoints}.`
        : "";
      log = `${combatLog} +${gainedXp} XP.${levelUpLog}`;
      motion = { kind: "bounce", from, target: { x: nx, y: ny }, durationMs: 170 };
    } else {
      log = isCrit
        ? `КРИТ! ${object.name} получает ${playerDamage}.`
        : `${object.name} получает ${playerDamage}.`;
      motion = { kind: "bounce", from, target: { x: nx, y: ny }, durationMs: 170 };
    }
  } else if (object.type === "chest") {
    run.player.x = nx;
    run.player.y = ny;
    removeObject(run, object.id);
    const loot = getLootFromChest(object?.data?.chestRarity || "common", playerSheet.classId);
    if (loot) {
      log = `Найдено: ${loot.name}.`;
      run.pendingLoot = { itemId: loot.id, source: object.name };
    } else {
      log = `${object.name} оказался пустым.`;
    }
    motion = { kind: "move", from, to: { x: nx, y: ny }, durationMs: 120 };
  }

  if (playerSheet.stats.HP <= 0) {
    run.status = "defeat";
  } else if (run.player.x === run.goal.x && run.player.y === run.goal.y) {
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
      log = `Уровень ${run.level} пройден. Переход на ${run.level + 1}...`;
    }
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
  revealAroundPlayer(run, run.visionRange || 6);
  run.lastLog = "Ход окружения завершен. Ваш ход.";
  return { run, playerSheet, finished: true, progressed: false };
}
