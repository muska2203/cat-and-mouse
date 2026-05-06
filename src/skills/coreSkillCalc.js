import { floorHp, floorHpMax } from "../rules.js?v=0.4.8-pre-alpha";

export function getRegenHealPerTurn(skillLevel, playerSheet) {
  const level = Math.max(1, Number(skillLevel || 1));
  const hpMax = floorHpMax(playerSheet?.stats?.HP_MAX ?? playerSheet?.baseStats?.HP_MAX ?? 1);
  if (level === 1) return Math.floor(hpMax * 0.08);
  if (level === 2) return Math.floor(hpMax * 0.10);
  return Math.floor(hpMax * 0.13);
}

export function getRegenTotalHeal(skillLevel, playerSheet, turns = 3) {
  return getRegenHealPerTurn(skillLevel, playerSheet) * Math.max(1, Number(turns || 1));
}

export function getHealSkillRawValue(skillLevel, playerSheet) {
  const level = Math.max(1, Number(skillLevel || 1));
  const intStat = playerSheet?.stats?.INT ?? playerSheet?.baseStats?.INT ?? 0;
  return 20 + (intStat * 1.6) + (level * 10);
}

export function getHealSkillEffectiveValue(playerSheet, skillLevel) {
  const healRaw = getHealSkillRawValue(skillLevel, playerSheet);
  const hpNow = floorHp(playerSheet?.stats?.HP ?? playerSheet?.baseStats?.HP ?? 0);
  const hpMax = floorHpMax(playerSheet?.stats?.HP_MAX ?? playerSheet?.baseStats?.HP_MAX ?? 1);
  return Math.max(0, Math.min(healRaw, Math.max(0, hpMax - hpNow)));
}

export function getCoreSkillFormulaText(skillId, skillLevel) {
  if (skillId === "skill_support_regen") {
    const level = Math.max(1, Number(skillLevel || 1));
    let percent = 8;
    if (level === 2) percent = 10;
    if (level >= 3) percent = 13;
    return `Лечение за ход = ${percent}% от МАКС HP. Длительность: 3 хода.`;
  }
  if (skillId === "skill_support_heal") {
    return `Лечение = 20 + ИНТ × 1.6 + уровень × 10.`;
  }
  return "Формула не указана.";
}
