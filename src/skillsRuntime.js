import { floorHp } from "./rules.js?v=0.5.8-pre-alpha";
import { syncPlayerHp } from "./game/syncHp.js?v=0.5.8-pre-alpha";
import { applyDamageToEnemyAndResolveDefeat } from "./game/enemyCombat.js?v=0.5.8-pre-alpha";
import { ensureRunFxState, enqueueFloatingText } from "./runtime/runFxState.js?v=0.5.8-pre-alpha";
import { hasLineOfSightOnGrid } from "./nav/lineOfSightPermissive.js?v=0.5.8-pre-alpha";
import { computePlayerVisibleMask } from "./game/playerVisibility.js?v=0.5.8-pre-alpha";
import { ensureEnemyStatus } from "./game/trapsAndClouds.js?v=0.5.8-pre-alpha";
import { destroyStoneWallsAlongCasterSegment } from "./game/stoneWallRay.js?v=0.5.8-pre-alpha";
import {
  EXTENSION_SKILL_IDS,
  aggregateExtendedSkillPreview,
  applyExtensionSkillPrepared,
  getExtensionSkillTargets,
  getExtensionSkillAffectedCells,
  getMeteorSkillNumbers,
} from "./game/skillsPreparedCast.js?v=0.5.8-pre-alpha";

/** Длительности сегментов и сдвиг корней для fireball / magic_slap: общий источник для motion и pending apply. */
const FIREBALL_ROOT_STAGGER_MS = 102;
const FIREBALL_PROJECTILE_MS = 230;
const FIREBALL_IMPACT_MS = 250;
const MAGIC_SLAP_PROJECTILE_MS = 190;
const MAGIC_SLAP_IMPACT_MS = 130;

