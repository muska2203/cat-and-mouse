import { generateMazeRun } from "./maze.js?v=0.0.7-pre-alpha";
import { getLootPool } from "./loadout.js?v=0.0.7-pre-alpha";

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

function weightedEnemyType(level) {
  const t = Math.max(0, Math.min(1, (level - 1) / 9));
  const pSmall = 0.62 - t * 0.47;
  const pMid = 0.28 + t * 0.15;
  const roll = Math.random();
  if (roll < pSmall) return "cat_small";
  if (roll < pSmall + pMid) return "cat_mid";
  return "cat_big";
}

function getEnemyCountsForLevel(level) {
  const total = randomInt(6, 10);
  const counts = { cat_small: 0, cat_mid: 0, cat_big: 0 };
  for (let i = 0; i < total; i += 1) {
    counts[weightedEnemyType(level)] += 1;
  }
  return counts;
}

function generateObjects(maze, level = 1) {
  const freeCells = [];
  const reserved = new Set();
  const enemyCounts = getEnemyCountsForLevel(level);
  const byTypeCount = {
    cat_small: enemyCounts.cat_small,
    cat_mid: enemyCounts.cat_mid,
    cat_big: enemyCounts.cat_big,
    chest_common: randomInt(4, 6),
    chest_rare: randomInt(1, 2),
  };

  const objectTemplates = {
    cat_small: { id: "cat_small", name: "Котенок", type: "enemy", icon: "🐱", oneTime: false, data: { hp: 24, damage: 4 } },
    cat_mid: { id: "cat_mid", name: "Домашний кот", type: "enemy", icon: "🐈", oneTime: false, data: { hp: 34, damage: 7 } },
    cat_big: { id: "cat_big", name: "Дворовый кот", type: "enemy", icon: "😾", oneTime: false, data: { hp: 48, damage: 10 } },
    chest_common: { id: "chest_common", name: "Обычный сундук", type: "chest", icon: "📦", oneTime: true, data: { lootPool: "common" } },
    chest_rare: { id: "chest_rare", name: "Редкий сундук", type: "chest", icon: "🎁", oneTime: true, data: { lootPool: "rare" } },
  };

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (maze.grid[y][x] === 1) continue;
      if (x === maze.start.x && y === maze.start.y) continue;
      if (x === maze.goal.x && y === maze.goal.y) continue;
      freeCells.push({ x, y });
    }
  }

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
        cell = takeCellFrom(deadEnds);
      }
      if (!cell) {
        cell = takeCellFrom(nonDeadEnds) || takeCellFrom(deadEnds);
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
    const cell = takeCellFrom(nonDeadEnds) || takeCellFrom(deadEnds);
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
    visionRange: playerSheet?.stats?.VISION ?? 2,
    discovered: createMask(maze.width, maze.height, false),
    motion: null,
    floatingTexts: [],
    screenShake: null,
  };
  revealAroundPlayer(run, run.visionRange);
  return run;
}

export function createNextLevelRun(previousRun, playerSheet) {
  const nextLevel = (previousRun?.level || 1) + 1;
  return createRunState(playerSheet, nextLevel);
}

export function useConsumable(run, playerSheet, item) {
  if (!run || !playerSheet || !item?.isConsumable) {
    return { run, playerSheet, log: "" };
  }

  let log = `${item.name} применен.`;
  const currentHp = playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0;
  const currentHpMax = playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1;
  if (item.id === "cheese_ration" || item.id === "common_cheese_slice") {
    playerSheet.baseStats.HP = Math.min(currentHpMax, currentHp + 10);
    log = `${item.name}: восстановлено 10 HP.`;
  } else if (item.id === "hard_cheese") {
    playerSheet.baseStats.HP_MAX += 5;
    playerSheet.baseStats.HP = currentHp;
    log = `${item.name}: HP МАКС +5 до конца забега.`;
  } else if (item.id === "common_cracker") {
    playerSheet.baseStats.HP_MAX += 4;
    playerSheet.baseStats.HP = currentHp;
    log = `${item.name}: HP МАКС +4 до конца забега.`;
  } else if (item.id === "rare_royal_cheese") {
    playerSheet.baseStats.HP_MAX += 1;
    playerSheet.baseStats.HP = currentHp + 20;
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
        removeObject(run, enemy.id);
        log += " Кот повержен.";
      }
    }
  }

  run.lastLog = log;
  return { run, playerSheet, log };
}

export function tryStep(run, playerSheet, direction) {
  if (!run || run.status !== "running") {
    return { run, playerSheet, log: "", motion: null };
  }

  const delta = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction];

  if (!delta) {
    return { run, playerSheet, log: "", motion: null };
  }

  const nx = run.player.x + delta.x;
  const ny = run.player.y + delta.y;

  if (!inBounds(nx, ny, run)) {
    return { run, playerSheet, log: "Нельзя выйти за границы квартиры.", motion: null };
  }

  if (isWall(nx, ny, run)) {
    return { run, playerSheet, log: "Стена перекрывает путь.", motion: null };
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
      removeObject(run, object.id);
      run.player.x = nx;
      run.player.y = ny;
      log = isCrit
        ? `КРИТ! ${object.name} повержен (-${playerDamage} HP).`
        : `${object.name} повержен (-${playerDamage} HP).`;
      motion = { kind: "move", from, to: { x: nx, y: ny }, durationMs: 130 };
    } else {
      const nextHp = Math.max(0, playerSheet.stats.HP - object.data.damage);
      playerSheet.stats.HP = nextHp;
      playerSheet.baseStats.HP = nextHp;
      log = isCrit
        ? `КРИТ! ${object.name} получает ${playerDamage}, контрудар на ${object.data.damage}.`
        : `${object.name} получает ${playerDamage}, контрудар на ${object.data.damage}.`;
      motion = { kind: "bounce", from, target: { x: nx, y: ny }, durationMs: 170 };
      if (playerSheet.stats.HP <= 0) {
        run.status = "defeat";
      }
    }
  } else if (object.type === "chest") {
    run.player.x = nx;
    run.player.y = ny;
    removeObject(run, object.id);
    const pool = getLootPool(object.data.lootPool, playerSheet.classId);
    if (pool.length > 0) {
      const loot = randomPick(pool);
      log = `Найдено: ${loot.name}.`;
      run.pendingLoot = { itemId: loot.id, source: object.name };
    } else {
      log = `${object.name} оказался пустым.`;
    }
    motion = { kind: "move", from, to: { x: nx, y: ny }, durationMs: 120 };
  }

  run.turns += 1;

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
  revealAroundPlayer(run, run.visionRange || 2);
  return { run, playerSheet, log, motion };
}
