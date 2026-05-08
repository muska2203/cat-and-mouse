/** Состояние движения / перехода уровня и время — без привязки к глобальному state. */
import { ensureRunFxState } from "./runFxState.js?v=0.5.4-pre-alpha";

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
  const fx = ensureRunFxState(run);
  if (fx.motion && !isMotionActive(fx.motion, nowMs)) {
    fx.motion = null;
  }
  if (fx.environmentMotion && !isMotionActive(fx.environmentMotion, nowMs)) {
    fx.environmentMotion = null;
  }
}

export function advanceRunAnimationState(run, nowMs) {
  if (!run) return;
  const fx = ensureRunFxState(run);

  if (fx.motion) {
    if (fx.motion.startMs == null) {
      fx.motion.startMs = nowMs;
    } else if (!isMotionActive(fx.motion, nowMs)) {
      fx.motion = null;
    }
  }

  if (fx.environmentMotion) {
    if (fx.environmentMotion.startMs == null) {
      fx.environmentMotion.startMs = nowMs;
    } else if (!isMotionActive(fx.environmentMotion, nowMs)) {
      fx.environmentMotion = null;
    }
  }

  if (run.status === "level_complete" && fx.levelTransition) {
    if (fx.levelTransition.startedMs == null) {
      fx.levelTransition.startedMs = nowMs;
    }
  }

  if (fx.screenShake) {
    const duration = Math.max(1, Number(fx.screenShake.durationMs || 0));
    if (fx.screenShake.startMs == null) {
      fx.screenShake.startMs = nowMs;
    } else if (nowMs - fx.screenShake.startMs >= duration) {
      fx.screenShake = null;
    }
  }

  if (Array.isArray(fx.floatingTexts) && fx.floatingTexts.length > 0) {
    fx.floatingTexts = fx.floatingTexts.filter((text) => {
      const duration = Math.max(1, Number(text?.durationMs || 0));
      if (text.startMs == null) {
        text.startMs = nowMs;
      }
      return nowMs - text.startMs < duration;
    });
  }
}

export function isLevelTransitionActive(run, nowMs) {
  if (!run || run.status !== "level_complete") {
    return false;
  }
  const fx = ensureRunFxState(run);
  if (!fx.levelTransition) return false;
  const transition = fx.levelTransition;
  if (transition.startedMs == null) {
    return true;
  }
  const duration = Math.max(1, transition.durationMs || 0);
  return nowMs - transition.startedMs < duration;
}
