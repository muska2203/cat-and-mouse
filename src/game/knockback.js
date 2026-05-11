/**
 * Единое разрешение отталкивания врага по направлению на несколько клеток.
 * Столкновение со стеной / непроходимым тайлом / каменной стеной: урон 20% МАКС HP + оглушение 1 ход (двигающийся).
 * Столкновение с другим врагом: по 20% МАКС HP каждому (от своего максимума).
 * Упор в игрока: остановка без дополнительного урона.
 */

import { inBounds, isWall, DIRS_8 } from "../nav/pathfinding.js?v=0.5.8-pre-alpha";
import {
  ACTOR_KIND,
  getBlockingObjectAt,
  getObjectsAt,
  isObjectBlockingForActor,
  removeObject,
} from "./cellObjects.js?v=0.5.8-pre-alpha";
import { ensureEnemyStatus } from "./trapsAndClouds.js?v=0.5.8-pre-alpha";
import { getEnemyMaxHp } from "./enemyDefs.js?v=0.5.8-pre-alpha";
import { applyDamageToEnemyAndResolveDefeat } from "./enemyCombat.js?v=0.5.8-pre-alpha";
import { enqueueFloatingText } from "../runtime/runFxState.js?v=0.5.8-pre-alpha";
import { randomFloat } from "./rng.js?v=0.5.8-pre-alpha";

export function normalizeKnockbackDirection(fromX, fromY, toX, toY) {
  const dx = Number(toX) - Number(fromX);
  const dy = Number(toY) - Number(fromY);
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
  const sx = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
  const sy = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
  return { dx: sx, dy: sy };
}

function crushDamageFromMaxHp(enemy) {
  const maxHp = Math.max(1, Number(getEnemyMaxHp(enemy) || 1));
  return Math.max(1, Math.floor(maxHp * 0.2));
}

/**
 * Клетка для шага отталкиваемой каменной стены (не считая саму стену).
 */
function classifyStoneWallKnockbackStep(run, nx, ny, moverWallId) {
  if (!inBounds(nx, ny, run)) return { kind: "solid" };
  if (isWall(nx, ny, run)) return { kind: "solid" };
  if (run.goal?.x === nx && run.goal?.y === ny) return { kind: "solid" };

  const objects = getObjectsAt(run, nx, ny).filter((o) => o.id !== moverWallId);
  const enemy = objects.find((o) => o.type === "enemy");
  if (enemy) return { kind: "enemy", enemy };
  const otherWall = objects.find((o) => o.type === "stone_wall");
  if (otherWall) return { kind: "stone_wall", wall: otherWall };
  if (run.player?.x === nx && run.player?.y === ny) return { kind: "player" };
  if (objects.some((o) => isObjectBlockingForActor(o, ACTOR_KIND.ENEMY))) {
    return { kind: "solid" };
  }
  return { kind: "free" };
}

/**
 * Отталкивание объекта stone_wall на несколько клеток (как враг по свободным клеткам).
 * При любом столкновении подвижная стена уничтожается; стык с котом — урон коту как при столкновении двух котов.
 * @returns {{ logs: string[], hadCollision: boolean, moved: boolean }}
 */
export function resolveStoneWallKnockback(run, playerSheet, wall, dirX, dirY, distance, options = {}) {
  const logs = [];
  let hadCollision = false;
  const prefix = options.logPrefix ? `${options.logPrefix} ` : "";
  if (!wall || wall.type !== "stone_wall") {
    return { logs, hadCollision: false, moved: false };
  }
  const wallId = wall.id;
  const sx = Number(wall.x);
  const sy = Number(wall.y);
  let x = sx;
  let y = sy;
  let remaining = Math.max(0, Number(distance || 0));

  while (remaining > 0) {
    const nx = x + dirX;
    const ny = y + dirY;
    const hit = classifyStoneWallKnockbackStep(run, nx, ny, wallId);

    if (hit.kind === "free") {
      x = nx;
      y = ny;
      wall.x = x;
      wall.y = y;
      remaining -= 1;
      continue;
    }

    if (hit.kind === "player") {
      removeObject(run, wallId);
      hadCollision = true;
      logs.push(`${prefix}Каменная стена рассыпается у героя.`);
      break;
    }

    if (hit.kind === "solid") {
      removeObject(run, wallId);
      hadCollision = true;
      logs.push(`${prefix}Каменная стена рассыпается о преграду.`);
      break;
    }

    if (hit.kind === "enemy") {
      const other = hit.enemy;
      const dOther = crushDamageFromMaxHp(other);
      const resOther = applyDamageToEnemyAndResolveDefeat(run, playerSheet, other, dOther);
      removeObject(run, wallId);
      hadCollision = true;
      logs.push(
        `${prefix}Столкновение: каменная стена и ${other.name} — ${dOther} урона.${resOther.defeat ? ` ${resOther.defeatLog}` : ""}`,
      );
      pushFloating(run, other.x, other.y, `-${dOther}`, "#f97316");
      break;
    }

    if (hit.kind === "stone_wall") {
      removeObject(run, hit.wall.id);
      removeObject(run, wallId);
      hadCollision = true;
      logs.push(`${prefix}Каменные стены сталкиваются и рассыпаются.`);
      break;
    }

    break;
  }

  const still = (run.objects || []).some((o) => o.id === wallId);
  const moved = still && (Number(wall.x) !== sx || Number(wall.y) !== sy);
  return { logs, hadCollision, moved };
}

