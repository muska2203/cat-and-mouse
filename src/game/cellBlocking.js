import { inBounds, isWall } from "../nav/pathfinding.js?v=0.5.7-pre-alpha";
import { ACTOR_KIND, getBlockingObjectAt } from "./cellObjects.js?v=0.5.7-pre-alpha";

export function defaultCellBlocked(run, x, y, options = {}) {
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

export function isCellBlockedForEnemy(run, x, y, selfId) {
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

export function isCellBlockedForEnemyWithReservations(run, x, y, selfId, occupiedKeys, reservedKeys) {
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
