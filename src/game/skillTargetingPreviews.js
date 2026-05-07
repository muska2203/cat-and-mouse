import { getSkillPreviewAtCell } from "../skillsRuntime.js?v=0.4.10-pre-alpha";

export function buildSkillTargetingPreviews(run, playerSheet, targeting, targetCell, getItemContext) {
  if (!run || !playerSheet || !targeting?.skillId || !targetCell) return [];
  const isValidTarget = (targeting.targets || []).some((cell) => cell.x === targetCell.x && cell.y === targetCell.y);
  if (!isValidTarget) return [];
  const context = typeof getItemContext === "function" ? getItemContext(playerSheet, targeting.skillId) : null;
  if (!context) return [];
  const preview = getSkillPreviewAtCell(
    run,
    playerSheet,
    context.item,
    context.instanceEntry.skill || null,
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
