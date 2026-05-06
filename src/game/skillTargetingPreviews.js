import { getWeaponSkillPreviewAtCell } from "../weaponSkills.js?v=0.4.8-pre-alpha";
import { getHealSkillEffectiveValue, getRegenHealPerTurn } from "../skills/coreSkillCalc.js?v=0.4.8-pre-alpha";

export function buildSkillTargetingPreviews(run, playerSheet, targeting, targetCell, getWeaponContext) {
  if (!run || !playerSheet || !targeting?.skillId || !targetCell) return [];
  const isValidTarget = (targeting.targets || []).some((cell) => cell.x === targetCell.x && cell.y === targetCell.y);
  if (!isValidTarget) return [];
  if (targeting.skillKind === "weapon") {
    const context = typeof getWeaponContext === "function" ? getWeaponContext(playerSheet) : null;
    if (!context) return [];
    const preview = getWeaponSkillPreviewAtCell(
      run,
      playerSheet,
      context.item,
      context.instanceEntry.weapon || null,
      targeting.skillId,
      targetCell.x,
      targetCell.y,
    );
    if (!preview) return [];
    const entries = [];
    if (preview.targetDamage > 0) {
      entries.push({ x: targetCell.x, y: targetCell.y, value: `-${preview.targetDamage}`, color: "#ef4444" });
    }
    if (preview.targetHeal > 0) {
      entries.push({ x: targetCell.x, y: targetCell.y, value: `+${preview.targetHeal}`, color: "#22c55e" });
    }
    if (preview.playerManaRestore > 0) {
      entries.push({ x: run.player.x, y: run.player.y, value: `+${preview.playerManaRestore}`, color: "#60a5fa" });
    }
    return entries;
  }
  if (targeting.skillKind === "core" && targeting.skillId === "skill_support_heal") {
    const skillLevel = Math.max(1, Number(playerSheet.skills?.[targeting.skillId]?.level || 1));
    const heal = getHealSkillEffectiveValue(playerSheet, skillLevel);
    if (heal <= 0) return [];
    return [{ x: run.player.x, y: run.player.y, value: `+${heal}`, color: "#22c55e" }];
  }
  if (targeting.skillKind === "core" && targeting.skillId === "skill_support_regen") {
    const skillLevel = Math.max(1, Number(playerSheet.skills?.[targeting.skillId]?.level || 1));
    const healPerTurn = getRegenHealPerTurn(skillLevel, playerSheet);
    return [{ x: run.player.x, y: run.player.y, value: `+${healPerTurn}`, color: "#22c55e" }];
  }
  return [];
}
