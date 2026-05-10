import { getSkillTargetCells, getSkillsForEquippedItem } from "../skillsRuntime.js?v=0.5.7-pre-alpha";

export function getSkillTargetsByKind(run, playerSheet, skillId, getItemContext = null) {
  const context = typeof getItemContext === "function" ? getItemContext(playerSheet, skillId) : null;
  if (!context) return [];
  const activeSkills = getSkillsForEquippedItem(context.item, context.instanceEntry.skill || null);
  const activeSkill = activeSkills.find((skill) => skill.id === skillId) || null;
  if (!activeSkill) return [];
  return getSkillTargetCells(run, playerSheet, skillId);
}
