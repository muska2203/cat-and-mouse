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
    "objectDissolves",
  ];

  if (!Array.isArray(run.fx.floatingTexts)) {
    run.fx.floatingTexts = [];
  }
  if (!Array.isArray(run.fx.pendingSkillApplications)) {
    run.fx.pendingSkillApplications = [];
  }
  if (!Array.isArray(run.fx.objectDissolves)) {
    run.fx.objectDissolves = [];
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

/** Длительность визуального «растворения» удалённого объекта на поле (мс). */
export const OBJECT_DISSOLVE_DURATION_MS = 420;

/**
 * Снимок объекта для дорисовки после удаления из `run.objects` (только отображение).
 * @param {import("../game/worldObjectModel.js").WorldObject|any} object
 */
function snapshotWorldObjectForDissolve(object) {
  if (!object || typeof object !== "object") {
    return null;
  }
  const data = object.data && typeof object.data === "object" ? { ...object.data } : {};
  return {
    ...object,
    data,
  };
}

/**
 * Ставит короткую анимацию исчезновения для объекта, уже удалённого или вот-вот удаляемого из логики.
 * @param {any} run
 * @param {import("../game/worldObjectModel.js").WorldObject|any} object
 * @param {number} [nowMs]
 */
export function enqueueObjectDissolve(run, object, nowMs) {
  const fx = ensureRunFxState(run);
  if (!fx || !object) {
    return;
  }
  const ghost = snapshotWorldObjectForDissolve(object);
  if (!ghost) {
    return;
  }
  fx.objectDissolves.push({
    startMs: Number.isFinite(Number(nowMs)) ? Number(nowMs) : getNowMs(),
    durationMs: OBJECT_DISSOLVE_DURATION_MS,
    ghost,
  });
}

/**
 * Убирает завершённые дорисовки, чтобы массив не рос без ограничений.
 * @param {any} run
 * @param {number} nowMs
 */
export function pruneFinishedObjectDissolves(run, nowMs) {
  const fx = run?.fx;
  if (!fx || !Array.isArray(fx.objectDissolves)) {
    return;
  }
  const t = Number(nowMs);
  fx.objectDissolves = fx.objectDissolves.filter((entry) => {
    const start = Number(entry?.startMs || 0);
    const durationMs = Math.max(1, Number(entry?.durationMs || OBJECT_DISSOLVE_DURATION_MS));
    return t < start + durationMs;
  });
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
