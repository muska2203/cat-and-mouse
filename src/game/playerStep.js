import { computeBasicMeleeDamage } from "../rules.js?v=0.4.5-pre-alpha";
import {
  inBounds,
  isWall,
  isDiagonalCutBlocked,
} from "../nav/pathfinding.js?v=0.4.5-pre-alpha";
import {
  ACTOR_KIND,
  getObjectsAt,
  getBlockingObjectAt,
  removeObject,
} from "./cellObjects.js?v=0.4.5-pre-alpha";
import { getXpForEnemy, applyXpGain } from "./xp.js?v=0.4.5-pre-alpha";
import { applyObjectActivationOnCell } from "./cellActivation.js?v=0.4.5-pre-alpha";
import { revealAroundPlayer } from "./fogReveal.js?v=0.4.5-pre-alpha";

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
    const hit = computeBasicMeleeDamage(playerSheet, run.nextHitMultiplier || 1);
    run.nextHitMultiplier = 1;
    const playerDamage = hit.damage;
    const isCrit = hit.isCrit;
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
