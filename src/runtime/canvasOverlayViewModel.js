export function buildCanvasOverlayViewModel(uiHud) {
  let skillTargetCells = [];
  if (uiHud?.trapTargeting?.targets?.length) {
    skillTargetCells = uiHud.trapTargeting.targets;
  } else if (uiHud?.skillTargeting?.skillId === "ice_spike") {
    /* Прицел — любая видимая клетка; подсветка зоны не нужна, достаточно луча по hover (skillTargetingAffectedCells). */
    skillTargetCells = [];
  } else if (uiHud?.skillTargeting?.targets?.length) {
    skillTargetCells = uiHud.skillTargeting.targets;
  }
  return {
    hoverCell: uiHud?.pathHoverCell || null,
    hoverCellEnemy: uiHud?.pathHoverEnemy || null,
    previewPathCells: uiHud?.pathPreviewCells || [],
    lockedPathCells: uiHud?.pathLockedCells || [],
    lockedPathTarget: uiHud?.pathLockedTarget || null,
    lockedPathEnemyId: uiHud?.pathLockedEnemyId || null,
    skillTargetCells,
    skillTargetAffectedCells: uiHud?.skillTargetingAffectedCells || [],
    skillTargetingPreviews: uiHud?.skillTargetingPreviews || [],
    skillTargetingPreview: uiHud?.skillTargetingPreview || null,
    skillTargetingCursorCell: uiHud?.skillTargetingCursorCell || null,
    skillTargetingChargeBadge: uiHud?.skillTargetingChargeBadge ?? null,
    targetingLines: uiHud?.targetingLines || [],
    skillMotionPreviewArrows: uiHud?.skillMotionPreviewArrows || [],
  };
}
