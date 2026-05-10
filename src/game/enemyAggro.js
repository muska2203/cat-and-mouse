import { inBounds, chebyshevDistance } from "../nav/pathfinding.js?v=0.5.7-pre-alpha";
import { hasLineOfSightOnGrid } from "../nav/lineOfSightPermissive.js?v=0.5.7-pre-alpha";
import { getEnemyDefByType } from "./enemyDefs.js?v=0.5.7-pre-alpha";

/** Покой: идёт к точке спавна. */
export const AI_IDLE = "idle";
/** Преследование: видит цель — идёт к игроку; иначе должен быть переведён в поиск. */
export const AI_PURSUIT = "pursuit";
/** Поиск: идёт к lastSeenPlayer, затем случайно бродит, затем покой. */
export const AI_SEARCH = "search";

const VALID_AI = new Set([AI_IDLE, AI_PURSUIT, AI_SEARCH]);

export function ensureEnemyBrain(enemy) {
  if (!enemy || enemy.type !== "enemy") return;
  const d = enemy.data || {};
  enemy.data = d;
  if (!Number.isFinite(Number(d.homeX))) d.homeX = enemy.x;
  if (!Number.isFinite(Number(d.homeY))) d.homeY = enemy.y;
  const def = getEnemyDefByType(String(d.enemyType || ""));
  const visionFromDef = Number(def?.visionRange);
  if (!Number.isFinite(Number(d.visionRange))) {
    d.visionRange = Number.isFinite(visionFromDef) ? visionFromDef : 6;
  }
  const wanderFromDef = Number(def?.searchWanderTurns);
  if (!Number.isFinite(Number(d.searchWanderTurns))) {
    d.searchWanderTurns = Number.isFinite(wanderFromDef) ? wanderFromDef : 3;
  }
  if (!VALID_AI.has(String(d.aiState || ""))) {
    if (d.aggro === true) {
      d.aiState = AI_PURSUIT;
    } else {
      d.aiState = AI_IDLE;
    }
  }
  if (!d.lastSeenPlayer || !Number.isFinite(Number(d.lastSeenPlayer.x))) {
    d.lastSeenPlayer = null;
  }
  if (!Number.isFinite(Number(d.searchWanderRemaining))) {
    d.searchWanderRemaining = -1;
  }
}

export function cellVisibleFromActor(run, ax, ay, range, tx, ty) {
  if (!run?.grid || !inBounds(ax, ay, run) || !inBounds(tx, ty, run)) return false;
  const dist = Math.hypot(tx - ax, ty - ay);
  if (dist > range) return false;
  return hasLineOfSightOnGrid(run.grid, ax, ay, tx, ty);
}

export function enemySeesPlayer(run, enemy) {
  ensureEnemyBrain(enemy);
  const range = Number(enemy.data.visionRange) || 6;
  return cellVisibleFromActor(run, enemy.x, enemy.y, range, run.player.x, run.player.y);
}

export function enemySeesEnemy(run, viewer, target) {
  if (!viewer || !target || viewer.type !== "enemy" || target.type !== "enemy") return false;
  ensureEnemyBrain(viewer);
  const range = Number(viewer.data.visionRange) || 6;
  return cellVisibleFromActor(run, viewer.x, viewer.y, range, target.x, target.y);
}

/** Передача координат цели: только если source видит peer. */
export function applyPlayerIntel(run, source, peer, intelX, intelY) {
  if (!run || !source || !peer || source.id === peer.id) return;
  if (!enemySeesEnemy(run, source, peer)) return;
  ensureEnemyBrain(peer);
  peer.data.lastSeenPlayer = { x: Number(intelX), y: Number(intelY) };
  if (enemySeesPlayer(run, peer)) {
    peer.data.aiState = AI_PURSUIT;
    peer.data.searchWanderRemaining = -1;
    return;
  }
  peer.data.aiState = AI_SEARCH;
  peer.data.searchWanderRemaining = -1;
}

export function enterPursuit(enemy, playerX, playerY) {
  ensureEnemyBrain(enemy);
  enemy.data.aiState = AI_PURSUIT;
  enemy.data.lastSeenPlayer = { x: Number(playerX), y: Number(playerY) };
  enemy.data.searchWanderRemaining = -1;
}

/** Рассказать всем видимым союзникам, где персонаж (координаты разведки). */
export function broadcastIntelFromSource(run, source, intelX, intelY) {
  if (!run || !source) return;
  const enemies = (run.objects || []).filter((o) => o.type === "enemy");
  for (const peer of enemies) {
    applyPlayerIntel(run, source, peer, intelX, intelY);
  }
}

/** Каждый ход окружения: преследующие, которые видят игрока, передают его координаты видимым котам. */
export function broadcastPursuitIntel(run) {
  if (!run?.player) return;
  const px = run.player.x;
  const py = run.player.y;
  const enemies = (run.objects || []).filter((o) => o.type === "enemy");
  for (const source of enemies) {
    ensureEnemyBrain(source);
    if (source.data.aiState !== AI_PURSUIT || !enemySeesPlayer(run, source)) continue;
    source.data.lastSeenPlayer = { x: px, y: py };
    broadcastIntelFromSource(run, source, px, py);
  }
}

/** После действия игрока: кто видит героя — в преследование; затем передача координат по цепочке видимости. */
export function checkAggroAfterPlayerAction(run) {
  const enemies = (run.objects || []).filter((o) => o.type === "enemy");
  for (const enemy of enemies) {
    ensureEnemyBrain(enemy);
    if (enemySeesPlayer(run, enemy)) {
      enterPursuit(enemy, run.player.x, run.player.y);
    }
  }
  broadcastPursuitIntel(run);
}

export function enemyAtHome(enemy) {
  ensureEnemyBrain(enemy);
  return enemy.x === enemy.data.homeX && enemy.y === enemy.data.homeY;
}

export function enemyInLastKnownVicinity(enemy, last) {
  if (!last) return false;
  return chebyshevDistance(enemy, last) <= 1;
}
