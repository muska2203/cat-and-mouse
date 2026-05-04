/** Состояние движения / перехода уровня и время — без привязки к глобальному state. */

export function isMotionActive(motion, nowMs) {
  if (!motion) {
    return false;
  }
  if (motion.startMs == null) {
    return true;
  }
  const duration = Math.max(1, motion.durationMs || 0);
  return nowMs - motion.startMs < duration;
}

export function isBlockingMotionActive(motion, nowMs) {
  if (!motion) {
    return false;
  }
  return isMotionActive(motion, nowMs);
}

export function normalizeFinishedAnimationsForRun(run, nowMs) {
  if (!run) {
    return;
  }
  if (run.motion && !isMotionActive(run.motion, nowMs)) {
    run.motion = null;
  }
  if (run.environmentMotion && !isMotionActive(run.environmentMotion, nowMs)) {
    run.environmentMotion = null;
  }
}

export function isLevelTransitionActive(run, nowMs) {
  if (!run || run.status !== "level_complete" || !run.levelTransition) {
    return false;
  }
  const transition = run.levelTransition;
  if (transition.startedMs == null) {
    return true;
  }
  const duration = Math.max(1, transition.durationMs || 0);
  return nowMs - transition.startedMs < duration;
}
