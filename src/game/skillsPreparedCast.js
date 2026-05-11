/**
 * Расширенные скиллы посоха/меча (план v2): каст через выбранные корни без шаблонов square/single.
 */

import { floorHp, computeBasicMeleeDamage, calculateWeaponDamage } from "../rules.js?v=0.5.8-pre-alpha";
import { syncPlayerHp } from "./syncHp.js?v=0.5.8-pre-alpha";
import { applyDamageToEnemyAndResolveDefeat } from "./enemyCombat.js?v=0.5.8-pre-alpha";
import { ensureRunFxState, enqueueFloatingText } from "../runtime/runFxState.js?v=0.5.8-pre-alpha";
import { hasLineOfSightOnGrid } from "../nav/lineOfSightPermissive.js?v=0.5.8-pre-alpha";
import { computePlayerVisibleMask } from "./playerVisibility.js?v=0.5.8-pre-alpha";
import { ensureEnemyStatus } from "./trapsAndClouds.js?v=0.5.8-pre-alpha";
import {
  DIRS_8,
  chebyshevDistance,
  inBounds,
  isWall,
  isDiagonalCutBlocked,
} from "../nav/pathfinding.js?v=0.5.8-pre-alpha";
import { ACTOR_KIND, getBlockingObjectAt } from "./cellObjects.js?v=0.5.8-pre-alpha";
import {
  normalizeKnockbackDirection,
  peekEnemyKnockbackResolution,
  resolveKnockback,
  resolveStoneWallKnockback,
  computeKnockbackEndTile,
  computeStoneWallKnockbackEndTile,
} from "./knockback.js?v=0.5.8-pre-alpha";
import { withMotionPreviewSnapshot } from "./skillMotionSnapshot.js?v=0.5.8-pre-alpha";
import {
  createStoneWallWorldObject,
  getGridCellsOnSegmentInclusive,
} from "./stoneWallRay.js?v=0.5.8-pre-alpha";
import { randomFloat, randomPick } from "./rng.js?v=0.5.8-pre-alpha";

export const EXTENSION_SKILL_IDS = new Set([
  "ice_spike",
  "stone_wall",
  "shock_wave",
  "chain_lightning",
  "steel_stance",
  "whirlwind",
  "lunge",
  "cleave",
  "supremacy",
]);

function isWallCell(run, x, y) {
  return run?.grid?.[y]?.[x] === 1;
}

function isCellInsideRun(run, x, y) {
  if (!run) return false;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < run.width && y < run.height;
}

