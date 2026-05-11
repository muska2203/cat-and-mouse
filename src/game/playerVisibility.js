import { inBounds } from "../nav/pathfinding.js?v=0.5.8-pre-alpha";
import { hasLineOfSightOnGrid } from "../nav/lineOfSightPermissive.js?v=0.5.8-pre-alpha";

function ensureBooleanMask(run) {
  const w = run.width;
  const h = run.height;
  if (
    !Array.isArray(run.playerVisibleNow)
    || run.playerVisibleNow.length !== h
    || !Array.isArray(run.playerVisibleNow[0])
    || run.playerVisibleNow[0].length !== w
  ) {
    run.playerVisibleNow = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  }
}

function ensureFogMemory(run) {
  if (!run.fogObjectMemory || typeof run.fogObjectMemory !== "object") {
    run.fogObjectMemory = {};
  }
}

/**
 * Текущее поле зрения игрока (евклидов радиус + LOS), без изменения discovered.
 */
export function computePlayerVisibleMask(run, visionRange) {
  ensureBooleanMask(run);
  const px = run.player.x;
  const py = run.player.y;
  const range = Number.isFinite(Number(visionRange)) ? Number(visionRange) : 6;
  for (let y = 0; y < run.height; y += 1) {
    for (let x = 0; x < run.width; x += 1) {
      run.playerVisibleNow[y][x] = false;
    }
  }
  for (let y = py - range; y <= py + range; y += 1) {
    for (let x = px - range; x <= px + range; x += 1) {
      if (!inBounds(x, y, run)) continue;
      const distance = Math.hypot(x - px, y - py);
      if (distance > range) continue;
      if (hasLineOfSightOnGrid(run.grid, px, py, x, y)) {
        run.playerVisibleNow[y][x] = true;
      }
    }
  }
}

export function isCellVisibleToPlayerNow(run, x, y) {
  return Boolean(run.playerVisibleNow?.[y]?.[x]);
}

/**
 * Если игрок снова видит клетку из памяти, а объекта там уже нет (или он ушёл) — убираем запись.
 */
export function purgeStaleFogMemory(run) {
  ensureFogMemory(run);
  if (!run.playerVisibleNow || !run.fogObjectMemory) {
    return;
  }
  const byId = new Map((run.objects || []).map((o) => [o.id, o]));
  const keys = Object.keys(run.fogObjectMemory);
  for (const id of keys) {
    const pos = run.fogObjectMemory[id];
    if (!pos || !Number.isFinite(Number(pos.x)) || !Number.isFinite(Number(pos.y))) {
      delete run.fogObjectMemory[id];
      continue;
    }
    const mx = Number(pos.x);
    const my = Number(pos.y);
    if (!run.playerVisibleNow?.[my]?.[mx]) continue;
    const obj = byId.get(id);
    if (!obj || Number(obj.x) !== mx || Number(obj.y) !== my) {
      delete run.fogObjectMemory[id];
    }
  }
}

/** Обновляет «память» объектов и цели для тусклого тумана. */
export function syncFogMemoryFromPlayerVision(run) {
  ensureFogMemory(run);
  if (!run.playerVisibleNow || !Array.isArray(run.objects)) {
    return;
  }
  for (const object of run.objects) {
    if (!object?.id) continue;
    if (!run.playerVisibleNow?.[object.y]?.[object.x]) continue;
    run.fogObjectMemory[object.id] = { x: object.x, y: object.y };
  }
  if (run.goal && run.playerVisibleNow?.[run.goal.y]?.[run.goal.x]) {
    run.goalFogMemory = { x: run.goal.x, y: run.goal.y };
  }
}

export function refreshPlayerVisibilityAndFogMemory(run, visionRange) {
  computePlayerVisibleMask(run, visionRange);
  purgeStaleFogMemory(run);
  syncFogMemoryFromPlayerVision(run);
}
