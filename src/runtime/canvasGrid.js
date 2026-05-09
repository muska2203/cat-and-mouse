/**
 * Тот же расчёт тайла/камеры, что при отрисовке canvas (см. drawRunToCanvas):
 * локальные координаты клика → клетка сетки.
 */
import { getCanvasCameraOffset, getCanvasTileSize } from "./canvasCamera.js?v=0.5.5-pre-alpha";

export function screenPointToGrid(run, localX, localY, viewWidth, viewHeight, zoomScale = 1) {
  if (!run) {
    return null;
  }
  const tile = getCanvasTileSize(viewWidth, viewHeight, zoomScale);
  const cameraX = run.player.x + 0.5;
  const cameraY = run.player.y + 0.5;
  const { offsetX, offsetY } = getCanvasCameraOffset(viewWidth, viewHeight, cameraX, cameraY, tile);
  const gx = Math.floor((localX - offsetX) / tile);
  const gy = Math.floor((localY - offsetY) / tile);
  if (gx < 0 || gy < 0 || gx >= run.width || gy >= run.height) {
    return null;
  }
  return { x: gx, y: gy };
}

export function isValidPathTargetCell(run, cell) {
  if (!run || !cell) {
    return false;
  }
  if (cell.x < 0 || cell.y < 0 || cell.x >= run.width || cell.y >= run.height) {
    return false;
  }
  if (!run.discovered?.[cell.y]?.[cell.x]) {
    return false;
  }
  if (run.grid?.[cell.y]?.[cell.x] === 1) {
    return false;
  }
  return true;
}
