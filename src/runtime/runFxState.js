/**
 * Граница runtime/fx-состояния забега.
 * Держим временные эффекты строго в run.fx.
 */
export function ensureRunFxState(run) {
  if (!run) return null;
  if (!run.fx || typeof run.fx !== "object") {
    run.fx = {};
  }

  const fxKeys = [
    "motion",
    "environmentMotion",
    "environmentNextStepAtMs",
    "floatingTexts",
    "pendingSkillApplications",
    "screenShake",
    "levelTransition",
  ];

  if (!Array.isArray(run.fx.floatingTexts)) {
    run.fx.floatingTexts = [];
  }
  if (!Array.isArray(run.fx.pendingSkillApplications)) {
    run.fx.pendingSkillApplications = [];
  }
  if (run.fx.environmentNextStepAtMs == null) {
    run.fx.environmentNextStepAtMs = 0;
  }

  return run.fx;
}

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Добавляет вылетающий текст с очередью по цели:
 * если по одной клетке прилетает несколько чисел, они идут по очереди.
 */
export function enqueueFloatingText(run, entry, options = {}) {
  const fx = ensureRunFxState(run);
  if (!fx || !entry) return;
  const staggerGapMs = Math.max(0, Number(options.staggerGapMs ?? 200));
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : getNowMs();
  const durationMs = Math.max(1, Number(entry?.durationMs || 0));
  const x = Number(entry?.x);
  const y = Number(entry?.y);
  const hasCell = Number.isFinite(x) && Number.isFinite(y);
  const rawStartMs = entry?.startMs;
  const requestedStartMs = rawStartMs == null ? NaN : Number(rawStartMs);
  const baseStartMs = Number.isFinite(requestedStartMs) ? requestedStartMs : nowMs;

  let nextStartMs = baseStartMs;
  if (hasCell) {
    let latestStartMs = baseStartMs - staggerGapMs;
    for (const text of fx.floatingTexts) {
      if (Number(text?.x) !== x || Number(text?.y) !== y) continue;
      const textStart = Number.isFinite(Number(text?.startMs)) ? Number(text.startMs) : nowMs;
      latestStartMs = Math.max(latestStartMs, textStart);
    }
    nextStartMs = Math.max(baseStartMs, latestStartMs + staggerGapMs);
  }

  fx.floatingTexts.push({
    ...entry,
    startMs: nextStartMs,
    durationMs,
  });
}
