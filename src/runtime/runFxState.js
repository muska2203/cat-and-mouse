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
