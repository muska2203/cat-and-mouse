import { getSkillById } from "../skills.js?v=0.4.5-pre-alpha";
import { floorHp, floorHpMax } from "../rules.js?v=0.4.5-pre-alpha";
import { syncPlayerHp } from "./syncHp.js?v=0.4.5-pre-alpha";
import { revealAroundPlayer } from "./fogReveal.js?v=0.4.5-pre-alpha";

export function useSkill(run, playerSheet, skillId) {
  return useSkillAtCell(run, playerSheet, skillId, run?.player?.x, run?.player?.y);
}

export function getSkillTargetCells(run, playerSheet, skillId) {
  if (!run || !playerSheet || !skillId) {
    return [];
  }
  const normalizedSkillId = getSkillById(skillId)?.id || skillId;
  const skillState = playerSheet.skills?.[normalizedSkillId] || playerSheet.skills?.[skillId];
  if (!skillState?.learned || skillState.level <= 0) {
    return [];
  }
  const px = run.player.x;
  const py = run.player.y;
  const result = [];
  if (normalizedSkillId === "skill_support_regen") {
    const hasBandageActive = (run.overTimeEffects || []).some((effect) => effect.type === "bandage_regen");
    if (!hasBandageActive) {
      result.push({ x: px, y: py });
    }
  } else if (normalizedSkillId === "skill_support_heal") {
    result.push({ x: px, y: py });
  }
  return result;
}

export function useSkillAtCell(run, playerSheet, skillId, targetX, targetY) {
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
  const manaCost = Math.max(1, skillDef.manaCost);
  const mana = playerSheet.mana ?? 0;
  if (mana < manaCost) {
    return { run, playerSheet, ok: false, log: "Недостаточно маны.", actionConsumed: false };
  }
  const validTargets = getSkillTargetCells(run, playerSheet, normalizedSkillId);
  const isValidTarget = validTargets.some((cell) => cell.x === targetX && cell.y === targetY);
  if (!isValidTarget) {
    return { run, playerSheet, ok: false, log: "Неверная клетка для скилла.", actionConsumed: false };
  }

  let log = "";
  let ok = false;
  if (normalizedSkillId === "skill_support_regen") {
    const hasBandageActive = (run.overTimeEffects || []).some((effect) => effect.type === "bandage_regen");
    if (hasBandageActive) {
      log = `${skillDef.name}: эффект уже активен.`;
    } else {
      const healPerTurn = 5 + skillLevel;
      run.overTimeEffects = [...(run.overTimeEffects || []), {
        type: "bandage_regen",
        turnsLeft: 3,
        healPerTurn,
        sourceSkillId: normalizedSkillId,
      }];
      log = `${skillDef.name}: восстановление ${healPerTurn} HP на 3 хода.`;
      ok = true;
    }
  } else if (normalizedSkillId === "skill_support_heal") {
    const healValue = 40 + Math.max(0, (skillLevel - 1) * 10);
    const hpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1);
    const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
    const nextHp = floorHp(Math.min(hpMax, hpNow + healValue));
    const healed = floorHp(nextHp - hpNow);
    syncPlayerHp(playerSheet, nextHp);
    run.floatingTexts.push({
      x: run.player.x,
      y: run.player.y,
      value: `+${healed}`,
      color: "#4ade80",
      durationMs: 680,
      scale: 1.15,
      startMs: null,
    });
    log = `${skillDef.name}: восстановлено ${healed} HP.`;
    ok = true;
  }

  if (ok) {
    playerSheet.mana = Math.max(0, mana - manaCost);
    if (playerSheet.stats.HP <= 0) {
      run.status = "defeat";
    } else if (run.player.x === run.goal.x && run.player.y === run.goal.y) {
      // Переход уровня обрабатывается в applyObjectActivationOnCell для единой модели сущностей.
    }
    revealAroundPlayer(run, run.visionRange || 6);
  }
  run.lastLog = log;
  return { run, playerSheet, ok, log, actionConsumed: ok };
}
