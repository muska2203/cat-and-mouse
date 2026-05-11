import { getSkillPreviewForPreparedSelections } from "../skillsRuntime.js?v=0.5.8-pre-alpha";

export function buildSkillTargetingPreviews(run, playerSheet, targeting, targetCell, getItemContext) {
  if (!run || !playerSheet || !targeting?.skillId || !targetCell) return [];
  const isValidTarget = (targeting.targets || []).some((cell) => cell.x === targetCell.x && cell.y === targetCell.y);
  if (!isValidTarget) return [];
  const context = typeof getItemContext === "function" ? getItemContext(playerSheet, targeting.skillId) : null;
  if (!context) return [];
  const selectedRoots = [...(targeting.selectedRoots || []), { x: targetCell.x, y: targetCell.y }];
  return getSkillPreviewForPreparedSelections(
    run,
    playerSheet,
    context.item,
    context.instanceEntry.skill || null,
    targeting.skillId,
    selectedRoots,
  );
}