function classifyKnockbackCell(run, x, y, moverId) {
  if (!inBounds(x, y, run)) return { kind: "wall" };
  if (isWall(x, y, run)) return { kind: "wall" };
  if (run.goal?.x === x && run.goal?.y === y) return { kind: "wall" };
  if (run.player?.x === x && run.player?.y === y) return { kind: "player" };
  const blocker = getBlockingObjectAt(run, x, y, ACTOR_KIND.ENEMY, moverId);
  if (blocker?.type === "enemy") return { kind: "enemy", enemy: blocker };
  if (blocker && (blocker.type === "stone_wall" || blocker.blocksEnemyMovement === true)) {
    return { kind: "wall" };
  }
  return { kind: "free" };
}

function pushFloating(run, x, y, text, color) {
  enqueueFloatingText(run, {
    x,
    y,
    value: text,
    color,
    durationMs: 620,
    scale: 1.05,
    startMs: null,
  });
}

/**
 * @returns {{ logs: string[], hadCollision: boolean, moved: boolean }}
 */
export function resolveKnockback(run, playerSheet, mover, dirX, dirY, distance, options = {}) {
  const logs = [];
  let hadCollision = false;
  const sx = Number(mover.x);
  const sy = Number(mover.y);
  let x = sx;
  let y = sy;
  const moverId = mover.id;
  let remaining = Math.max(0, Number(distance || 0));
  const prefix = options.logPrefix ? `${options.logPrefix} ` : "";

  while (remaining > 0) {
    const nx = x + dirX;
    const ny = y + dirY;
    const hit = classifyKnockbackCell(run, nx, ny, moverId);
    if (hit.kind === "free") {
      x = nx;
      y = ny;
      remaining -= 1;
      continue;
    }
    if (hit.kind === "player") {
      logs.push(`${prefix}${mover.name} упирается в героя.`);
      break;
    }
    if (hit.kind === "wall") {
      const dmg = crushDamageFromMaxHp(mover);
      const status = ensureEnemyStatus(mover);
      status.stunTurns = Math.max(Number(status.stunTurns || 0), 1);
      const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, mover, dmg);
      hadCollision = true;
      logs.push(
        `${prefix}${mover.name} врезается в преграду: ${dmg} урона, оглушение.${res.defeat ? ` ${res.defeatLog}` : ""}`,
      );
      pushFloating(run, x, y, `-${dmg}`, "#cbd5e1");
      break;
    }
    if (hit.kind === "enemy") {
      const other = hit.enemy;
      const dMove = crushDamageFromMaxHp(mover);
      const dOther = crushDamageFromMaxHp(other);
      const resMove = applyDamageToEnemyAndResolveDefeat(run, playerSheet, mover, dMove);
      const resOther = applyDamageToEnemyAndResolveDefeat(run, playerSheet, other, dOther);
      hadCollision = true;
      logs.push(
        `${prefix}Столкновение: ${mover.name} и ${other.name} получают ${dMove} и ${dOther} урона.${resMove.defeat ? ` ${resMove.defeatLog}` : ""}${resOther.defeat ? ` ${resOther.defeatLog}` : ""}`,
      );
      pushFloating(run, mover.x, mover.y, `-${dMove}`, "#f97316");
      pushFloating(run, other.x, other.y, `-${dOther}`, "#f97316");
      break;
    }
    break;
  }

  const moved = x !== sx || y !== sy;
  mover.x = x;
  mover.y = y;
  return { logs, hadCollision, moved };
}

/**
 * Предпросмотр отталкивания врага: конечная клетка и урон от столкновения без изменения run и mover.
 * @returns {{ endX: number, endY: number, damageMarkers: Array<{ x: number, y: number, damage: number, color: string }> }}
 */
