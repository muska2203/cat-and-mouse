import {
  AI_IDLE,
  AI_PURSUIT,
  AI_SEARCH,
} from "../game/enemyAggro.js?v=0.5.8-pre-alpha";
import {
  ensureRunFxState,
  OBJECT_DISSOLVE_DURATION_MS,
} from "./runFxState.js?v=0.5.8-pre-alpha";

const VALID_AI = new Set([AI_IDLE, AI_PURSUIT, AI_SEARCH]);

/** Длительность смены значка фазы ИИ (мс). */
export const ENEMY_AI_BADGE_TRANSITION_MS = 320;

function normalizeEnemyAiState(raw) {
  const s = String(raw || "").trim();
  return VALID_AI.has(s) ? s : AI_IDLE;
}

function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Удаляет записи по врагам, которых больше нет в забеге (и не дорисовываются в objectDissolves).
 */
export function pruneStaleEnemyAiBadgeEntries(run, nowMs) {
  const fx = run?.fx?.enemyAiBadgeById;
  if (!fx || typeof fx !== "object") return;
  const alive = new Set(
    (run.objects || [])
      .filter((o) => o?.type === "enemy")
      .map((o) => String(o.id))
      .filter(Boolean),
  );
  const t = Number(nowMs);
  for (const entry of run.fx?.objectDissolves || []) {
    const ghost = entry?.ghost;
    if (!ghost || ghost.type !== "enemy") continue;
    const gid = String(ghost.id || "");
    if (!gid) continue;
    const start = Number(entry?.startMs || 0);
    const dur = Math.max(1, Number(entry?.durationMs || OBJECT_DISSOLVE_DURATION_MS));
    if (t < start + dur) alive.add(gid);
  }
  for (const key of Object.keys(fx)) {
    if (!alive.has(key)) {
      delete fx[key];
    }
  }
}

/**
 * Обновляет машину переходов для бейджа фазы ИИ (каждый кадр перед отрисовкой врага).
 * @returns {object|null}
 */
function syncEnemyAiBadgePresentation(run, enemy, nowMs) {
  const fx = ensureRunFxState(run);
  if (!fx.enemyAiBadgeById) {
    fx.enemyAiBadgeById = Object.create(null);
  }
  const map = fx.enemyAiBadgeById;
  const id = String(enemy?.id || "");
  if (!id) return null;

  const aiState = normalizeEnemyAiState(enemy?.data?.aiState);

  let entry = map[id];
  if (!entry) {
    map[id] = {
      phase: "stable",
      stableState: aiState,
      fromState: aiState,
      toState: aiState,
      startMs: nowMs,
    };
    entry = map[id];
  }

  const chainNewTransition = () => {
    entry.fromState = entry.stableState;
    entry.toState = aiState;
    entry.startMs = nowMs;
    entry.phase = "transitioning";
  };

  if (entry.phase === "stable") {
    if (aiState !== entry.stableState) {
      chainNewTransition();
    }
    return entry;
  }

  if (entry.toState !== aiState) {
    entry.fromState = entry.toState;
    entry.toState = aiState;
    entry.startMs = nowMs;
    return entry;
  }

  const elapsed = nowMs - entry.startMs;
  if (elapsed >= ENEMY_AI_BADGE_TRANSITION_MS) {
    entry.stableState = entry.toState;
    entry.phase = "stable";
    if (entry.stableState !== aiState) {
      chainNewTransition();
    }
  }

  return entry;
}

function hashSeed(key) {
  const text = String(key || "");
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h % 6283 / 6283 * Math.PI * 2;
}

function drawOutlinedGlyph(ctx, text, x, y, fillHex, strokeRgb, fontPx) {
  ctx.font = `bold ${Math.max(8, Math.floor(fontPx))}px Arial`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const lw = Math.max(2, Math.floor(fontPx * 0.11));
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.strokeStyle = strokeRgb;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillHex;
  ctx.fillText(text, x, y);
}

function drawSleepZs(ctx, anchorX, anchorY, tile, nowMs, seedKey) {
  const basePx = Math.max(9, Math.floor(tile * 0.26));
  const phase = hashSeed(seedKey);
  const drift = Math.sin(nowMs * 0.0033 + phase) * Math.max(0.6, tile * 0.015);
  const layers = [
    { dx: drift * 0.4, dy: 0, scale: 1, alpha: 1 },
    { dx: basePx * 0.38 + drift * 0.25, dy: -basePx * 0.38, scale: 0.82, alpha: 0.92 },
    { dx: basePx * 0.66 + drift * 0.15, dy: -basePx * 0.72, scale: 0.66, alpha: 0.82 },
  ];

  for (const layer of layers) {
    ctx.save();
    ctx.globalAlpha *= layer.alpha;
    ctx.translate(anchorX + layer.dx, anchorY + layer.dy);
    ctx.scale(layer.scale, layer.scale);
    ctx.font = `italic bold ${Math.floor(basePx)}px Arial`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    const lw = Math.max(2, Math.floor(basePx * 0.1));
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(15, 23, 42, 0.72)";
    ctx.strokeText("z", 0, 0);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("z", 0, 0);
    ctx.restore();
  }
}

function drawPhaseGlyph(ctx, state, anchorX, anchorY, tile, nowMs, seedKey) {
  if (state === AI_IDLE) {
    drawSleepZs(ctx, anchorX, anchorY, tile, nowMs, seedKey);
    return;
  }
  const fontPx = Math.max(11, Math.floor(tile * 0.34));
  if (state === AI_PURSUIT) {
    drawOutlinedGlyph(ctx, "!", anchorX, anchorY, "#fecaca", "rgba(51, 10, 10, 0.82)", fontPx);
    return;
  }
  if (state === AI_SEARCH) {
    drawOutlinedGlyph(ctx, "?", anchorX, anchorY, "#fde68a", "rgba(45, 36, 8, 0.82)", fontPx);
  }
}

/**
 * Иконка фазы ИИ: правый верхний угол спрайта в локальных координатах (центр спрайта — начало).
 */
export function drawEnemyAiBehaviorBadge(
  ctx,
  run,
  enemy,
  cx,
  cy,
  enemySpriteSize,
  enemyMoveLeanRad,
  tile,
  nowMs,
) {
  const entry = syncEnemyAiBadgePresentation(run, enemy, nowMs);
  if (!entry) return;

  const inset = Math.max(2, Math.floor(tile * 0.055));
  const half = enemySpriteSize / 2;
  const anchorX = half - inset;
  const anchorY = -half + inset;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(enemyMoveLeanRad);

  let u = 1;
  let fromState = entry.stableState;
  let toState = entry.stableState;
  if (entry.phase === "transitioning") {
    fromState = entry.fromState;
    toState = entry.toState;
    u = smoothstep01((nowMs - entry.startMs) / ENEMY_AI_BADGE_TRANSITION_MS);
  }

  const slide = Math.max(2, tile * 0.055);
  const seedKey = enemy?.id || `${enemy?.x}:${enemy?.y}`;

  if (entry.phase === "transitioning" && u < 0.998 && fromState !== toState) {
    ctx.save();
    ctx.globalAlpha *= 1 - u;
    ctx.translate(0, -slide * (1 - u));
    drawPhaseGlyph(ctx, fromState, anchorX, anchorY, tile, nowMs, seedKey);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha *= u;
    ctx.translate(0, slide * (1 - u));
    drawPhaseGlyph(ctx, toState, anchorX, anchorY, tile, nowMs, seedKey);
    ctx.restore();
  } else {
    drawPhaseGlyph(ctx, toState, anchorX, anchorY, tile, nowMs, seedKey);
  }

  ctx.restore();
}