function getVisibleCellsForStaff(run, maxRange = 6, includeWalls = false) {
  if (!run?.player || !run?.grid || !Array.isArray(run?.discovered)) return [];
  if (!Array.isArray(run.playerVisibleNow)) {
    computePlayerVisibleMask(run, run.visionRange ?? 6);
  }
  const fromX = Number(run.player.x);
  const fromY = Number(run.player.y);
  const out = [];
  for (let y = 0; y < run.height; y += 1) {
    for (let x = 0; x < run.width; x += 1) {
      if (!run.discovered?.[y]?.[x]) continue;
      if (!run.playerVisibleNow?.[y]?.[x]) continue;
      if (!includeWalls && isWallCell(run, x, y)) continue;
      const dx = Math.abs(x - fromX);
      const dy = Math.abs(y - fromY);
      if (Math.max(dx, dy) > maxRange) continue;
      if (!hasLineOfSightOnGrid(run.grid, fromX, fromY, x, y)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

function findEnemyAt(run, x, y) {
  return (run.objects || []).find((o) => o.type === "enemy" && o.x === x && o.y === y) || null;
}

function findStoneWallAt(run, x, y) {
  return (run.objects || []).find((o) => o.type === "stone_wall" && o.x === x && o.y === y) || null;
}

function isCellStandableForPlayer(run, c) {
  if (!inBounds(c.x, c.y, run)) return false;
  if (isWall(c.x, c.y, run)) return false;
  if (run.goal?.x === c.x && run.goal?.y === c.y) return false;
  return !getBlockingObjectAt(run, c.x, c.y, ACTOR_KIND.PLAYER);
}

/** Отступ с клетки врага: сначала соседи к финальной позиции врага, при необходимости — обход соседних колец. */
function isCellValidLungeRetreatFromAnchor(run, anchorCell, toCell) {
  if (!isCellStandableForPlayer(run, toCell)) return false;
  if (isDiagonalCutBlocked(run, anchorCell.x, anchorCell.y, toCell.x, toCell.y)) return false;
  return true;
}

export function pickPlayerLungeRetreatCell(run, playerStart, anchorCell) {
  const sx = Math.sign(playerStart.x - anchorCell.x);
  const sy = Math.sign(playerStart.y - anchorCell.y);
  const ordered = [];
  const seen = new Set();
  const add = (c) => {
    const k = `${c.x}:${c.y}`;
    if (seen.has(k)) return;
    seen.add(k);
    ordered.push(c);
  };
  if (sx !== 0 && sy !== 0) add({ x: anchorCell.x + sx, y: anchorCell.y + sy });
  if (sx !== 0) add({ x: anchorCell.x + sx, y: anchorCell.y });
  if (sy !== 0) add({ x: anchorCell.x, y: anchorCell.y + sy });
  const neigh = DIRS_8.map((d) => ({ x: anchorCell.x + d.x, y: anchorCell.y + d.y }));
  neigh.sort((a, b) => chebyshevDistance(a, playerStart) - chebyshevDistance(b, playerStart));
  for (const c of neigh) add(c);

  for (const c of ordered) {
    if (isCellValidLungeRetreatFromAnchor(run, anchorCell, c)) return c;
  }
  for (const c of ordered) {
    if (isCellStandableForPlayer(run, c)) return c;
  }

  const queue = [];
  const visited = new Set([`${anchorCell.x}:${anchorCell.y}`]);
  for (const d of DIRS_8) {
    const nx = anchorCell.x + d.x;
    const ny = anchorCell.y + d.y;
    if (!inBounds(nx, ny, run)) continue;
    const k = `${nx}:${ny}`;
    visited.add(k);
    queue.push({ x: nx, y: ny, depth: 1 });
  }
  while (queue.length) {
    const c = queue.shift();
    if (isCellStandableForPlayer(run, c)) return { x: c.x, y: c.y };
    if (c.depth >= 5) continue;
    for (const d of DIRS_8) {
      const nx = c.x + d.x;
      const ny = c.y + d.y;
      const k = `${nx}:${ny}`;
      if (visited.has(k)) continue;
      if (!inBounds(nx, ny, run)) continue;
      visited.add(k);
      queue.push({ x: nx, y: ny, depth: c.depth + 1 });
    }
  }
  return null;
}

function buildDiscreteRayPath(from, to) {
  const cells = [{ x: from.x, y: from.y }];
  let cx = from.x;
  let cy = from.y;
  while (cx !== to.x || cy !== to.y) {
    cx += Math.sign(to.x - cx);
    cy += Math.sign(to.y - cy);
    cells.push({ x: cx, y: cy });
  }
  return cells;
}

function buildLungeSkillMotion(payload) {
  const {
    playerStart,
    hitCell,
    playerEnd,
    enemyId,
    enemyStart,
    enemyEnd,
    enemyDefeated,
  } = payload;
  const enemyCells = enemyDefeated
    ? [{ x: hitCell.x, y: hitCell.y }]
    : buildDiscreteRayPath(enemyStart, enemyEnd);
  const durationMs = enemyDefeated ? 320 : 520;
  const tPlayerHit = enemyDefeated ? 0.34 : 0.28;
  const tEnemyDone = enemyDefeated ? tPlayerHit : 0.76;
  return {
    kind: "lunge_skill",
    durationMs,
    startMs: null,
    tPlayerHit,
    tEnemyDone,
    enemyId: enemyDefeated ? null : enemyId,
    playerStart: { ...playerStart },
    hitCell: { ...hitCell },
    playerEnd: { ...playerEnd },
    enemyCells,
    enemyStart: { ...enemyStart },
    enemyEnd: { ...enemyEnd },
    enemyDefeated: Boolean(enemyDefeated),
  };
}

function assignLungeSkillMotion(fx, payload) {
  const motion = buildLungeSkillMotion(payload);
  motion.startMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  fx.motion = motion;
}

function staffSkillBaseDamage(skillLevel, playerSheet) {
  const level = Math.max(1, Number(skillLevel || 1));
  const intStat = playerSheet?.stats?.INT ?? playerSheet?.baseStats?.INT ?? 0;
  const raw = 8 + intStat * 0.35 + (level - 1) * 2;
  return Math.max(1, Math.round(raw));
}

function chainLightningBase(skillLevel, playerSheet) {
  return staffSkillBaseDamage(skillLevel, playerSheet);
}

function stoneWallBonusSpell(skillLevel, playerSheet) {
  return Math.max(1, Math.round(staffSkillBaseDamage(skillLevel, playerSheet) * 0.35));
}

/** Урон центра «Метеорита» и бонус к заклинанию для порождённой каменной стены (единый источник чисел для UI). */
export function getMeteorSkillNumbers(skillLevel, playerSheet) {
  const level = Math.max(1, Number(skillLevel || 1));
  return {
    centerDamage: staffSkillBaseDamage(level, playerSheet),
    wallBonusSpell: stoneWallBonusSpell(level, playerSheet),
  };
}

const ICE_SPIKE_MAX_RAY_FLOOR_CELLS = 5;

/** Длительности анимации «метеорита» (skillId stone_wall): один источник для плана и buildExtensionSkillMotion. */
const METEOR_PROJECTILE_MS = 220;
const METEOR_IMPACT_MS = 260;

const METEOR_KNOCKBACK_PREVIEW_COLOR = "rgba(251, 191, 36, 0.92)";
const SHOCK_WAVE_KNOCKBACK_PREVIEW_COLOR = "rgba(251, 191, 36, 0.92)";
const SHOCK_WAVE_WALL_PREVIEW_COLOR = "rgba(148, 163, 184, 0.88)";
const LUNGE_KNOCKBACK_PREVIEW_COLOR = "rgba(251, 191, 36, 0.92)";
const LUNGE_PLAYER_PREVIEW_COLOR = "rgba(96, 165, 250, 0.92)";

/**
 * Единый план прицела/превью/каста «метеорита» (stone_wall): motion, стрелки смещения, клетки урона, фазы применения.
 * @returns {{ ok: true, roots: Array, cell: {x,y}, skillLevel: number, motion: object, motionArrows: Array, previewByCell: Array, applyPhases: Array } | { ok: false, log: string }}
 */
export function buildStoneWallMeteorResolvedPlan(run, playerSheet, skillLevel, selectedRoots) {
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  if (roots.length !== 1) {
    return { ok: false, log: "Выбери клетку для метеорита." };
  }
  const tx = roots[0].x;
  const ty = roots[0].y;
  const targets = getExtensionSkillTargets(run, playerSheet, "stone_wall");
  if (!targets.some((c) => c.x === tx && c.y === ty)) {
    return { ok: false, log: "Клетка вне обзора для метеорита." };
  }

  const level = Math.max(1, Number(skillLevel || 1));
  const { centerDamage } = getMeteorSkillNumbers(level, playerSheet);
  const from = { x: Number(run.player.x), y: Number(run.player.y) };
  const to = { x: tx, y: ty };
  const motion = {
    kind: "skill_cast",
    skillId: "stone_wall",
    from,
    segmentGroups: [{
      startOffsetMs: 0,
      segments: [
        { kind: "projectile", style: "meteor", from, to, durationMs: METEOR_PROJECTILE_MS },
        { kind: "impact", style: "meteor_crater", center: { ...to }, durationMs: METEOR_IMPACT_MS },
      ],
    }],
    durationMs: METEOR_PROJECTILE_MS + METEOR_IMPACT_MS,
    startMs: null,
  };

  const motionArrows = withMotionPreviewSnapshot(run, () => {
    const arrows = [];
    for (const d of DIRS_8) {
      const x = tx + d.x;
      const y = ty + d.y;
      const ringEnemy = findEnemyAt(run, x, y);
      if (!ringEnemy) continue;
      const pref = normalizeKnockbackDirection(tx, ty, x, y);
      const { startX, startY, endX, endY } = computeKnockbackEndTile(run, ringEnemy, pref.dx, pref.dy, 1);
      if (endX !== startX || endY !== startY) {
        arrows.push({
          fromX: startX,
          fromY: startY,
          toX: endX,
          toY: endY,
          color: METEOR_KNOCKBACK_PREVIEW_COLOR,
        });
      }
      ringEnemy.x = endX;
      ringEnemy.y = endY;
    }
    return arrows;
  });

  const previewByCell = withMotionPreviewSnapshot(run, () => {
    const byCell = new Map();
    const centerEnemy = findEnemyAt(run, tx, ty);
    if (centerEnemy) {
      const k = `${tx}:${ty}`;
      byCell.set(k, {
        x: tx,
        y: ty,
        role: "splash",
        targetDamage: centerDamage,
        statusEffects: [],
      });
    }
    for (const d of DIRS_8) {
      const x = tx + d.x;
      const y = ty + d.y;
      const ringEnemy = findEnemyAt(run, x, y);
      if (!ringEnemy) continue;
      const pref = normalizeKnockbackDirection(tx, ty, x, y);
      const peek = peekEnemyKnockbackResolution(run, ringEnemy, pref.dx, pref.dy, 1);
      for (const m of peek.damageMarkers) {
        const dmg = Math.max(0, floorHp(m.damage));
        if (dmg <= 0) continue;
        const key = `${m.x}:${m.y}`;
        const prev = byCell.get(key) || {
          x: m.x,
          y: m.y,
          role: "splash",
          targetDamage: 0,
          statusEffects: [],
        };
        prev.targetDamage += dmg;
        byCell.set(key, prev);
      }
      ringEnemy.x = peek.endX;
      ringEnemy.y = peek.endY;
    }
    return Array.from(byCell.values());
  });

  const applyPhases = [
    { kind: "meteor_center_damage" },
    { kind: "meteor_ring_knockbacks" },
    { kind: "meteor_try_spawn_wall" },
  ];

  return {
    ok: true,
    skillId: "stone_wall",
    roots,
    cell: { x: tx, y: ty },
    skillLevel: level,
    motion,
    motionArrows,
    previewByCell,
    applyPhases,
  };
}

function executeStoneWallMeteorResolvedPlan(run, playerSheet, skill, plan, fx) {
  const logs = [];
  const tx = plan.cell.x;
  const ty = plan.cell.y;
  const skillLevel = plan.skillLevel;
  const { centerDamage: meteorDmg, wallBonusSpell: bonus } = getMeteorSkillNumbers(skillLevel, playerSheet);
  const centerEnemyBefore = findEnemyAt(run, tx, ty);

  for (const phase of plan.applyPhases) {
    if (phase.kind === "meteor_center_damage") {
      const centerEnemy = findEnemyAt(run, tx, ty);
      if (centerEnemy) {
        const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, centerEnemy, meteorDmg);
        logs.push(`${centerEnemy.name}: ${meteorDmg} урона.${res.defeat ? ` ${res.defeatLog}` : ""}`);
        enqueueFloatingText(run, {
          x: tx,
          y: ty,
          value: `-${meteorDmg}`,
          color: "#fb923c",
          durationMs: 700,
          scale: 1.08,
          startMs: null,
        });
      }
    } else if (phase.kind === "meteor_ring_knockbacks") {
      for (const d of DIRS_8) {
        const x = tx + d.x;
        const y = ty + d.y;
        const ringEnemy = findEnemyAt(run, x, y);
        if (!ringEnemy) continue;
        const pref = normalizeKnockbackDirection(tx, ty, x, y);
        const kb = resolveKnockback(run, playerSheet, ringEnemy, pref.dx, pref.dy, 1, {});
        logs.push(...kb.logs);
      }
    } else if (phase.kind === "meteor_try_spawn_wall") {
      const stillEnemy = findEnemyAt(run, tx, ty);
      const canWall =
        inBounds(tx, ty, run)
        && !isWall(tx, ty, run)
        && !(run.player?.x === tx && run.player?.y === ty)
        && !(run.goal?.x === tx && run.goal?.y === ty)
        && !stillEnemy
        && !getBlockingObjectAt(run, tx, ty, ACTOR_KIND.PLAYER);
      if (canWall) {
        run.objects.push(createStoneWallWorldObject(run, tx, ty, bonus, 3));
        logs.push("На месте удара возникает каменная стена.");
      } else if (!centerEnemyBefore && !stillEnemy) {
        logs.push("Стена не создана: клетка занята.");
      } else if (stillEnemy) {
        logs.push("Враг устоял — каменная стена не создана.");
      }
    }
  }

  const motion = { ...plan.motion };
  motion.startMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  fx.motion = motion;
  run.lastLog = logsJoin(logs) || `${skill.name}: удар.`;
  return { ok: true, log: run.lastLog, actionConsumed: true };
}

function buildShockWaveMotionArrowsForPlan(run) {
  const px = Number(run.player.x);
  const py = Number(run.player.y);
  return withMotionPreviewSnapshot(run, () => {
    const arrows = [];
    for (const d of DIRS_8) {
      const x = px + d.x;
      const y = py + d.y;
      const enemy = findEnemyAt(run, x, y);
      if (enemy) {
        const dir = normalizeKnockbackDirection(px, py, x, y);
        const { startX, startY, endX, endY } = computeKnockbackEndTile(run, enemy, dir.dx, dir.dy, 2);
        if (endX !== startX || endY !== startY) {
          arrows.push({
            fromX: startX,
            fromY: startY,
            toX: endX,
            toY: endY,
            color: SHOCK_WAVE_KNOCKBACK_PREVIEW_COLOR,
          });
        }
        enemy.x = endX;
        enemy.y = endY;
        continue;
      }
      const wall = findStoneWallAt(run, x, y);
      if (wall) {
        const dir = normalizeKnockbackDirection(px, py, x, y);
        const { startX, startY, endX, endY, moved } = computeStoneWallKnockbackEndTile(
          run,
          wall,
          dir.dx,
          dir.dy,
          2,
        );
        if (moved) {
          arrows.push({
            fromX: startX,
            fromY: startY,
            toX: endX,
            toY: endY,
            color: SHOCK_WAVE_WALL_PREVIEW_COLOR,
          });
          wall.x = endX;
          wall.y = endY;
        }
      }
    }
    return arrows;
  });
}

function buildLungeMotionArrowsForPlan(run, playerSheet, roots) {
  if (roots.length !== 1) return [];
  const tx = roots[0].x;
  const ty = roots[0].y;
  const enemy = findEnemyAt(run, tx, ty);
  if (!enemy) return [];
  const playerStart = { x: Number(run.player.x), y: Number(run.player.y) };
  const hitCell = { x: tx, y: ty };
  const hit = computeBasicMeleeDamage(playerSheet, 1, () => 0, { forcedCrit: false });
  const dmg = hit.damage;
  const hp = floorHp(enemy.data?.hp || 0);
  const wouldKill = dmg >= hp;

  return withMotionPreviewSnapshot(run, () => {
    const arrows = [];
    if (!wouldKill) {
      const pref = normalizeKnockbackDirection(playerStart.x, playerStart.y, tx, ty);
      const { startX, startY, endX, endY } = computeKnockbackEndTile(run, enemy, pref.dx, pref.dy, 2);
      if (endX !== startX || endY !== startY) {
        arrows.push({
          fromX: startX,
          fromY: startY,
          toX: endX,
          toY: endY,
          color: LUNGE_KNOCKBACK_PREVIEW_COLOR,
        });
      }
      enemy.x = endX;
      enemy.y = endY;
    }
    const anchorCell = wouldKill ? { ...hitCell } : { x: enemy.x, y: enemy.y };
    const retreat = pickPlayerLungeRetreatCell(run, playerStart, anchorCell);
    const playerEnd = retreat ? { x: retreat.x, y: retreat.y } : { ...playerStart };
    if (playerEnd.x !== playerStart.x || playerEnd.y !== playerStart.y) {
      arrows.push({
        fromX: playerStart.x,
        fromY: playerStart.y,
        toX: playerEnd.x,
        toY: playerEnd.y,
        color: LUNGE_PLAYER_PREVIEW_COLOR,
      });
    }
    return arrows;
  });
}

function pickChainLightningCandidateDeterministic(run, originX, originY, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const scored = candidates.map((c) => {
    if (c.kind === "player") {
      const dist = chebyshevDistance({ x: originX, y: originY }, run.player);
      return { c, dist, isPlayer: 1, idKey: "__player__" };
    }
    const e = c.enemy;
    const dist = chebyshevDistance({ x: originX, y: originY }, e);
    return { c, dist, isPlayer: 0, idKey: String(e.id) };
  });
  scored.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    if (a.isPlayer !== b.isPlayer) return a.isPlayer - b.isPlayer;
    return a.idKey.localeCompare(b.idKey);
  });
  return scored[0].c;
}

function buildChainLightningMotionFromPath(pathCells) {
  if (!Array.isArray(pathCells) || pathCells.length < 2) return null;
  const hopProjectileMs = 118;
  const hitImpactMs = 92;
  const segments = [];
  for (let i = 0; i < pathCells.length - 1; i += 1) {
    const from = { x: Number(pathCells[i].x), y: Number(pathCells[i].y) };
    const to = { x: Number(pathCells[i + 1].x), y: Number(pathCells[i + 1].y) };
    segments.push({
      kind: "projectile",
      style: "chain_lightning",
      from,
      to,
      durationMs: hopProjectileMs,
    });
    segments.push({
      kind: "impact",
      style: "chain_lightning_hit",
      center: { ...to },
      durationMs: hitImpactMs,
    });
  }
  const durationMs = segments.reduce((acc, seg) => acc + Math.max(1, Number(seg.durationMs || 0)), 0);
  return {
    kind: "skill_cast",
    skillId: "chain_lightning",
    from: { x: pathCells[0].x, y: pathCells[0].y },
    segmentGroups: [{ startOffsetMs: 0, segments }],
    durationMs,
    startMs: null,
  };
}

/** Превью цепи: детерминированный выбор следующей цели (каст — через randomPick). */
function simulateChainLightningPreview(run, playerSheet, skillLevel, roots) {
  if (roots.length !== 1) return { pathCells: [], previewByCell: [] };
  const first = findEnemyAt(run, roots[0].x, roots[0].y);
  if (!first) return { pathCells: [], previewByCell: [] };
  const totalHits = Math.min(4, Math.max(2, skillLevel + 1));
  const base = chainLightningBase(skillLevel, playerSheet);
  let originX = first.x;
  let originY = first.y;
  const hitIds = new Set();
  const pathCells = [{ x: run.player.x, y: run.player.y }, { x: first.x, y: first.y }];
  const byCell = new Map();

  const addDamage = (x, y, dmg) => {
    const key = `${x}:${y}`;
    const prev = byCell.get(key) || {
      x,
      y,
      role: "splash",
      targetDamage: 0,
      statusEffects: [],
    };
    prev.targetDamage += dmg;
    byCell.set(key, prev);
  };

  const dmgForMult = (mult) => Math.max(1, Math.floor(base * mult));
  addDamage(first.x, first.y, dmgForMult(1));
  hitIds.add(first.id);

  let hitIndex = 2;
  while (hitIndex <= totalHits) {
    const candidates = [];
    for (const o of run.objects || []) {
      if (o.type !== "enemy") continue;
      if (hitIds.has(o.id)) continue;
      if (chebyshevDistance({ x: originX, y: originY }, o) <= 4) {
        candidates.push({ kind: "enemy", enemy: o });
      }
    }
    if (!hitIds.has("__player__") && chebyshevDistance({ x: originX, y: originY }, run.player) <= 4) {
      candidates.push({ kind: "player" });
    }
    if (candidates.length === 0) break;
    const pick = pickChainLightningCandidateDeterministic(run, originX, originY, candidates);
    if (pick.kind === "player") {
      addDamage(run.player.x, run.player.y, dmgForMult(hitIndex));
      hitIds.add("__player__");
      originX = run.player.x;
      originY = run.player.y;
      pathCells.push({ x: run.player.x, y: run.player.y });
    } else {
      const e = pick.enemy;
      addDamage(e.x, e.y, dmgForMult(hitIndex));
      hitIds.add(e.id);
      originX = e.x;
      originY = e.y;
      pathCells.push({ x: e.x, y: e.y });
    }
    hitIndex += 1;
  }

  return { pathCells, previewByCell: Array.from(byCell.values()) };
}

/**
 * Клетки ледяного шипа: все проходимые клетки сетки, через которые проходит отрезок
 * от героя к точке прицела (Брезенхам, как у каменной стены / огненного луча по сетке),
 * не более ICE_SPIKE_MAX_RAY_FLOOR_CELLS подряд; стена на карте обрывает луч (клетку стены не включаем).
 */
export function buildIceSpikeRayCells(run, aimX, aimY) {
  const px = Number(run.player.x);
  const py = Number(run.player.y);
  const tx = Number(aimX);
  const ty = Number(aimY);
  if (!isCellInsideRun(run, tx, ty)) return [];
  if (tx === px && ty === py) return [];
  const line = getGridCellsOnSegmentInclusive(px, py, tx, ty);
  const out = [];
  let floors = 0;
  for (const c of line) {
    if (c.x === px && c.y === py) continue;
    if (!isCellInsideRun(run, c.x, c.y)) break;
    if (isWallCell(run, c.x, c.y)) break;
    out.push({ x: c.x, y: c.y, role: "ray", rootX: tx, rootY: ty });
    floors += 1;
    if (floors >= ICE_SPIKE_MAX_RAY_FLOOR_CELLS) break;
  }
  return out;
}

export function getExtensionSkillTargets(run, playerSheet, skillId) {
  if (!run?.player) return [];
  const px = run.player.x;
  const py = run.player.y;

  if (skillId === "ice_spike") {
    const ICE_SPIKE_AIM_RANGE = 12;
    return getVisibleCellsForStaff(run, ICE_SPIKE_AIM_RANGE, true).filter((c) => c.x !== px || c.y !== py);
  }
  if (skillId === "stone_wall") {
    const px = Number(run.player.x);
    const py = Number(run.player.y);
    const maxCheb = Math.max(12, Number(run.visionRange ?? 6) + 4);
    return getVisibleCellsForStaff(run, maxCheb, false).filter((c) => c.x !== px || c.y !== py);
  }
  if (skillId === "shock_wave" || skillId === "whirlwind" || skillId === "steel_stance") {
    return [{ x: px, y: py }];
  }
  if (skillId === "chain_lightning" || skillId === "supremacy") {
    const visibleCells = new Set(
      getVisibleCellsForStaff(run, 20).map((c) => `${c.x}:${c.y}`),
    );
    return (run.objects || [])
      .filter((o) => o.type === "enemy")
      .filter((e) => visibleCells.has(`${e.x}:${e.y}`))
      .map((e) => ({ x: e.x, y: e.y }));
  }
  if (skillId === "lunge") {
    const targets = [];
    const deltas = [
      [2, 0], [-2, 0], [0, 2], [0, -2],
      [2, 2], [2, -2], [-2, 2], [-2, -2],
    ];
    for (const [adx, ady] of deltas) {
      const x = px + adx;
      const y = py + ady;
      if (!isCellInsideRun(run, x, y)) continue;
      if (findEnemyAt(run, x, y)) targets.push({ x, y });
    }
    return targets;
  }
  if (skillId === "cleave") {
    return DIRS_8.map((d) => ({ x: px + d.x, y: py + d.y }))
      .filter((c) => isCellInsideRun(run, c.x, c.y))
      .filter((c) => findEnemyAt(run, c.x, c.y));
  }
  return [];
}

export function getExtensionSkillAffectedCells(run, skillId, rootX, rootY) {
  if (skillId === "ice_spike") {
    return buildIceSpikeRayCells(run, rootX, rootY);
  }
  if (skillId === "stone_wall") {
    const cx = Number(rootX);
    const cy = Number(rootY);
    const ring = DIRS_8.map((d) => ({
      x: cx + d.x,
      y: cy + d.y,
      role: "ring",
      rootX: cx,
      rootY: cy,
    })).filter((c) => isCellInsideRun(run, c.x, c.y));
    return [{ x: cx, y: cy, role: "epicenter", rootX: cx, rootY: cy }, ...ring];
  }
  if (skillId === "shock_wave" || skillId === "whirlwind") {
    const px = run.player.x;
    const py = run.player.y;
    return DIRS_8.map((d) => ({
      x: px + d.x,
      y: py + d.y,
      role: "ring",
      rootX,
      rootY,
    })).filter((c) => isCellInsideRun(run, c.x, c.y));
  }
  return [{ x: rootX, y: rootY, role: "epicenter", rootX, rootY }];
}

function aggregateIceSpikePreview(run, playerSheet, skill, instanceData, selectedRoots) {
  const skillLevel = Math.max(1, Number(instanceData?.skillLevels?.[skill.id] ?? skill.level ?? 1));
  const base = staffSkillBaseDamage(skillLevel, playerSheet);
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  if (roots.length === 0) return null;
  const ray = buildIceSpikeRayCells(run, roots[0].x, roots[0].y);
  let slot = 0;
  const byCell = [];
  for (const cell of ray) {
    const enemy = findEnemyAt(run, cell.x, cell.y);
    if (!enemy) continue;
    const dmg = Math.max(1, Math.floor(base / (2 ** slot)));
    slot += 1;
    byCell.push({
      x: cell.x,
      y: cell.y,
      role: "splash",
      targetDamage: dmg,
      statusEffects: [],
    });
  }
  return { byCell };
}

/**
 * Общий план расширенного скилла: превью по клеткам, motion (без startMs), стрелки смещения.
 * Цепная молния: превью по детерминированному выбору целей (для UI); при касте используется RNG.
 */
export function buildExtensionSkillResolvedPlan(run, playerSheet, skill, instanceData, selectedRoots) {
  const skillId = skill.id;
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  const skillLevel = Math.max(1, Number(instanceData?.skillLevels?.[skillId] ?? skill.level ?? 1));

  if (!EXTENSION_SKILL_IDS.has(skillId)) {
    return { ok: false, log: "Скилл не в списке расширений." };
  }

  if (skillId === "ice_spike") {
    if (roots.length !== 1) {
      return { ok: false, log: "Выбери клетку прицела для ледяного шипа." };
    }
    const motion = buildExtensionSkillMotion(skillId, run, roots);
    const agg = aggregateIceSpikePreview(run, playerSheet, skill, instanceData, roots);
    const previewByCell = agg?.byCell || [];
    return {
      ok: true,
      skillId,
      roots,
      skillLevel,
      motion,
      motionArrows: [],
      previewByCell,
      applyPhases: [{ kind: "ext_ice_spike" }],
    };
  }

  if (skillId === "stone_wall") {
    const p = buildStoneWallMeteorResolvedPlan(run, playerSheet, skillLevel, roots);
    if (!p.ok) return p;
    return { ...p, skillId: "stone_wall" };
  }

  if (skillId === "shock_wave") {
    const base = staffSkillBaseDamage(skillLevel, playerSheet);
    const cells = getExtensionSkillAffectedCells(run, skillId, run.player.x, run.player.y);
    const previewByCell = [];
    for (const c of cells) {
      if (!findEnemyAt(run, c.x, c.y)) continue;
      previewByCell.push({
        x: c.x,
        y: c.y,
        role: "splash",
        targetDamage: base,
        statusEffects: [],
      });
    }
    return {
      ok: true,
      skillId,
      roots: [],
      skillLevel,
      motion: buildExtensionSkillMotion(skillId, run, []),
      motionArrows: buildShockWaveMotionArrowsForPlan(run),
      previewByCell,
      applyPhases: [{ kind: "ext_shock_wave" }],
    };
  }

  if (skillId === "whirlwind") {
    const weaponItem = playerSheet?.loadout?.find((i) => i.type === "weapon");
    const stats = playerSheet?.stats || {};
    const base = calculateWeaponDamage(weaponItem, stats);
    const cells = getExtensionSkillAffectedCells(run, skillId, run.player.x, run.player.y);
    const previewByCell = [];
    for (const c of cells) {
      if (!findEnemyAt(run, c.x, c.y)) continue;
      previewByCell.push({
        x: c.x,
        y: c.y,
        role: "splash",
        targetDamage: base,
        statusEffects: [],
      });
    }
    return {
      ok: true,
      skillId,
      roots: [],
      skillLevel,
      motion: buildExtensionSkillMotion(skillId, run, []),
      motionArrows: [],
      previewByCell,
      applyPhases: [{ kind: "ext_whirlwind" }],
    };
  }

  if (skillId === "steel_stance") {
    return {
      ok: true,
      skillId,
      roots,
      skillLevel,
      motion: buildExtensionSkillMotion(skillId, run, roots),
      motionArrows: [],
      previewByCell: [],
      applyPhases: [{ kind: "ext_steel_stance" }],
    };
  }

  if (skillId === "chain_lightning") {
    if (roots.length !== 1) {
      return { ok: false, log: "Выбери первую цель для молнии." };
    }
    const first = findEnemyAt(run, roots[0].x, roots[0].y);
    if (!first) {
      return { ok: false, log: "На клетке нет врага." };
    }
    const sim = simulateChainLightningPreview(run, playerSheet, skillLevel, roots);
    const motion = buildChainLightningMotionFromPath(sim.pathCells);
    return {
      ok: true,
      skillId,
      roots,
      skillLevel,
      motion,
      motionArrows: [],
      previewByCell: sim.previewByCell,
      applyPhases: [{ kind: "ext_chain_lightning" }],
    };
  }

  if (skillId === "lunge") {
    if (roots.length !== 1) {
      return { ok: false, log: "Выбери цель выпада." };
    }
    const enemy = findEnemyAt(run, roots[0].x, roots[0].y);
    if (!enemy) {
      return { ok: false, log: "Нужен враг на дистанции 2." };
    }
    const weaponItem = playerSheet?.loadout?.find((i) => i.type === "weapon");
    const stats = playerSheet?.stats || {};
    const base = calculateWeaponDamage(weaponItem, stats);
    return {
      ok: true,
      skillId,
      roots,
      skillLevel,
      motion: null,
      motionArrows: buildLungeMotionArrowsForPlan(run, playerSheet, roots),
      previewByCell: [{
        x: roots[0].x,
        y: roots[0].y,
        role: "splash",
        targetDamage: base,
        statusEffects: [],
      }],
      applyPhases: [{ kind: "ext_lunge" }],
    };
  }

  if (skillId === "cleave") {
    if (roots.length !== 1) {
      return { ok: false, log: "Выбери соседа для рассечения." };
    }
    const enemy = findEnemyAt(run, roots[0].x, roots[0].y);
    if (!enemy) {
      return { ok: false, log: "Рядом нет врага." };
    }
    const weaponItem = playerSheet?.loadout?.find((i) => i.type === "weapon");
    const stats = playerSheet?.stats || {};
    const base = Math.max(1, Math.floor(calculateWeaponDamage(weaponItem, stats) * 1.35));
    return {
      ok: true,
      skillId,
      roots,
      skillLevel,
      motion: buildExtensionSkillMotion(skillId, run, roots),
      motionArrows: [],
      previewByCell: [{
        x: roots[0].x,
        y: roots[0].y,
        role: "splash",
        targetDamage: base,
        statusEffects: [],
      }],
      applyPhases: [{ kind: "ext_cleave" }],
    };
  }

  if (skillId === "supremacy") {
    if (roots.length !== 1) {
      return { ok: false, log: "Выбери видимого врага." };
    }
    const enemy = findEnemyAt(run, roots[0].x, roots[0].y);
    if (!enemy) {
      return { ok: false, log: "Цель не найдена." };
    }
    return {
      ok: true,
      skillId,
      roots,
      skillLevel,
      motion: buildExtensionSkillMotion(skillId, run, roots),
      motionArrows: [],
      previewByCell: [],
      applyPhases: [{ kind: "ext_supremacy" }],
    };
  }

  return { ok: false, log: "План для этого скилла не задан." };
}

/** Превью урона для расширенных скиллов (агрегатор для UI). */
export function aggregateExtendedSkillPreview(run, playerSheet, skill, instanceData, skillId, selectedRoots) {
  void skillId;
  const plan = buildExtensionSkillResolvedPlan(run, playerSheet, skill, instanceData, selectedRoots);
  if (!plan.ok || !plan.previewByCell?.length) return null;
  return { byCell: plan.previewByCell };
}

function applyDamageToPlayer(run, playerSheet, damage, skillName) {
  const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
  const nextHp = floorHp(hpNow - damage);
  syncPlayerHp(playerSheet, nextHp);
  enqueueFloatingText(run, {
    x: run.player.x,
    y: run.player.y,
    value: `-${damage}`,
    color: "#93c5fd",
    durationMs: 700,
    scale: 1.1,
    startMs: null,
  });
  return { nextHp, log: `${skillName}: мышонок получает ${damage} урона.` };
}

function assignExtensionCastMotion(fx, skillId, run, selectedRoots) {
  const motion = buildExtensionSkillMotion(skillId, run, selectedRoots);
  if (!motion || !fx) return;
  motion.startMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  fx.motion = motion;
}

/** Анимация цепной молнии: последовательные рёбра между целями в порядке ударов (от героя к первой цели и далее). */
function assignChainLightningMotion(fx, pathCells) {
  const motion = buildChainLightningMotionFromPath(pathCells);
  if (!motion || !fx) return;
  motion.startMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  fx.motion = motion;
}

/** Клетки кольца вокруг игрока (для превью эффектов на поле). */
function ringNeighborCellsForPlayer(run) {
  if (!run?.player) return [];
  const px = Number(run.player.x);
  const py = Number(run.player.y);
  return DIRS_8.map((d) => ({ x: px + d.x, y: py + d.y })).filter((c) => isCellInsideRun(run, c.x, c.y));
}

export function buildExtensionSkillMotion(skillId, run, selectedRoots) {
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  if (!run?.player) return null;
  const from = { x: Number(run.player.x), y: Number(run.player.y) };

  if (skillId === "shock_wave") {
    const affectedCells = ringNeighborCellsForPlayer(run);
    const dur = 340;
    return {
      kind: "skill_cast",
      skillId,
      from,
      segmentGroups: [{
        startOffsetMs: 0,
        segments: [
          {
            kind: "impact",
            style: "shock_wave_ring",
            center: { ...from },
            affectedCells,
            durationMs: dur,
          },
        ],
      }],
      durationMs: dur,
      startMs: null,
    };
  }

  if (skillId === "whirlwind") {
    const affectedCells = ringNeighborCellsForPlayer(run);
    const dur = 420;
    return {
      kind: "skill_cast",
      skillId,
      from,
      segmentGroups: [{
        startOffsetMs: 0,
        segments: [
          {
            kind: "impact",
            style: "whirlwind_spin",
            center: { ...from },
            affectedCells,
            durationMs: dur,
          },
        ],
      }],
      durationMs: dur,
      startMs: null,
    };
  }

  if (skillId === "steel_stance") {
    const cx = roots[0] ? Number(roots[0].x) : from.x;
    const cy = roots[0] ? Number(roots[0].y) : from.y;
    const dur = 380;
    return {
      kind: "skill_cast",
      skillId,
      from,
      segmentGroups: [{
        startOffsetMs: 0,
        segments: [
          {
            kind: "impact",
            style: "steel_stance_pulse",
            center: { x: cx, y: cy },
            durationMs: dur,
          },
        ],
      }],
      durationMs: dur,
      startMs: null,
    };
  }

  if (skillId === "cleave") {
    if (roots.length === 0) return null;
    const to = { x: Number(roots[0].x), y: Number(roots[0].y) };
    const dur = 280;
    return {
      kind: "skill_cast",
      skillId,
      from,
      segmentGroups: [{
        startOffsetMs: 0,
        segments: [
          { kind: "impact", style: "cleave_arc", center: to, durationMs: dur },
        ],
      }],
      durationMs: dur,
      startMs: null,
    };
  }

  if (skillId === "supremacy") {
    if (roots.length === 0) return null;
    const to = { x: Number(roots[0].x), y: Number(roots[0].y) };
    const pDur = 200;
    const iDur = 300;
    return {
      kind: "skill_cast",
      skillId,
      from,
      segmentGroups: [{
        startOffsetMs: 0,
        segments: [
          { kind: "projectile", style: "supremacy_glint", from, to, durationMs: pDur },
          { kind: "impact", style: "supremacy_mark", center: to, durationMs: iDur },
        ],
      }],
      durationMs: pDur + iDur,
      startMs: null,
    };
  }

  if (roots.length === 0) return null;

  if (skillId === "ice_spike") {
    const ray = buildIceSpikeRayCells(run, roots[0].x, roots[0].y);
    const last = ray.length ? ray[ray.length - 1] : from;
    const to = { x: last.x, y: last.y };
    const projMs = Math.min(420, 120 + ray.length * 55);
    const hitMs = 160;
    return {
      kind: "skill_cast",
      skillId,
      from,
      segmentGroups: [{
        startOffsetMs: 0,
        segments: [
          { kind: "projectile", style: "ice_spike", from, to, durationMs: projMs },
          { kind: "impact", style: "ice_spike_hit", center: to, durationMs: hitMs },
        ],
      }],
      durationMs: projMs + hitMs,
      startMs: null,
    };
  }

  if (skillId === "stone_wall") {
    const to = { x: roots[0].x, y: roots[0].y };
    return {
      kind: "skill_cast",
      skillId,
      from,
      segmentGroups: [{
        startOffsetMs: 0,
        segments: [
          { kind: "projectile", style: "meteor", from, to, durationMs: METEOR_PROJECTILE_MS },
          { kind: "impact", style: "meteor_crater", center: to, durationMs: METEOR_IMPACT_MS },
        ],
      }],
      durationMs: METEOR_PROJECTILE_MS + METEOR_IMPACT_MS,
      startMs: null,
    };
  }

  return null;
}

function logsJoin(parts) {
  return parts.filter(Boolean).join(" ");
}

function executeExtensionSkillResolvedPlan(run, playerSheet, skill, instanceData, plan, fx, rng) {
  void instanceData;
  const { skillId, skillLevel, roots } = plan;
  const logs = [];

  switch (skillId) {
    case "ice_spike": {
    const ray = buildIceSpikeRayCells(run, roots[0].x, roots[0].y);
    const base = staffSkillBaseDamage(skillLevel, playerSheet);
    let slot = 0;
    for (const cell of ray) {
      const enemy = findEnemyAt(run, cell.x, cell.y);
      if (!enemy) continue;
      const dmg = Math.max(1, Math.floor(base / (2 ** slot)));
      slot += 1;
      const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, dmg);
      logs.push(`${skill.name}: ${enemy.name} — ${dmg} урона.${res.defeat ? ` ${res.defeatLog}` : ""}`);
      enqueueFloatingText(run, {
        x: cell.x,
        y: cell.y,
        value: `-${dmg}`,
        color: "#67e8f9",
        durationMs: 680,
        scale: 1.05,
        startMs: null,
      });
    }
      assignExtensionCastMotion(fx, skillId, run, roots);
      run.lastLog = logsJoin(logs) || `${skill.name}: луч прошёл без попаданий.`;
      return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    case "stone_wall":
      return executeStoneWallMeteorResolvedPlan(run, playerSheet, skill, plan, fx);
    case "shock_wave": {
    const px = run.player.x;
    const py = run.player.y;
    const base = staffSkillBaseDamage(skillLevel, playerSheet);
    for (const d of DIRS_8) {
      const x = px + d.x;
      const y = py + d.y;
      const enemy = findEnemyAt(run, x, y);
      if (enemy) {
        const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, base);
        logs.push(`${enemy.name}: ${base}.${res.defeat ? ` ${res.defeatLog}` : ""}`);
        enqueueFloatingText(run, { x, y, value: `-${base}`, color: "#fbbf24", durationMs: 640, scale: 1.05, startMs: null });
        if (!res.defeat) {
          const dir = normalizeKnockbackDirection(px, py, x, y);
          const kb = resolveKnockback(run, playerSheet, enemy, dir.dx, dir.dy, 2, {});
          logs.push(...kb.logs);
        }
        continue;
      }
      const stoneWall = findStoneWallAt(run, x, y);
      if (stoneWall) {
        const dir = normalizeKnockbackDirection(px, py, x, y);
        const kb = resolveStoneWallKnockback(run, playerSheet, stoneWall, dir.dx, dir.dy, 2, {});
        logs.push(...kb.logs);
      }
    }
      assignExtensionCastMotion(fx, skillId, run, []);
      run.lastLog = logsJoin(logs) || `${skill.name}: некого задеть рядом.`;
      return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    case "chain_lightning": {
    const first = findEnemyAt(run, roots[0].x, roots[0].y);
    const totalHits = Math.min(4, Math.max(2, skillLevel + 1));
    const base = chainLightningBase(skillLevel, playerSheet);
    let originX = first.x;
    let originY = first.y;
    const hitIds = new Set();

    const strikeTarget = (x, y, mult, isPlayer) => {
      const dmg = Math.max(1, Math.floor(base * mult));
      if (isPlayer) {
        const r = applyDamageToPlayer(run, playerSheet, dmg, skill.name);
        logs.push(r.log);
        if (r.nextHp <= 0) run.status = "defeat";
        enqueueFloatingText(run, {
          x, y, value: `-${dmg}`, color: "#fde047", durationMs: 560, scale: 1.1, startMs: null,
        });
      } else {
        const enemyObj = findEnemyAt(run, x, y);
        if (!enemyObj) return;
        const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemyObj, dmg);
        logs.push(`${enemyObj.name}: ${dmg}.${res.defeat ? ` ${res.defeatLog}` : ""}`);
        enqueueFloatingText(run, {
          x, y, value: `-${dmg}`, color: "#fde047", durationMs: 560, scale: 1.1, startMs: null,
        });
      }
    };

    const chainAnimCells = [{ x: run.player.x, y: run.player.y }];
    strikeTarget(first.x, first.y, 1, false);
    hitIds.add(first.id);
    chainAnimCells.push({ x: first.x, y: first.y });

    let hitIndex = 2;
    while (hitIndex <= totalHits && run.status !== "defeat") {
      const candidates = [];

      for (const o of run.objects || []) {
        if (o.type !== "enemy") continue;
        if (hitIds.has(o.id)) continue;
        if (chebyshevDistance({ x: originX, y: originY }, o) <= 4) {
          candidates.push({ kind: "enemy", enemy: o });
        }
      }
      if (!hitIds.has("__player__") && chebyshevDistance({ x: originX, y: originY }, run.player) <= 4) {
        candidates.push({ kind: "player" });
      }

      if (candidates.length === 0) break;

      const pick = randomPick(candidates, rng);
      if (pick.kind === "player") {
        strikeTarget(run.player.x, run.player.y, hitIndex, true);
        hitIds.add("__player__");
        originX = run.player.x;
        originY = run.player.y;
        chainAnimCells.push({ x: run.player.x, y: run.player.y });
      } else {
        const e = pick.enemy;
        strikeTarget(e.x, e.y, hitIndex, false);
        hitIds.add(e.id);
        originX = e.x;
        originY = e.y;
        chainAnimCells.push({ x: e.x, y: e.y });
      }
      hitIndex += 1;
    }

      assignChainLightningMotion(fx, chainAnimCells);
      run.lastLog = logsJoin(logs);
      return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    case "steel_stance": {
    run.steelStanceBuff = { turnsLeft: 2, level: skillLevel };
    assignExtensionCastMotion(fx, skillId, run, roots);
    run.lastLog = `${skill.name}: стойка активна (${skillLevel} ур.).`;
    return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    case "whirlwind": {
    const px = run.player.x;
    const py = run.player.y;
    const cc = Math.min(100, Math.max(0, Number(playerSheet?.derived?.CRIT_CHANCE ?? 0)));
    const isCrit = randomFloat(rng) * 100 < cc;
    for (const d of DIRS_8) {
      const x = px + d.x;
      const y = py + d.y;
      const enemy = findEnemyAt(run, x, y);
      if (!enemy) continue;
      const hit = computeBasicMeleeDamage(playerSheet, 1, rng, { forcedCrit: isCrit });
      const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, hit.damage);
      logs.push(`${enemy.name}: ${hit.damage}.${res.defeat ? ` ${res.defeatLog}` : ""}`);
      enqueueFloatingText(run, {
        x, y,
        value: `-${hit.damage}`,
        color: hit.isCrit ? "#fde047" : "#fca5a5",
        durationMs: hit.isCrit ? 760 : 620,
        scale: hit.isCrit ? 1.35 : 1,
        startMs: null,
      });
    }
      assignExtensionCastMotion(fx, skillId, run, []);
      run.lastLog = logsJoin(logs) || `${skill.name}: нет целей рядом.`;
      return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    case "lunge": {
    const tx = roots[0].x;
    const ty = roots[0].y;
    const enemy = findEnemyAt(run, tx, ty);

    const playerStart = { x: run.player.x, y: run.player.y };
    const hitCell = { x: tx, y: ty };
    const pref = normalizeKnockbackDirection(playerStart.x, playerStart.y, tx, ty);

    const hit = computeBasicMeleeDamage(playerSheet, 1, rng);
    const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, hit.damage);
    logs.push(`${enemy.name}: ${hit.damage}.${res.defeat ? ` ${res.defeatLog}` : ""}`);
    enqueueFloatingText(run, {
      x: tx,
      y: ty,
      value: `-${hit.damage}`,
      color: hit.isCrit ? "#fde047" : "#fca5a5",
      durationMs: 680,
      scale: hit.isCrit ? 1.35 : 1.05,
      startMs: null,
    });

    const enemyDefeated = Boolean(res.defeat);
    let anchorCell = { ...hitCell };
    let enemyEnd = { ...hitCell };

    if (!enemyDefeated) {
      const kb = resolveKnockback(run, playerSheet, enemy, pref.dx, pref.dy, 2, {});
      logs.push(...kb.logs);
      anchorCell = { x: enemy.x, y: enemy.y };
      enemyEnd = { x: enemy.x, y: enemy.y };
    }

    const retreat = pickPlayerLungeRetreatCell(run, playerStart, anchorCell);
    const playerEnd = retreat
      ? { x: retreat.x, y: retreat.y }
      : { ...playerStart };

    if (retreat) {
      run.player.x = retreat.x;
      run.player.y = retreat.y;
    }

    assignLungeSkillMotion(fx, {
      playerStart,
      hitCell,
      playerEnd,
      enemyId: enemy.id,
      enemyStart: hitCell,
      enemyEnd,
      enemyDefeated,
    });

    run.lastLog = logsJoin(logs);
    return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    case "cleave": {
    const enemy = findEnemyAt(run, roots[0].x, roots[0].y);
    const hit = computeBasicMeleeDamage(playerSheet, 1, rng);
    const dmg = Math.max(1, Math.floor(hit.damage * 1.35));
    const res = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, dmg);
    const st = ensureEnemyStatus(enemy);
    st.bleedTurns = Math.max(Number(st.bleedTurns || 0), 3);
    st.bleedDotPercent = Math.max(Number(st.bleedDotPercent || 0), 0.2);
    logs.push(`${enemy.name}: ${dmg}, кровотечение на 3 хода.${res.defeat ? ` ${res.defeatLog}` : ""}`);
    enqueueFloatingText(run, {
      x: enemy.x, y: enemy.y, value: `-${dmg}`, color: "#ef4444", durationMs: 700, scale: 1.1, startMs: null,
    });
    assignExtensionCastMotion(fx, skillId, run, roots);
    run.lastLog = logsJoin(logs);
    return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    case "supremacy": {
    const enemy = findEnemyAt(run, roots[0].x, roots[0].y);
    const st = ensureEnemyStatus(enemy);
    st.berserkTurns = 3;
    assignExtensionCastMotion(fx, skillId, run, roots);
    run.lastLog = `${skill.name}: ${enemy.name} впадает в берсерк (атакует соседних котов).`;
    return { ok: true, log: run.lastLog, actionConsumed: true };
    }
    default:
      return { ok: false, log: "Неизвестное расширение скилла.", refundMana: true };
  }
}

export function applyExtensionSkillPrepared(run, playerSheet, skill, instanceData, selectedRoots, actualManaCost) {
  void actualManaCost;
  const plan = buildExtensionSkillResolvedPlan(run, playerSheet, skill, instanceData, selectedRoots);
  if (!plan.ok) {
    return { ok: false, log: plan.log, refundMana: true };
  }
  const fx = ensureRunFxState(run);
  const rng = run?.rng || null;
  return executeExtensionSkillResolvedPlan(run, playerSheet, skill, instanceData, plan, fx, rng);
}