const SKILL_DEFS = {
  fireball: {
    id: "fireball",
    name: "Огненный шар",
    icon: "🔥",
    manaCost: 12,
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
    manaCost: 8,
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
  ice_spike: {
    id: "ice_spike",
    name: "Ледяной шип",
    icon: "❄",
    manaCost: 11,
    rarity: "rare",
    target: "direction_ray_5",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Укажи любую видимую клетку (мышью или клавишами — ближайшая к стрелке). Луч по прямой от тебя к точке прицела, до 5 проходимых клеток; урон по цепочке врагов ослабевает вдвое на каждом следующем.",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
  stone_wall: {
    id: "stone_wall",
    name: "Метеорит",
    icon: "☄",
    manaCost: 13,
    rarity: "rare",
    target: "visible_cell",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Любая видимая клетка в обзоре: удар по центру, все враги в 8 соседних клетках отталкиваются на 1 клетку от центра (со столкновениями). Если после удара центр свободен — на 3 хода окружения там появляется каменная стена.",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
  shock_wave: {
    id: "shock_wave",
    name: "Ударная волна",
    icon: "💨",
    manaCost: 14,
    rarity: "unique",
    target: "ring_8_self",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Урон по всем врагам в 8 соседних клетках и отталкивание на 2 клетки от героя (с учётом столкновений). Каменные стены в кольце тоже отталкиваются: при столкновении с котом он получает урон как при столкновении котов; во всех прочих столкновениях стена рассыпается. Цель: своя клетка.",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
  chain_lightning: {
    id: "chain_lightning",
    name: "Цепная молния",
    icon: "⚡",
    manaCost: 15,
    rarity: "unique",
    target: "visible_enemy",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Видимый враг, затем цепочка ударов по области (до 4 попаданий): урон растёт с каждым прыжком. В цепь могут попасть другие коты или вы.",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
  steel_stance: {
    id: "steel_stance",
    name: "Стальная стойка",
    icon: "🛡",
    manaCost: 9,
    rarity: "common",
    target: "self_buff",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Бафф на 2 ваших хода: при ударе кота по вам есть шанс контратаки уроном как у обычного удара мечом.",
    compatibleItems: [{ type: "weapon", subtype: "sword" }],
  },
  whirlwind: {
    id: "whirlwind",
    name: "Вихрь",
    icon: "🌀",
    manaCost: 11,
    rarity: "rare",
    target: "ring_8_self",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Урон по мечу по всем врагам вокруг с одним общим броском крита на весь каст. Цель: своя клетка.",
    compatibleItems: [{ type: "weapon", subtype: "sword" }],
  },
  lunge: {
    id: "lunge",
    name: "Выпад",
    icon: "🗡",
    manaCost: 8,
    rarity: "rare",
    target: "enemy_axis_diag_2",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Рывок на клетку врага на манхэттенской или диагональной дистанции ровно 2, удар мечом и отбрасывание его на 2 клетки по лучу от вас; если на пути другой кот — столкновение с уроном, вы отступаете на свободную клетку рядом с целью.",
    compatibleItems: [{ type: "weapon", subtype: "sword" }],
  },
  cleave: {
    id: "cleave",
    name: "Рассечение",
    icon: "✴",
    manaCost: 10,
    rarity: "rare",
    target: "enemy_adjacent_8",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Сильный удар по соседнему врагу и кровотечение на 3 хода: урон со временем, слабее атаки кота по вам и выше шанс вашего крита по этой цели.",
    compatibleItems: [{ type: "weapon", subtype: "sword" }],
  },
  supremacy: {
    id: "supremacy",
    name: "Превосходство",
    icon: "👑",
    manaCost: 12,
    rarity: "unique",
    target: "enemy_visible_point",
    targeting: {
      charges: 1,
      allowRepeatTarget: false,
      shape: "single",
    },
    description:
      "Видимый враг получает берсерк на несколько фаз: пока рядом есть другие видимые коты, бьёт их вместо вас.",
    compatibleItems: [{ type: "weapon", subtype: "sword" }],
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
        durationMs: FIREBALL_PROJECTILE_MS,
      });
      groupSegments.push({
        kind: "impact",
        style: "fireball_blast_3x3",
        center: to,
        affectedCells: getSkillAffectedCellsForRoot(run, skillId, to.x, to.y),
        durationMs: FIREBALL_IMPACT_MS,
      });
    } else if (skillId === "magic_slap") {
      groupSegments.push({
        kind: "projectile",
        style: "magic_hand",
        from,
        to,
        durationMs: MAGIC_SLAP_PROJECTILE_MS,
      });
      groupSegments.push({
        kind: "impact",
        style: "magic_slap_hit",
        center: to,
        durationMs: MAGIC_SLAP_IMPACT_MS,
      });
    }
    if (groupSegments.length === 0) continue;
    segmentGroups.push({
      startOffsetMs: index * FIREBALL_ROOT_STAGGER_MS,
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
  if (!Array.isArray(run.playerVisibleNow)) {
    computePlayerVisibleMask(run, run.visionRange ?? 6);
  }
  const fromX = Number(run.player.x);
  const fromY = Number(run.player.y);
  const maxRange = Number.isFinite(Number(options.maxRange)) ? Number(options.maxRange) : null;
  const includeWalls = options.includeWalls === true;
  const out = [];
  for (let y = 0; y < run.height; y += 1) {
    for (let x = 0; x < run.width; x += 1) {
      if (!run.discovered?.[y]?.[x]) continue;
      if (!run.playerVisibleNow?.[y]?.[x]) continue;
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

/** Нормализация данных скиллов экземпляра: сохранённые skillIds не перебрасываются заново при каждом вызове — только валидация по пулу предмета и добор до двух слотов. */
export function normalizeSkillInstanceData(item, instanceData, rng = Math.random) {
  if (!isEquipItem(item)) return null;
  const base = instanceData && typeof instanceData === "object" ? instanceData : {};
  const allowedPool = getSkillIdsForItem(item);
  const allowed = new Set(allowedPool);

  const rawSavedIds = Array.isArray(base.skillIds) ? base.skillIds : [];
  const preservedOrder = rawSavedIds.filter((id) => SKILL_DEFS[id] && allowed.has(id));
  const preservedUnique = [...new Set(preservedOrder)].slice(0, 2);

  let skillIds;

  if (preservedUnique.length >= 2) {
    skillIds = preservedUnique;
  } else if (preservedUnique.length === 1) {
    const first = preservedUnique[0];
    const rest = allowedPool.filter((id) => id !== first);
    if (rest.length === 0) {
      skillIds = [first];
    } else if (rest.length === 1) {
      skillIds = [first, rest[0]];
    } else {
      const extra = pickNRandomUnique(rest, 1, rng)[0];
      skillIds = extra ? [first, extra] : [first];
    }
  } else {
    skillIds = rollSkillIdsForItem(item, rng);
  }

  const originalPersisted = new Set(rawSavedIds.filter((id) => SKILL_DEFS[id] && allowed.has(id)));

  const sourceLevels = base.skillLevels && typeof base.skillLevels === "object"
    ? base.skillLevels
    : {};
  const skillLevels = {};
  for (const skillId of skillIds) {
    const maxLevel = getMaxSkillLevelForEquip(item);
    const sourceLevel = Number(sourceLevels[skillId]);
    if (sourceLevel >= 1 && sourceLevel <= maxLevel) {
      skillLevels[skillId] = Math.floor(sourceLevel);
    } else if (originalPersisted.has(skillId)) {
      const clamped = Number.isFinite(sourceLevel) ? Math.floor(sourceLevel) : 1;
      skillLevels[skillId] = Math.min(maxLevel, Math.max(1, clamped));
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
  if (EXTENSION_SKILL_IDS.has(skillId)) {
    return getExtensionSkillAffectedCells(run, skillId, rootX, rootY);
  }
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
  stone_wall: {
    getHoverData: (skill, item, playerSheet) => {
      const skillLevel = Math.max(1, Number(skill?.level || 1));
      const { centerDamage, wallBonusSpell } = getMeteorSkillNumbers(skillLevel, playerSheet);
      return {
        formula:
          "Урон по центру: как у базового посохового заклинания (8 + ИНТ×0,35 + 2 за уровень скилла после первого, минимум 1). Порождённая стена даёт бонус к урону заклинаниям, разбивающим стены на луче: 35% от того же базового значения, минимум 1.",
        targets: "Любая видимая клетка в обзоре, кроме клетки героя. По кольцу из 8 клеток вокруг центра — только отталкивание.",
        skillLevel,
        damageCenter: centerDamage,
      };
    },
  },
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
  if (EXTENSION_SKILL_IDS.has(skillId)) {
    return getExtensionSkillTargets(run, playerSheet, skillId);
  }
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
  if (!skill || !Array.isArray(selectedRoots)) {
    return null;
  }
  const previewWithoutRoots = skillId === "shock_wave" || skillId === "whirlwind";
  if (selectedRoots.length === 0 && !previewWithoutRoots) {
    return null;
  }
  if (EXTENSION_SKILL_IDS.has(skillId)) {
    const agg = aggregateExtendedSkillPreview(run, playerSheet, skill, instanceData, skillId, selectedRoots);
    if (!agg?.byCell?.length) {
      return null;
    }
    return {
      byCell: agg.byCell.map((entry) => ({
        ...entry,
        statusEffects: Array.isArray(entry.statusEffects) ? entry.statusEffects : [],
      })),
    };
  }
  const resolver = SKILLS_APPLY_BY_ID[skillId];
  if (!resolver) {
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
    const wallRayBonusDamage = skillId === "fireball"
      ? destroyStoneWallsAlongCasterSegment(run, run.player.x, run.player.y, root.x, root.y)
      : 0;
    const groupDurationMs = (group.segments || []).reduce(
      (sum, segment) => sum + Math.max(1, Number(segment.durationMs || 0)),
      0,
    );
    out.push({
      skillId,
      applyAtMs: Number(castStartMs) + Math.max(0, Number(group.startOffsetMs || 0)) + groupDurationMs,
      aggregated,
      wallRayBonusDamage,
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
  let wallBonusRemain = Math.max(0, floorHp(options.wallRayBonusDamage || 0));
  for (const target of aggregated.byCell) {
    const x = Number(target.x);
    const y = Number(target.y);
    let damage = Math.max(0, floorHp(target.targetDamage || 0));
    if (wallBonusRemain > 0 && target.role === "epicenter") {
      damage += wallBonusRemain;
      logs.push(`Каменная стена на пути разбивается: +${wallBonusRemain} к урону центра.`);
      wallBonusRemain = 0;
    }
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
    const result = applyAggregatedEffects(run, playerSheet, skill, entry.aggregated, {
      wallRayBonusDamage: entry.wallRayBonusDamage || 0,
    });
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

  if (EXTENSION_SKILL_IDS.has(skillId)) {
    const skillWithLevel = {
      ...skill,
      level: Math.max(1, Number(instanceData?.skillLevels?.[skillId] || 1)),
    };
    const ext = applyExtensionSkillPrepared(run, playerSheet, skillWithLevel, instanceData, selectedRoots, actualManaCost);
    if (!ext.ok) {
      playerSheet.mana = roundManaValue((playerSheet.mana || 0) + actualManaCost);
      return {
        run,
        playerSheet,
        instanceData,
        ok: false,
        actionConsumed: false,
        log: ext.log || "",
      };
    }
    return {
      run,
      playerSheet,
      instanceData,
      ok: true,
      actionConsumed: ext.actionConsumed !== false,
      log: ext.log || "",
    };
  }

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
  let wallRayBonusDamage = 0;
  if (skillId === "fireball" && Array.isArray(selectedRoots) && selectedRoots.length > 0) {
    const r0 = selectedRoots[0];
    wallRayBonusDamage = destroyStoneWallsAlongCasterSegment(run, run.player.x, run.player.y, r0.x, r0.y);
  }
  const result = applyAggregatedEffects(run, playerSheet, skill, aggregated, { wallRayBonusDamage });
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
