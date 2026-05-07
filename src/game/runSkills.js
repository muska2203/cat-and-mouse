import { getSkillById, getSkillManaCost } from "../skills.js?v=0.4.10-pre-alpha";
import { floorHp, floorHpMax } from "../rules.js?v=0.4.10-pre-alpha";
import { syncPlayerHp } from "./syncHp.js?v=0.4.10-pre-alpha";
import { revealAroundPlayer } from "./fogReveal.js?v=0.4.10-pre-alpha";
import { getHealSkillRawValue, getRegenHealPerTurn } from "../skills/coreSkillCalc.js?v=0.4.10-pre-alpha";
import { ensureRunFxState } from "../runtime/runFxState.js?v=0.4.10-pre-alpha";

export function useSkill(run, playerSheet, skillId) {
  return useSkillAtCell(run, playerSheet, skillId, run?.player?.x, run?.player?.y);
}

export const CORE_SKILLS_APPLY_BY_ID = {
  skill_support_regen: {
    getTargets: (run, playerSheet) => {
      const hasBandageActive = (run.overTimeEffects || []).some((effect) => effect.type === "bandage_regen");
      return hasBandageActive ? [] : [{ x: run.player.x, y: run.player.y }];
    },
    apply: (run, playerSheet, skillDef, skillLevel) => {
      const hasBandageActive = (run.overTimeEffects || []).some((effect) => effect.type === "bandage_regen");
      if (hasBandageActive) {
        return { ok: false, log: `${skillDef.name}: эффект уже активен.` };
      }
      
      const actualManaCost = getSkillManaCost(skillDef, playerSheet);
      if ((playerSheet.mana || 0) < actualManaCost) {
        return { ok: false, log: "Недостаточно маны." };
      }
      playerSheet.mana -= actualManaCost;

      const healPerTurn = getRegenHealPerTurn(skillLevel, playerSheet);
      run.overTimeEffects = [...(run.overTimeEffects || []), {
        type: "bandage_regen",
        turnsLeft: 3,
        healPerTurn,
        sourceSkillId: skillDef.id,
      }];
      return { ok: true, log: `${skillDef.name}: восстановление ${healPerTurn} HP на 3 хода.` };
    }
  },
  skill_support_heal: {
    getTargets: (run, playerSheet) => {
      return [{ x: run.player.x, y: run.player.y }];
    },
    apply: (run, playerSheet, skillDef, skillLevel, fx) => {
      const actualManaCost = getSkillManaCost(skillDef, playerSheet);
      if ((playerSheet.mana || 0) < actualManaCost) {
        return { ok: false, log: "Недостаточно маны." };
      }
      playerSheet.mana -= actualManaCost;

      const healValue = getHealSkillRawValue(skillLevel, playerSheet);
      const hpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1);
      const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const nextHp = floorHp(Math.min(hpMax, hpNow + healValue));
      const healed = floorHp(nextHp - hpNow);
      syncPlayerHp(playerSheet, nextHp);
      fx.floatingTexts.push({
        x: run.player.x,
        y: run.player.y,
        value: `+${healed}`,
        color: "#4ade80",
        durationMs: 680,
        scale: 1.15,
        startMs: null,
      });
      return { ok: true, log: `${skillDef.name}: восстановлено ${healed} HP.` };
    }
  }
};

export function getSkillTargetCells(run, playerSheet, skillId) {
  if (!run || !playerSheet || !skillId) {
    return [];
  }
  const normalizedSkillId = getSkillById(skillId)?.id || skillId;
  const skillState = playerSheet.skills?.[normalizedSkillId] || playerSheet.skills?.[skillId];
  if (!skillState?.learned || skillState.level <= 0) {
    return [];
  }
  
  const resolver = CORE_SKILLS_APPLY_BY_ID[normalizedSkillId];
  if (resolver && resolver.getTargets) {
    return resolver.getTargets(run, playerSheet);
  }
  
  return [];
}

export function useSkillAtCell(run, playerSheet, skillId, targetX, targetY) {
  const fx = ensureRunFxState(run);
  if (!run || !playerSheet || !skillId) {
    return { run, playerSheet, ok: false, log: "", actionConsumed: false };
  }
  const skillDef = getSkillById(skillId);
  const normalizedSkillId = skillDef?.id || skillId;
  const skillState = playerSheet.skills?.[normalizedSkillId] || playerSheet.skills?.[skillId];
  if (!skillDef || !skillState?.learned || skillState.level <= 0) {
    return { run, playerSheet, ok: false, log: "Скилл не изучен.", actionConsumed: false };
  }

  const skillLevel = skillState.level;
  const validTargets = getSkillTargetCells(run, playerSheet, normalizedSkillId);
  const isValidTarget = validTargets.some((cell) => cell.x === targetX && cell.y === targetY);
  if (!isValidTarget) {
    return { run, playerSheet, ok: false, log: "Неверная клетка для скилла.", actionConsumed: false };
  }

  const resolver = CORE_SKILLS_APPLY_BY_ID[normalizedSkillId];
  if (!resolver || !resolver.apply) {
    return { run, playerSheet, ok: false, log: "Скилл пока не поддержан.", actionConsumed: false };
  }

  const result = resolver.apply(run, playerSheet, skillDef, skillLevel, fx, targetX, targetY);
  
  if (result.ok) {
    if (playerSheet.stats.HP <= 0) {
      run.status = "defeat";
    }
    revealAroundPlayer(run, run.visionRange || 6);
  }
  run.lastLog = result.log;
  return { run, playerSheet, ok: result.ok, log: result.log, actionConsumed: result.ok };
}
