/**
 * Снимок координат игрока/врагов/стен для предпросмотра движения без изменения мира после отката.
 */

export function snapshotMotionPreviewState(run) {
  const player = { x: Number(run.player.x), y: Number(run.player.y) };
  const enemies = (run.objects || [])
    .filter((o) => o.type === "enemy")
    .map((o) => ({ id: o.id, x: Number(o.x), y: Number(o.y) }));
  const walls = (run.objects || [])
    .filter((o) => o.type === "stone_wall")
    .map((o) => ({ id: o.id, x: Number(o.x), y: Number(o.y) }));
  return { player, enemies, walls };
}

export function restoreMotionPreviewState(run, snap) {
  if (!snap || !run.player) return;
  run.player.x = snap.player.x;
  run.player.y = snap.player.y;
  const objects = run.objects || [];
  for (const o of objects) {
    if (o.type !== "enemy") continue;
    const s = snap.enemies.find((e) => e.id === o.id);
    if (s) {
      o.x = s.x;
      o.y = s.y;
    }
  }
  for (const w of snap.walls) {
    const cur = objects.find((o) => o.id === w.id);
    if (cur) {
      cur.x = w.x;
      cur.y = w.y;
    }
  }
}

export function withMotionPreviewSnapshot(run, fn) {
  const snap = snapshotMotionPreviewState(run);
  try {
    return fn();
  } finally {
    restoreMotionPreviewState(run, snap);
  }
}