export function peekEnemyKnockbackResolution(run, mover, dirX, dirY, distance) {
  const sx = Number(mover.x);
  const sy = Number(mover.y);
  let x = sx;
  let y = sy;
  const moverId = mover.id;
  let remaining = Math.max(0, Number(distance || 0));
  const damageMarkers = [];

  while (remaining > 0) {
    const nx = x + dirX;
    const ny = y + dirY;
    const hit = classifyKnockbackCell(run, nx, ny, moverId);
    if (hit.kind === "free") {
      x = nx;
      y = ny;
      remaining -= 1;
      continue;
    }
    if (hit.kind === "player") {
      return { endX: x, endY: y, damageMarkers };
    }
    if (hit.kind === "wall") {
      const dmg = crushDamageFromMaxHp(mover);
      damageMarkers.push({ x, y, damage: dmg, color: "#cbd5e1" });
      return { endX: x, endY: y, damageMarkers };
    }
    if (hit.kind === "enemy") {
      const other = hit.enemy;
      const dMove = crushDamageFromMaxHp(mover);
      const dOther = crushDamageFromMaxHp(other);
      damageMarkers.push({ x, y, damage: dMove, color: "#f97316" });
      damageMarkers.push({ x: other.x, y: other.y, damage: dOther, color: "#f97316" });
      return { endX: x, endY: y, damageMarkers };
    }
    break;
  }

  return { endX: x, endY: y, damageMarkers };
}

/**
 * Куда встанет враг после отталкивания — только геометрия (без урона, оглушения, логов, изменения мира).
 * @returns {{ startX: number, startY: number, endX: number, endY: number }}
 */
export function computeKnockbackEndTile(run, mover, dirX, dirY, distance) {
  const sx = Number(mover.x);
  const sy = Number(mover.y);
  let x = sx;
  let y = sy;
  const moverId = mover.id;
  let remaining = Math.max(0, Number(distance || 0));
  while (remaining > 0) {
    const nx = x + dirX;
    const ny = y + dirY;
    const hit = classifyKnockbackCell(run, nx, ny, moverId);
    if (hit.kind === "free") {
      x = nx;
      y = ny;
      remaining -= 1;
      continue;
    }
    break;
  }
  return { startX: sx, startY: sy, endX: x, endY: y };
}

/**
 * Куда сдвинется каменная стена — только геометрия (без урона, удаления объектов).
 * @returns {{ startX: number, startY: number, endX: number, endY: number, moved: boolean }}
 */
export function computeStoneWallKnockbackEndTile(run, wall, dirX, dirY, distance) {
  if (!wall || wall.type !== "stone_wall") {
    const x = Number(wall?.x ?? 0);
    const y = Number(wall?.y ?? 0);
    return { startX: x, startY: y, endX: x, endY: y, moved: false };
  }
  const wallId = wall.id;
  const sx = Number(wall.x);
  const sy = Number(wall.y);
  let x = sx;
  let y = sy;
  let remaining = Math.max(0, Number(distance || 0));
  while (remaining > 0) {
    const nx = x + dirX;
    const ny = y + dirY;
    const hit = classifyStoneWallKnockbackStep(run, nx, ny, wallId);
    if (hit.kind === "free") {
      x = nx;
      y = ny;
      remaining -= 1;
      continue;
    }
    break;
  }
  const moved = x !== sx || y !== sy;
  return { startX: sx, startY: sy, endX: x, endY: y, moved };
}

export function shuffleDirections(rng) {
  const dirs = [...DIRS_8];
  for (let i = dirs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFloat(rng) * (i + 1));
    const t = dirs[i];
    dirs[i] = dirs[j];
    dirs[j] = t;
  }
  return dirs;
}

/**
 * Предпочтительное направление; если нет смещения и не было столкновения — случайные оси.
 */
export function resolveKnockbackWithFallback(run, playerSheet, mover, prefDx, prefDy, distance, rng) {
  const sx = Number(mover.x);
  const sy = Number(mover.y);
  const tryOrder = [];
  if (prefDx !== 0 || prefDy !== 0) {
    tryOrder.push({ dx: prefDx, dy: prefDy });
  }
  for (const d of shuffleDirections(rng || Math.random)) {
    if (tryOrder.some((t) => t.dx === d.x && t.dy === d.y)) continue;
    tryOrder.push({ dx: d.x, dy: d.y });
  }

  const allLogs = [];
  let outcome = { logs: [], hadCollision: false, moved: false };
  for (const { dx, dy } of tryOrder) {
    mover.x = sx;
    mover.y = sy;
    outcome = resolveKnockback(run, playerSheet, mover, dx, dy, distance, {});
    allLogs.push(...outcome.logs);
    if (outcome.moved || outcome.hadCollision) {
      return { logs: allLogs, hadCollision: outcome.hadCollision, moved: outcome.moved };
    }
  }
  return { logs: allLogs.length ? allLogs : [`${mover.name} некуда оттолкнуть.`], hadCollision: false, moved: false };
}
