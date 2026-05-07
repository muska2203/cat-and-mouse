import { floorHp, floorHpMax } from "./rules.js?v=0.4.9-pre-alpha";
import { syncPlayerHp } from "./game/syncHp.js?v=0.4.9-pre-alpha";
import { getEnemyMaxHp as getEnemyMaxHpFromDefs } from "./game/enemyDefs.js?v=0.4.9-pre-alpha";
import { applyDamageToEnemyAndResolveDefeat } from "./game/enemyCombat.js?v=0.4.9-pre-alpha";
import { ensureRunFxState } from "./runtime/runFxState.js?v=0.4.9-pre-alpha";
import { hasLineOfSightOnGrid } from "./nav/lineOfSight.js?v=0.4.9-pre-alpha";

import { getSkillManaCost } from "./skills.js?v=0.4.9-pre-alpha";

const SKILL_DEFS = {
  mystic_ritual: {
    id: "mystic_ritual",
    name: "Мистический ритуал",
    icon: "🩸",
    manaCost: 0,
    cooldownTurns: 5,
    rarity: "rare",
    target: "single_unit",
    description: "Выбери клетку с противником или персонажем.",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
  magic_slap: {
    id: "magic_slap",
    name: "Магический шлепок",
    icon: "💫",
    manaCost: 15,
    cooldownTurns: 2,
    rarity: "common",
    target: "single_unit",
    description: "Сгусток магической энергии, бьющий врага по лицу.",
    compatibleItems: [{ type: "weapon", subtype: "staff" }],
  },
};

function getLifeDrainParams(skillLevel, playerSheet) {
  const normalizedLevel = Math.max(1, Number(skillLevel || 1));
  const intStat = playerSheet?.stats?.INT ?? playerSheet?.baseStats?.INT ?? 0;
  
  // Damage: 10% base + 1.6% per INT + 5% per level
  const damagePercent = 0.10 + (intStat * 0.016) + (normalizedLevel * 0.05);
  
  // Mana restore: 15% base + 0.8% per INT + 5% per level
  const manaPercent = 0.15 + (intStat * 0.008) + (normalizedLevel * 0.05);
  
  return {
    skillLevel: normalizedLevel,
    damagePercent,
    manaPercent,
  };
}

function getLifeDrainManaRestore(playerSheet, manaPercent) {
  const manaMaxFromSheet = Number(playerSheet?.manaMax);
  const manaMaxFallback = 30 + Number(playerSheet?.stats?.INT || 0) * 6;
  const manaMax = Number.isFinite(manaMaxFromSheet) && manaMaxFromSheet > 0
    ? manaMaxFromSheet
    : manaMaxFallback;
  return Math.max(0, floorHp(manaMax * manaPercent));
}

function getLifeDrainDamageByTargetHpMax(targetHpMax, damagePercent) {
  return Math.max(1, floorHp(Math.max(1, Number(targetHpMax || 1)) * damagePercent));
}

function getMagicSlapDamage(skillLevel, playerSheet) {
  const level = Math.max(1, Number(skillLevel || 1));
  const intStat = playerSheet?.stats?.INT ?? playerSheet?.baseStats?.INT ?? 0;
  const base = 5 + (intStat * 1.2);
  const multiplier = 1 + ((level - 1) * 0.2);
  return Math.max(1, Math.floor(base * multiplier));
}

function getEnemyMaxHp(enemy) {
  return floorHpMax(getEnemyMaxHpFromDefs(enemy));
}

function getItemRarity(item) {
  const id = String(item?.id || "");
  if (id.startsWith("unique_")) return "unique";
  if (id.startsWith("rare_")) return "rare";
  return "common";
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

function getVisibleEnemyTargetCells(run) {
  if (!run?.player || !Array.isArray(run?.objects) || !run?.grid) {
    return [];
  }
  const fromX = Number(run.player.x);
  const fromY = Number(run.player.y);
  return run.objects
    .filter((object) => object?.type === "enemy")
    .filter((enemy) => hasLineOfSightOnGrid(run.grid, fromX, fromY, Number(enemy.x), Number(enemy.y)))
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
    skillCooldowns: {},
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
  const skillCooldowns = {};
  const sourceCooldowns = base.skillCooldowns && typeof base.skillCooldowns === "object"
    ? base.skillCooldowns
    : {};
  const sourceLevels = base.skillLevels && typeof base.skillLevels === "object"
    ? base.skillLevels
    : {};
  const skillLevels = {};
  for (const skillId of skillIds) {
    const value = Number(sourceCooldowns[skillId] || 0);
    skillCooldowns[skillId] = Math.max(0, Math.floor(value));
    const sourceLevel = Number(sourceLevels[skillId] || 0);
    const maxLevel = getMaxSkillLevelForEquip(item);
    if (sourceLevel >= 1 && sourceLevel <= maxLevel) {
      skillLevels[skillId] = Math.floor(sourceLevel);
    } else {
      skillLevels[skillId] = rollSkillLevelForItem(item, rng);
    }
  }
  return { skillIds, skillLevels, skillCooldowns };
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
        cooldownLeft: Math.max(0, Number(normalized.skillCooldowns?.[skillId] || 0)),
      };
    })
    .filter(Boolean);
}

