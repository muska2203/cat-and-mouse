export function buildCanvasOverlayViewModel(uiHud) {
  return {
    hoverCell: uiHud?.pathHoverCell || null,
    hoverCellEnemy: uiHud?.pathHoverEnemy || null,
    previewPathCells: uiHud?.pathPreviewCells || [],
    lockedPathCells: uiHud?.pathLockedCells || [],
    lockedPathTarget: uiHud?.pathLockedTarget || null,
    lockedPathEnemyId: uiHud?.pathLockedEnemyId || null,
    skillTargetCells: uiHud?.skillTargeting?.targets || uiHud?.trapTargeting?.targets || [],
    skillTargetingPreviews: uiHud?.skillTargetingPreviews || [],
    skillTargetingPreview: uiHud?.skillTargetingPreview || null,
  };
}
