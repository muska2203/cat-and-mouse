import { isBlockingMotionActive, normalizeFinishedAnimationsForRun } from "./motionTiming.js?v=0.5.3-pre-alpha";
import { ensureRunFxState } from "./runFxState.js?v=0.5.3-pre-alpha";

export function isPlayerInputBlockedByMotion(run, nowMs) {
  if (!run) return true;
  const fx = ensureRunFxState(run);
  normalizeFinishedAnimationsForRun(run, nowMs);
  return Boolean(
    isBlockingMotionActive(fx.motion, nowMs)
    || isBlockingMotionActive(fx.environmentMotion, nowMs),
  );
}

export function isLevelTransitionReady(run, nowMs) {
  if (!run || run.status !== "level_complete") {
    return false;
  }
  const fx = ensureRunFxState(run);
  if (!fx.levelTransition || fx.levelTransition.startedMs == null) {
    return false;
  }
  return nowMs - fx.levelTransition.startedMs >= fx.levelTransition.durationMs;
}

export function isEnvironmentTurnStepReady(run) {
  if (!run || run.status !== "running" || run.turnPhase !== "environment") {
    return false;
  }
  const fx = ensureRunFxState(run);
  return !fx.motion && !fx.environmentMotion;
}
