function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

/**
 * @param {number[][]} grid — 0 проход, 1 стена (как `run.grid`)
 */
export function hasLineOfSightOnGrid(grid, fromX, fromY, toX, toY) {
  const points = bresenhamLine(fromX, fromY, toX, toY);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    const isTarget = p.x === toX && p.y === toY;
    if (grid[p.y][p.x] === 1) {
      return isTarget;
    }
  }
  return true;
}
