import { getSkillById, getSkillManaCost } from "../skillsRuntime.js?v=0.5.1-pre-alpha";
import { revealAroundPlayer } from "./fogReveal.js?v=0.5.1-pre-alpha";
import { ensureRunFxState } from "../runtime/runFxState.js?v=0.5.1-pre-alpha";

export function useSkill(run, playerSheet, skillId) {
  return useSkillAtCell(run, playerSheet, skillId, run?.player?.x, run?.player?.y);
}

export const CORE_SKILLS_APPLY_BY_ID = {};

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
