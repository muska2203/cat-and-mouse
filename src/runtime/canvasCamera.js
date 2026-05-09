export function normalizeCanvasZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) {
    return 1;
  }
  return Math.max(0.35, Math.min(3, zoom));
}

export function getCanvasTileSize(viewWidth, viewHeight, zoomScale = 1) {
  return Math.max(16, Math.floor((Math.min(viewWidth, viewHeight) / 11) * normalizeCanvasZoom(zoomScale)));
}

export function getCanvasCameraOffset(viewWidth, viewHeight, cameraX, cameraY, tile) {
  return {
    offsetX: viewWidth / 2 - cameraX * tile,
    offsetY: viewHeight / 2 - cameraY * tile,
  };
}