export const SKILLS_APPLY_BY_ID = {
  mystic_ritual: {
    getTargets: (run, playerSheet) => {
      const cells = [{ x: run.player.x, y: run.player.y }];
      cells.push(...getVisibleEnemyTargetCells(run));
      return cells;
    },
    getHoverData: (skill, item, playerSheet) => {
      const lifeDrain = getLifeDrainParams(skill?.level || 1, playerSheet);
      return {
        formula: `Урон = HP МАКС цели x ${Math.round(lifeDrain.damagePercent * 100)}%. Восстановление маны = МП МАКС персонажа x ${Math.round(lifeDrain.manaPercent * 100)}%.`,
        targets: "Одна клетка с противником или персонажем.",
        cooldownBase: skill.cooldownTurns,
        skillLevel: lifeDrain.skillLevel,
        damagePercent: Math.round(lifeDrain.damagePercent * 100),
        manaPercent: Math.round(lifeDrain.manaPercent * 100),
      };
    },
    getEffects: (run, playerSheet, skill, instanceData, targetX, targetY) => {
      const lifeDrain = getLifeDrainParams(instanceData?.skillLevels?.[skill.id] || 1, playerSheet);
      const manaRestore = getLifeDrainManaRestore(playerSheet, lifeDrain.manaPercent);
      
      let targetDamage = 0;
      if (targetX === run.player.x && targetY === run.player.y) {
        const playerHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1);
        targetDamage = getLifeDrainDamageByTargetHpMax(playerHpMax, lifeDrain.damagePercent);
      } else {
        const enemy = (run.objects || []).find((object) => object.type === "enemy" && object.x === targetX && object.y === targetY);
        if (enemy) {
          const enemyHpMax = getEnemyMaxHp(enemy);
          targetDamage = getLifeDrainDamageByTargetHpMax(enemyHpMax, lifeDrain.damagePercent);
        }
      }
      
      return {
        targetDamage,
        playerManaRestore: manaRestore,
      };
    },
    apply: (run, playerSheet, skill, instanceData, targetX, targetY) => {
      const effects = SKILLS_APPLY_BY_ID[skill.id].getEffects(run, playerSheet, skill, instanceData, targetX, targetY);
      const damage = effects.targetDamage || 0;
      const restoredMana = effects.playerManaRestore || 0;
      let log = "";
      
      if (targetX === run.player.x && targetY === run.player.y) {
        const playerHpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
        const playerHpNext = floorHp(playerHpNow - damage);
        syncPlayerHp(playerSheet, playerHpNext);
        log = `${skill.name}: мышонок получает ${damage} урона.`;
      } else {
        const enemy = (run.objects || []).find((object) => object.type === "enemy" && object.x === targetX && object.y === targetY);
        if (!enemy) {
          return { ok: false, log: "На клетке нет подходящей цели." };
        }
        const combatResult = applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, damage);
        log = `${skill.name}: ${enemy.name} получает ${damage} урона.`;
        if (combatResult.defeated) {
          log += ` ${combatResult.defeatLog}`;
        }
      }

      const manaNow = Number(playerSheet.mana || 0);
      const manaCap = Number(playerSheet.manaMax || 0);
      const manaNext = Math.max(0, Math.min(manaCap, manaNow + restoredMana));
      const manaDelta = Math.max(0, manaNext - manaNow);
      playerSheet.mana = manaNext;
      
      const fx = ensureRunFxState(run);
      if (manaDelta > 0) {
        fx.floatingTexts.push({
          x: run.player.x,
          y: run.player.y,
          value: `+${manaDelta}`,
          color: "#60a5fa",
          durationMs: 700,
          scale: 1.05,
          startMs: null,
        });
        log += ` Маны: +${manaDelta}.`;
      }
      
      return { ok: true, log };
    }
  },
  magic_slap: {
    getTargets: (run, playerSheet) => {
      return getVisibleEnemyTargetCells(run);
    },
    getHoverData: (skill, item, playerSheet) => {
      const damage = getMagicSlapDamage(skill?.level || 1, playerSheet);
      return {
        formula: `Урон = (5 + ИНТ x 1.2) x (1 + 20% за каждый уровень после первого).`,
        targets: "Одна клетка с противником.",
        cooldownBase: skill.cooldownTurns,
        skillLevel: skill?.level || 1,
        damage: damage,
      };
    },
    getEffects: (run, playerSheet, skill, instanceData, targetX, targetY) => {
      const damage = getMagicSlapDamage(instanceData?.skillLevels?.[skill.id] || 1, playerSheet);
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
      fx.floatingTexts.push({
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

export function tickSkillCooldowns(instanceData) {
  if (!instanceData || typeof instanceData !== "object") return instanceData;
  const cooldowns = instanceData.skillCooldowns || {};
  const next = {};
  for (const [skillId, turnsLeft] of Object.entries(cooldowns)) {
    next[skillId] = Math.max(0, Math.floor(Number(turnsLeft || 0)) - 1);
  }
  return {
    ...instanceData,
    skillCooldowns: next,
  };
}

export function buildSkillHoverData(skill, item, playerSheet) {
  if (!skill) return null;
  const resolver = SKILLS_APPLY_BY_ID[skill.id];
  if (resolver && resolver.getHoverData) {
    return resolver.getHoverData(skill, item, playerSheet);
  }
  return null;
}

export function useSkillAtCell(run, playerSheet, item, instanceData, skillId, targetX, targetY) {
  if (!run || !playerSheet || !item || !instanceData || !skillId) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: "" };
  }
  const skill = getSkillById(skillId);
  if (!skill) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: "Неизвестный скилл." };
  }
  const cooldownLeft = Math.max(0, Number(instanceData.skillCooldowns?.[skillId] || 0));
  if (cooldownLeft > 0) {
    return {
      run,
      playerSheet,
      instanceData,
      ok: false,
      actionConsumed: false,
      log: `${skill.name}: перезарядка ${cooldownLeft} х.`,
    };
  }
  const targetCells = getSkillTargetCells(run, playerSheet, skillId);
  const isValidTarget = targetCells.some((cell) => cell.x === targetX && cell.y === targetY);
  if (!isValidTarget) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: "Неверная клетка для скилла." };
  }

  const resolver = SKILLS_APPLY_BY_ID[skillId];
  if (!resolver || !resolver.apply) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: "Скилл пока не поддержан." };
  }

  const result = resolver.apply(run, playerSheet, skill, instanceData, targetX, targetY);
  
  if (!result.ok) {
    return { run, playerSheet, instanceData, ok: false, actionConsumed: false, log: result.log };
  }

  const nextCooldowns = {
    ...(instanceData.skillCooldowns || {}),
    [skillId]: Math.max(0, Math.floor(skill.cooldownTurns || 0)),
  };
  const nextInstanceData = {
    ...instanceData,
    skillCooldowns: nextCooldowns,
  };
  
  run.lastLog = result.log;
  return {
    run,
    playerSheet,
    instanceData: nextInstanceData,
    ok: true,
    actionConsumed: true,
    log: result.log,
  };
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

    let { targetDamage = 0, targetHeal = 0, playerManaRestore = 0 } = effects;

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

    return { targetDamage, targetHeal, playerManaRestore };
  }
  
  return null;
}

function rollSkillLevelForItem(item, rng = Math.random) {
  const maxLevel = Math.max(1, getMaxSkillLevelForEquip(item));
  const level = 1 + Math.floor(Math.max(0, Math.min(0.999999, rng())) * maxLevel);
  return Math.max(1, Math.min(maxLevel, level));
}
