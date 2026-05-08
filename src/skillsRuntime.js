import { floorHp } from "./rules.js?v=0.5.4-pre-alpha";
import { syncPlayerHp } from "./game/syncHp.js?v=0.5.4-pre-alpha";
import { applyDamageToEnemyAndResolveDefeat } from "./game/enemyCombat.js?v=0.5.4-pre-alpha";
import { ensureRunFxState, enqueueFloatingText } from "./runtime/runFxState.js?v=0.5.4-pre-alpha";
import { hasLineOfSightOnGrid } from "./nav/lineOfSight.js?v=0.5.4-pre-alpha";
import { ensureEnemyStatus } from "./game/trapsAndClouds.js?v=0.5.4-pre-alpha";

const SKILL_DEFS = {
  fireball: {
    id: "fireball",
    name: "Огненный шар",
    icon: "🔥",
    manaCost: 24,
    rarity: "rare",
    target: "visible_cell",
    targeting: {
      charges: 1,
      allowRepeatTarget: true,
      shape: "square_1",
    },
    description: "Выбери видимую клетку в пределах 6 клеток. В центре наносит большой урон, по соседним клеткам — меньше. Накладывает горение на 3 хода.",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
  magic_slap: {
    id: "magic_slap",
    name: "Магический шлепок",
    icon: "💫",
    manaCost: 15,
    rarity: "common",
    target: "single_unit",
    targeting: {
      charges: 2,
      allowRepeatTarget: true,
      shape: "single",
    },
    description: "Серия магических шлепков по врагам: количество применений растет с уровнем скилла (можно повторять одну и ту же цель).",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
};

const SKILL_TEMPLATE_DEFS = {
  single: [{ dx: 0, dy: 0, role: "epicenter" }],
  square_1: [
    { dx: 0, dy: 0, role: "epicenter" },
    { dx: -1, dy: -1, role: "splash" },
    { dx: 0, dy: -1, role: "splash" },
    { dx: 1, dy: -1, role: "splash" },
    { dx: -1, dy: 0, role: "splash" },
    { dx: 1, dy: 0, role: "splash" },
    { dx: -1, dy: 1, role: "splash" },
    { dx: 0, dy: 1, role: "splash" },
    { dx: 1, dy: 1, role: "splash" },
  ],
  plus_1: [
    { dx: 0, dy: 0, role: "epicenter" },
    { dx: 1, dy: 0, role: "splash" },
    { dx: -1, dy: 0, role: "splash" },
    { dx: 0, dy: 1, role: "splash" },
    { dx: 0, dy: -1, role: "splash" },
  ],
};

const BURNING_TURNS = 3;
const BURNING_PERCENT = 0.10;

function getFireballDamage(skillLevel, playerSheet, role = "epicenter") {
  const level = Math.max(1, Number(skillLevel || 1));
  const intStat = playerSheet?.stats?.INT ?? playerSheet?.baseStats?.INT ?? 0;
  const centerRaw = 16 + (intStat - 10) * 0.5 + (level - 1) * 0.75;
  const centerDamage = Math.max(1, Math.round(centerRaw));
  if (role === "splash") {
    return Math.max(1, Math.floor(centerDamage * 0.45));
  }
  return centerDamage;
}

function getMagicSlapDamage(playerSheet) {
  const playerLevel = Math.max(1, Number(playerSheet?.level || 1));
  const damageRaw = 6 + ((playerLevel - 1) * (2 / 9));
  return Math.max(1, Math.round(damageRaw));
}

function getFireballBurnTurns(skillLevel) {
  const level = Math.max(1, Number(skillLevel || 1));
  return BURNING_TURNS + (level - 1);
}

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function roundManaValue(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function getRoundedCurrentMana(playerSheet) {
  return roundManaValue(playerSheet?.mana || 0);
}

function buildBlockingSkillMotion(skillId, run, selectedRoots = []) {
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  if (!run?.player || roots.length === 0) return null;

  const segmentGroups = [];
  const castStaggerMs = 102;
  const from = { x: Number(run.player.x), y: Number(run.player.y) };
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    const to = { x: Number(root.x), y: Number(root.y) };
    const groupSegments = [];
    if (skillId === "fireball") {
      groupSegments.push({
        kind: "projectile",
        style: "fireball",
        from,
        to,
        durationMs: 230,
      });
      groupSegments.push({
        kind: "impact",
        style: "fireball_blast_3x3",
        center: to,
        affectedCells: getSkillAffectedCellsForRoot(run, skillId, to.x, to.y),
        durationMs: 250,
      });
    } else if (skillId === "magic_slap") {
      groupSegments.push({
        kind: "projectile",
        style: "magic_hand",
        from,
        to,
        durationMs: 190,
      });
      groupSegments.push({
        kind: "impact",
        style: "magic_slap_hit",
        center: to,
        durationMs: 130,
      });
    }
    if (groupSegments.length === 0) continue;
    segmentGroups.push({
      startOffsetMs: index * castStaggerMs,
      segments: groupSegments,
    });
  }
  if (segmentGroups.length === 0) return null;
  const durationMs = segmentGroups.reduce((maxDuration, group) => {
    const groupDuration = (group.segments || []).reduce(
      (sum, segment) => sum + Math.max(1, Number(segment.durationMs || 0)),
      0,
    );
    return Math.max(maxDuration, Number(group.startOffsetMs || 0) + groupDuration);
  }, 0);
  return {
    kind: "skill_cast",
    skillId,
    from,
    segmentGroups,
    durationMs: Math.max(1, durationMs),
    startMs: null,
  };
}

function getItemRarity(item) {
  const id = String(item?.id || "");
  if (id.startsWith("unique_")) return "unique";
  if (id.startsWith("rare_")) return "rare";
  return "common";
}

function isWallCell(run, x, y) {
  return run?.grid?.[y]?.[x] === 1;
}

export function getVisibleCellsForPlayer(run, options = {}) {
  if (!run?.player || !run?.grid || !Array.isArray(run?.discovered)) return [];
  const fromX = Number(run.player.x);
  const fromY = Number(run.player.y);
  const maxRange = Number.isFinite(Number(options.maxRange)) ? Number(options.maxRange) : null;
  const includeWalls = options.includeWalls === true;
  const out = [];
  for (let y = 0; y < run.height; y += 1) {
    for (let x = 0; x < run.width; x += 1) {
      if (!run.discovered?.[y]?.[x]) continue;
      if (!includeWalls && isWallCell(run, x, y)) continue;
      if (maxRange !== null) {
        const dx = Math.abs(x - fromX);
        const dy = Math.abs(y - fromY);
        const distance = Math.max(dx, dy);
        if (distance > maxRange) continue;
      }
      if (!hasLineOfSightOnGrid(run.grid, fromX, fromY, x, y)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

function getMaxSkillLevelForEquip(item) {
  const rarity = getItemRarity(item);
  if (rarity === "unique") return 3;
  if (rarity === "rare") return 2;
  return 1;
}

function pickNRandomUnique(values, count, rng) {
  const source = [...values];
  const out = [];
  while (source.length > 0 && out.length < count) {
    const index = Math.floor(Math.max(0, Math.min(0.999999, rng())) * source.length);
    const [picked] = source.splice(index, 1);
    if (picked) out.push(picked);
  }
  return out;
}

export function getSkillById(skillId) {
  return SKILL_DEFS[skillId] || null;
}

export function getAllSkillIds() {
  return Object.keys(SKILL_DEFS);
}

export function getSkillManaCost(skillDef, playerSheet) {
  if (!skillDef) return 0;
  if (typeof skillDef.manaCost === "function") {
    return roundManaValue(skillDef.manaCost(playerSheet));
  }
  return roundManaValue(skillDef.manaCost || 0);
}

function getTemplateIdForSkill(skillDef) {
  const requested = String(skillDef?.targeting?.templateId || skillDef?.targeting?.shape || "single");
  return SKILL_TEMPLATE_DEFS[requested] ? requested : "single";
}

function getTemplateOffsets(skillDef) {
  return SKILL_TEMPLATE_DEFS[getTemplateIdForSkill(skillDef)] || SKILL_TEMPLATE_DEFS.single;
}

function isCellInsideRun(run, x, y) {
  if (!run) return false;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < run.width && y < run.height;
}

function hasSkillTargetUnitOnCell(run, x, y) {
  if (!run) return false;
  if (x === run.player?.x && y === run.player?.y) return true;
  return (run.objects || []).some((object) => object.type === "enemy" && object.x === x && object.y === y);
}

function getVisibleEnemyTargetCells(run) {
  if (!run?.player || !Array.isArray(run?.objects) || !run?.grid) {
    return [];
  }
  const visibleCells = new Set(getVisibleCellsForPlayer(run, { includeWalls: false }).map((cell) => `${cell.x}:${cell.y}`));
  return run.objects
    .filter((object) => object?.type === "enemy")
    .filter((enemy) => visibleCells.has(`${Number(enemy.x)}:${Number(enemy.y)}`))
    .map((enemy) => ({ x: enemy.x, y: enemy.y }));
}

function isEquipItem(item) {
  const type = String(item?.type || "");
  return type === "weapon" || type === "armor" || type === "amulet";
}

function isSkillCompatibleWithItem(skillDef, item) {
  const rules = Array.isArray(skillDef?.compatibleItems) ? skillDef.compatibleItems : [];
  if (rules.length === 0 || !item) return false;
  const itemType = String(item.type || "");
  const itemSubtype = String(item.subtype || "");
  return rules.some((rule) => {
    const ruleType = String(rule?.type || "");
    const ruleSubtype = String(rule?.subtype || "");
    if (!ruleType) return false;
    if (ruleType !== itemType) return false;
    // Пустой subtype или "*" означает "любой подтип этого типа".
    if (!ruleSubtype || ruleSubtype === "*") return true;
    return ruleSubtype === itemSubtype;
  });
}

export function getSkillIdsForItem(item) {
  if (!isEquipItem(item)) return [];
  return Object.values(SKILL_DEFS)
    .filter((skillDef) => isSkillCompatibleWithItem(skillDef, item))
    .map((skillDef) => skillDef.id);
}

export function rollSkillIdsForItem(item, rng = Math.random) {
  const candidates = getSkillIdsForItem(item);
  if (candidates.length <= 2) return candidates;
  return pickNRandomUnique(candidates, 2, rng);
}

export function createSkillInstanceDataForItem(item, rng = Math.random) {
  if (!isEquipItem(item)) return null;
  const skillIds = rollSkillIdsForItem(item, rng);
  const skillLevels = {};
  for (const skillId of skillIds) {
    skillLevels[skillId] = rollSkillLevelForItem(item, rng);
  }
  return {
    skillIds,
    skillLevels,
  };
}

export function normalizeSkillInstanceData(item, instanceData, rng = Math.random) {
  if (!isEquipItem(item)) return null;
  const base = instanceData && typeof instanceData === "object" ? instanceData : {};
  const rolledIds = rollSkillIdsForItem(item, rng);
  const existingIds = Array.isArray(base.skillIds)
    ? base.skillIds.filter((id) => SKILL_DEFS[id] && rolledIds.includes(id))
    : [];
  const skillIds = existingIds.length > 0 ? existingIds.slice(0, 2) : rolledIds;
  const sourceLevels = base.skillLevels && typeof base.skillLevels === "object"
    ? base.skillLevels
    : {};
  const skillLevels = {};
  for (const skillId of skillIds) {
    const sourceLevel = Number(sourceLevels[skillId] || 0);
    const maxLevel = getMaxSkillLevelForEquip(item);
    if (sourceLevel >= 1 && sourceLevel <= maxLevel) {
      skillLevels[skillId] = Math.floor(sourceLevel);
    } else {
      skillLevels[skillId] = rollSkillLevelForItem(item, rng);
    }
  }
  return { skillIds, skillLevels };
}

export function getSkillsForEquippedItem(item, instanceData) {
  if (!isEquipItem(item) || !instanceData) return [];
  const normalized = normalizeSkillInstanceData(item, instanceData);
  return normalized.skillIds
    .map((skillId) => {
      const def = getSkillById(skillId);
      if (!def) return null;
      return {
        ...def,
        level: Math.max(1, Number(normalized.skillLevels?.[skillId] || 1)),
      };
    })
    .filter(Boolean);
}

export function getSkillTargetingProfile(skillId, skillLevel = 1) {
  const skill = getSkillById(skillId);
  if (!skill) return null;
  const normalizedSkillLevel = Math.max(1, Number(skillLevel || 1));
  const baseCharges = Math.max(1, Number(skill?.targeting?.charges || 1));
  const charges = skillId === "magic_slap"
    ? baseCharges + (normalizedSkillLevel - 1)
    : baseCharges;
  return {
    charges,
    allowRepeatTarget: skill?.targeting?.allowRepeatTarget !== false,
    templateId: getTemplateIdForSkill(skill),
  };
}

export function getSkillAffectedCellsForRoot(run, skillId, rootX, rootY) {
  const skill = getSkillById(skillId);
  if (!skill) return [];
  const offsets = getTemplateOffsets(skill);
  const seen = new Set();
  const out = [];
  for (const offset of offsets) {
    const x = Number(rootX) + Number(offset.dx || 0);
    const y = Number(rootY) + Number(offset.dy || 0);
    if (!isCellInsideRun(run, x, y)) continue;
    const key = `${x}:${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      x,
      y,
      role: offset.role === "epicenter" ? "epicenter" : "splash",
      rootX: Number(rootX),
      rootY: Number(rootY),
    });
  }
  return out;
}

export function buildPreparedSkillCastState(run, skillId, selectedRoots = []) {
  const profile = getSkillTargetingProfile(skillId);
  if (!profile) return null;
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  return {
    profile,
    selectedRoots: roots,
    remainingCharges: Math.max(0, profile.charges - roots.length),
    affectedCells: roots.flatMap((root) => getSkillAffectedCellsForRoot(run, skillId, root.x, root.y)),
  };
}

export const SKILLS_APPLY_BY_ID = {
  fireball: {
    getTargets: (run, playerSheet) => {
      return getVisibleCellsForPlayer(run, { maxRange: 6, includeWalls: false });
    },
    getHoverData: (skill, item, playerSheet) => {
      const centerDamage = getFireballDamage(skill?.level || 1, playerSheet, "epicenter");
      const splashDamage = getFireballDamage(skill?.level || 1, playerSheet, "splash");
      const burnTurns = getFireballBurnTurns(skill?.level || 1);
      return {
        formula: "Урон в центре: 16 на ИНТ=10 и уровне скилла 1, далее растет от ИНТ и уровня скилла. По соседним 8 клеткам: 45% урона центра. Горение: базово 3 хода, +1 ход за каждый уровень скилла после первого; каждый ход снимает 10% МАКС HP (минимум 2).",
        targets: "Любая видимая клетка в пределах 6 клеток. Затрагивается квадрат 3x3.",
        skillLevel: skill?.level || 1,
        damageCenter: centerDamage,
        damageSplash: splashDamage,
        burnTurns,
        burnPercent: Math.round(BURNING_PERCENT * 100),
      };
    },
    getEffects: (run, playerSheet, skill, instanceData, targetX, targetY, context = null) => {
      const role = context?.cellRole === "splash" ? "splash" : "epicenter";
      const skillLevel = instanceData?.skillLevels?.[skill.id] || 1;
      const damage = getFireballDamage(skillLevel, playerSheet, role);
      const burnTurns = getFireballBurnTurns(skillLevel);
      return {
        targetDamage: damage,
        statusEffects: [{
          id: "burning",
          type: "burning",
          turns: burnTurns,
          percent: BURNING_PERCENT,
        }],
      };
    },
  },
  magic_slap: {
    getTargets: (run, playerSheet) => {
      return getVisibleEnemyTargetCells(run);
    },
    getHoverData: (skill, item, playerSheet) => {
      const damage = getMagicSlapDamage(playerSheet);
      const charges = getSkillTargetingProfile("magic_slap", skill?.level || 1)?.charges || 2;
      return {
        formula: "Урон за один шлепок: 6 на уровне персонажа 1 и 8 на уровне 10. Урон не зависит от уровня скилла.",
        targets: `До ${charges} выборов клетки с противником. Одну и ту же цель можно выбрать несколько раз.`,
        skillLevel: skill?.level || 1,
        damage: damage,
        charges,
      };
    },
    getEffects: (run, playerSheet, skill, instanceData, targetX, targetY) => {
      const damage = getMagicSlapDamage(playerSheet);
      return { targetDamage: damage };
    },
    apply: (run, playerSheet, skill, instanceData, targetX, targetY) => {
      const enemy = (run.objects || []).find((object) => object.type === "enemy" && object.x === targetX && object.y === targetY);
      if (!enemy) {
        return { ok: false, log: "На клетке нет противника." };
      }
      
      const actualManaCost = getSkillManaCost(skill, playerSheet);
      if ((playerSheet.mana || 0) < actualManaCost) {
        return { ok: false, log: "Недостаточно маны." };
      }
      playerSheet.mana -= actualManaCost;

      const effects = SKILLS_APPLY_BY_ID[skill.id].getEffects(run, playerSheet, skill, instanceData, targetX, targetY);
      const damage = effects.targetDamage || 0;
      
      const combatResult = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, damage);
      let log = `${skill.name}: ${enemy.name} получает ${damage} урона.`;
      if (combatResult.defeated) {
        log += ` ${combatResult.defeatLog}`;
      }
      
      const fx = ensureRunFxState(run);
      enqueueFloatingText(run, {
        x: targetX,
        y: targetY,
        value: `-${damage}`,
        color: "#ef4444",
        durationMs: 700,
        scale: 1.1,
        startMs: null,
      });
      
      return { ok: true, log };
    }
  }
};

export function getSkillTargetCells(run, playerSheet, skillId) {
  if (!run || !playerSheet || !skillId) return [];
  const resolver = SKILLS_APPLY_BY_ID[skillId];
  if (resolver && resolver.getTargets) {
    return resolver.getTargets(run, playerSheet);
  }
  return [];
}

export function buildSkillHoverData(skill, item, playerSheet) {
  if (!skill) return null;
  const resolver = SKILLS_APPLY_BY_ID[skill.id];
  if (resolver && resolver.getHoverData) {
    return resolver.getHoverData(skill, item, playerSheet);
  }
  return null;
}

function aggregatePreparedSkillEffects(run, playerSheet, item, instanceData, skillId, selectedRoots = []) {
  const skill = getSkillById(skillId);
  const resolver = SKILLS_APPLY_BY_ID[skillId];
  if (!skill || !resolver || !Array.isArray(selectedRoots) || selectedRoots.length === 0) {
    return null;
  }
  const byCell = new Map();
  for (const root of selectedRoots) {
    const affectedCells = getSkillAffectedCellsForRoot(run, skillId, root.x, root.y);
    for (const cell of affectedCells) {
      const effects = resolver.getEffects
        ? resolver.getEffects(run, playerSheet, skill, instanceData, cell.x, cell.y, {
          rootX: root.x,
          rootY: root.y,
          cellRole: cell.role,
        })
        : null;
      if (!effects) continue;
      const key = `${cell.x}:${cell.y}`;
      const prev = byCell.get(key) || {
        x: cell.x,
        y: cell.y,
        role: cell.role,
        targetDamage: 0,
        statusEffects: new Map(),
      };
      prev.targetDamage += Number(effects.targetDamage || 0);
      const statuses = Array.isArray(effects.statusEffects) ? effects.statusEffects : [];
      for (const status of statuses) {
        const statusId = String(status?.id || "");
        if (!statusId || prev.statusEffects.has(statusId)) continue;
        prev.statusEffects.set(statusId, status);
      }
      byCell.set(key, prev);
    }
  }
  return {
    byCell: Array.from(byCell.values()).map((entry) => ({
      ...entry,
      statusEffects: Array.from(entry.statusEffects.values()),
    })),
  };
}

function buildPendingSkillApplications(run, playerSheet, item, instanceData, skillId, selectedRoots, blockingSkillMotion, castStartMs) {
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  const groups = Array.isArray(blockingSkillMotion?.segmentGroups) ? blockingSkillMotion.segmentGroups : [];
  if (roots.length === 0 || groups.length === 0) return [];
  const out = [];
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    const group = groups[index];
    if (!root || !group) continue;
    const aggregated = aggregatePreparedSkillEffects(run, playerSheet, item, instanceData, skillId, [root]);
    if (!aggregated) continue;
    const groupDurationMs = (group.segments || []).reduce(
      (sum, segment) => sum + Math.max(1, Number(segment.durationMs || 0)),
      0,
    );
    out.push({
      skillId,
      applyAtMs: Number(castStartMs) + Math.max(0, Number(group.startOffsetMs || 0)) + groupDurationMs,
      aggregated,
      applied: false,
    });
  }
  return out;
}

function applyAggregatedEffects(run, playerSheet, skill, aggregated, options = {}) {
  if (!aggregated) return { ok: false, log: "Нет эффектов для применения." };
  const logs = [];
  const fx = ensureRunFxState(run);
  const floatingStartDelayMs = Math.max(0, Number(options.floatingStartDelayMs || 0));
  const floatingStartMs = getNowMs() + floatingStartDelayMs;
  for (const target of aggregated.byCell) {
    const x = Number(target.x);
    const y = Number(target.y);
    const damage = Math.max(0, floorHp(target.targetDamage || 0));
    if (damage <= 0) continue;
    const burningEffects = Array.isArray(target.statusEffects)
      ? target.statusEffects.filter((effect) => effect?.type === "burning")
      : [];
    const hasBurning = burningEffects.length > 0;
    const burnTurns = hasBurning
      ? burningEffects.reduce((maxTurns, effect) => Math.max(maxTurns, Number(effect?.turns || BURNING_TURNS)), BURNING_TURNS)
      : 0;
    const burnPercent = hasBurning
      ? burningEffects.reduce((maxPercent, effect) => Math.max(maxPercent, Number(effect?.percent || BURNING_PERCENT)), BURNING_PERCENT)
      : 0;
    if (x === run.player.x && y === run.player.y) {
      const playerHpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const playerHpNext = floorHp(playerHpNow - damage);
      syncPlayerHp(playerSheet, playerHpNext);
      logs.push(`${skill.name}: мышонок получает ${damage} урона.`);
      if (hasBurning) {
        const currentEffects = Array.isArray(run.overTimeEffects) ? run.overTimeEffects : [];
        const burnExisting = currentEffects.find((effect) => effect.type === "burning_player");
        if (burnExisting) {
          burnExisting.turnsLeft = Math.max(Number(burnExisting.turnsLeft || 0), burnTurns);
          burnExisting.burnPercent = Math.max(Number(burnExisting.burnPercent || 0), burnPercent);
        } else {
          currentEffects.push({
            type: "burning_player",
            turnsLeft: burnTurns,
            burnPercent,
          });
          run.overTimeEffects = currentEffects;
        }
      }
      continue;
    }
    const enemy = (run.objects || []).find((object) => object.type === "enemy" && object.x === x && object.y === y);
    if (!enemy) continue;
    const combatResult = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, damage);
    let line = `${skill.name}: ${enemy.name} получает ${damage} урона.`;
    if (combatResult.defeated) {
      line += ` ${combatResult.defeatLog}`;
    }
    logs.push(line);
    if (hasBurning) {
      const status = ensureEnemyStatus(enemy);
      status.burnTurns = Math.max(Number(status.burnTurns || 0), burnTurns);
      status.burnPercent = Math.max(Number(status.burnPercent || 0), burnPercent);
    }
    enqueueFloatingText(run, {
      x,
      y,
      value: `-${damage}`,
      color: "#ef4444",
      durationMs: 700,
      scale: 1.1,
      startMs: floatingStartMs,
    });
  }
  const burningInCast = aggregated.byCell
    .flatMap((target) => (Array.isArray(target.statusEffects) ? target.statusEffects : []))
    .filter((effect) => effect?.type === "burning");
  if (burningInCast.length > 0) {
    const maxBurnTurns = burningInCast.reduce(
      (maxTurns, effect) => Math.max(maxTurns, Number(effect?.turns || BURNING_TURNS)),
      BURNING_TURNS,
    );
    const maxBurnPercent = burningInCast.reduce(
      (maxPercent, effect) => Math.max(maxPercent, Number(effect?.percent || BURNING_PERCENT)),
      BURNING_PERCENT,
    );
    logs.push(`Горение: ${Math.round(maxBurnPercent * 100)}% МАКС HP на ${maxBurnTurns} хода (минимум 2).`);
  }
  return { ok: true, log: logs.join(" ") || `${skill.name}: эффект применён.` };
}

export function processPendingSkillApplications(run, playerSheet, nowMs = getNowMs()) {
  if (!run || !playerSheet) return;
  const fx = ensureRunFxState(run);
  const pending = Array.isArray(fx?.pendingSkillApplications) ? fx.pendingSkillApplications : [];
  if (pending.length === 0) return;
  const logs = [];
  for (const entry of pending) {
    if (!entry || entry.applied) continue;
    if (nowMs < Math.max(0, Number(entry.applyAtMs || 0))) continue;
    const skill = getSkillById(entry.skillId);
    if (!skill) {
      entry.applied = true;
      continue;
    }
    const result = applyAggregatedEffects(run, playerSheet, skill, entry.aggregated);
    entry.applied = true;
    if (result?.log) logs.push(result.log);
  }
  fx.pendingSkillApplications = pending.filter((entry) => !entry?.applied);
  if (logs.length > 0) {
    run.lastLog = logs.join(" ");
  }
}

export function usePreparedSkillSelections(run, playerSheet, item, instanceData, skillId, selectedRoots = []) {
  if (!run || !playerSheet || !item || !instanceData || !skillId) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: "" };
  }
  const skill = getSkillById(skillId);
  if (!skill) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: "Неизвестный скилл." };
  }
  const actualManaCost = getSkillManaCost(skill, playerSheet);
  const currentMana = getRoundedCurrentMana(playerSheet);
  playerSheet.mana = currentMana;
  if (currentMana < actualManaCost) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: "Недостаточно маны." };
  }
  playerSheet.mana = roundManaValue(currentMana - actualManaCost);
  const fx = ensureRunFxState(run);
  const blockingSkillMotion = buildBlockingSkillMotion(skillId, run, selectedRoots);
  if (fx) {
    const castStartMs = getNowMs();
    if (blockingSkillMotion) {
      blockingSkillMotion.startMs = castStartMs;
    }
    fx.motion = blockingSkillMotion;
    if (blockingSkillMotion) {
      fx.pendingSkillApplications = buildPendingSkillApplications(
        run,
        playerSheet,
        item,
        instanceData,
        skillId,
        selectedRoots,
        blockingSkillMotion,
        castStartMs,
      );
      const queuedLog = `${skill.name}: применение...`;
      run.lastLog = queuedLog;
      return { run, playerSheet, instanceData, ok: true, actionConsumed: true, log: queuedLog };
    }
  }
  const aggregated = aggregatePreparedSkillEffects(run, playerSheet, item, instanceData, skillId, selectedRoots);
  const result = applyAggregatedEffects(run, playerSheet, skill, aggregated);
  if (!result.ok) {
    playerSheet.mana = roundManaValue((playerSheet.mana || 0) + actualManaCost);
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: result.log };
  }
  run.lastLog = result.log;
  return { run, playerSheet, instanceData, ok: true, actionConsumed: true, log: result.log };
}

export function useSkillAtCell(run, playerSheet, item, instanceData, skillId, targetX, targetY) {
  return usePreparedSkillSelections(run, playerSheet, item, instanceData, skillId, [{ x: targetX, y: targetY }]);
}

export function getSkillPreviewAtCell(run, playerSheet, item, instanceData, skillId, targetX, targetY) {
  if (!run || !playerSheet || !item || !instanceData || !skillId) {
    return null;
  }
  const skill = getSkillById(skillId);
  if (!skill) return null;

  const targetCells = getSkillTargetCells(run, playerSheet, skillId);
  const isValidTarget = targetCells.some((cell) => cell.x === targetX && cell.y === targetY);
  if (!isValidTarget) {
    return null;
  }
  
  const resolver = SKILLS_APPLY_BY_ID[skillId];
  if (resolver && resolver.getEffects) {
    const effects = resolver.getEffects(run, playerSheet, skill, instanceData, targetX, targetY);
    if (!effects) return null;

    let { targetDamage = 0 } = effects;

    if (targetDamage > 0) {
      if (targetX === run.player.x && targetY === run.player.y) {
        const playerHpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
        targetDamage = Math.max(0, Math.min(targetDamage, playerHpNow));
      } else {
        const enemy = (run.objects || []).find((object) => object.type === "enemy" && object.x === targetX && object.y === targetY);
        if (enemy) {
          const enemyHpNow = floorHp(enemy.data?.hp || 0);
          targetDamage = Math.max(0, Math.min(targetDamage, enemyHpNow));
        } else {
          targetDamage = 0;
        }
      }
    }

    return { targetDamage };
  }
  
  return null;
}

export function getSkillPreviewForPreparedSelections(run, playerSheet, item, instanceData, skillId, selectedRoots = []) {
  const aggregated = aggregatePreparedSkillEffects(run, playerSheet, item, instanceData, skillId, selectedRoots);
  if (!aggregated) return [];
  const entries = [];
  for (const target of aggregated.byCell) {
    if (!hasSkillTargetUnitOnCell(run, target.x, target.y)) continue;
    if (target.targetDamage > 0) {
      entries.push({ x: target.x, y: target.y, value: `-${target.targetDamage}`, color: "#ef4444" });
    }
  }
  return entries;
}

function rollSkillLevelForItem(item, rng = Math.random) {
  const maxLevel = Math.max(1, getMaxSkillLevelForEquip(item));
  const level = 1 + Math.floor(Math.max(0, Math.min(0.999999, rng())) * maxLevel);
  return Math.max(1, Math.min(maxLevel, level));
}
