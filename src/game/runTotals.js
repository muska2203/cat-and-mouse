/**
 * Показатели забега, суммируемые по всем этажам (не сбрасываются при смене уровня).
 */

export function ensureRunTotals(run) {
  if (!run || typeof run !== "object") return null;
  if (!run.runTotals) {
    run.runTotals = {
      turnsBeforeCurrentFloor: 0,
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
    };
  }
  return run.runTotals;
}

export function bumpRunTotal(run, key, delta = 1) {
  const t = ensureRunTotals(run);
  if (!t || !key) return;
  t[key] = Math.max(0, Number(t[key] || 0) + delta);
}

/** Перенос суммарной статистики и ходов завершённого этажа в новый run. */
export function mergeRunTotalsForNextFloor(previousRun, nextRun) {
  const prev = previousRun?.runTotals || {};
  const turnsOnFloor = Math.max(0, Number(previousRun?.turns || 0));
  nextRun.runTotals = {
    turnsBeforeCurrentFloor: Math.max(0, Number(prev.turnsBeforeCurrentFloor || 0)) + turnsOnFloor,
    enemiesKilled: Math.max(0, Number(prev.enemiesKilled || 0)),
    chestsOpened: Math.max(0, Number(prev.chestsOpened || 0)),
    itemsPickedUp: Math.max(0, Number(prev.itemsPickedUp || 0)),
  };
}

export function getTotalTurnsAcrossFloors(run) {
  if (!run) return 0;
  const prior = run.runTotals?.turnsBeforeCurrentFloor ?? 0;
  const current = Math.max(0, Number(run.turns || 0));
  return prior + current;
}

/** Значения для экрана итогов (весь забег). */
export function getRunEndingSummaryMetrics(run) {
  const t = run?.runTotals || {};
  return {
    totalTurns: getTotalTurnsAcrossFloors(run),
    enemiesKilled: Math.max(0, Number(t.enemiesKilled || 0)),
    deepestLevel: Math.max(1, Number(run?.level || 1)),
    chestsOpened: Math.max(0, Number(t.chestsOpened || 0)),
    itemsPickedUp: Math.max(0, Number(t.itemsPickedUp || 0)),
  };
}
