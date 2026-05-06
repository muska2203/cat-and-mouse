import { getSkillTargetCells } from "./runSkills.js?v=0.4.8-pre-alpha";
import { getWeaponSkillTargetCells, getWeaponSkillsForEquippedWeapon } from "../weaponSkills.js?v=0.4.8-pre-alpha";

export function getSkillTargetsByKind(run, playerSheet, skillId, skillKind = "core", getWeaponContext = null) {
  if (skillKind === "weapon") {
    const context = typeof getWeaponContext === "function" ? getWeaponContext(playerSheet) : null;
    if (!context) return [];
    const activeSkills = getWeaponSkillsForEquippedWeapon(context.item, context.instanceEntry.weapon || null);
    const activeSkill = activeSkills.find((skill) => skill.id === skillId) || null;
    if (!activeSkill) return [];
    if (Math.max(0, Number(activeSkill.cooldownLeft || 0)) > 0) return [];
    return getWeaponSkillTargetCells(run, playerSheet, skillId);
  }
  return getSkillTargetCells(run, playerSheet, skillId);
}
