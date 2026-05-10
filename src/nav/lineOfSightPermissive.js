/**
 * Пермиссивная видимость между двумя клетками сетки (стиль roguelike / RogueBasin «permissive FOV»).
 *
 * Идея: клетка B видна из A, если существует прямой отрезок от некоторой точки внутри квадрата A
 * до некоторой точки внутри квадрата B, который не пересекает внутренность ни одной стены;
 * концы A и B как клетки наблюдателя и цели не считаются препятствием (цель может быть стеной — «видеть стену»).
 *
 * Луч в непрерывных координатах (клетка [ix, ix+1)×[iy, iy+1)): обход по алгоритму Amanatides–Woo
 * (быстрый обход вокселей вдоль отрезка; см. Amanatides & Woo, «A Fast Voxel Traversal Algorithm…»).
 *
 * Строгий режим: один луч между центрами клеток — предсказуемый «центр→центр» для отладки и тестов.
 *
 * Свойство: для проходимых клеток hasLineOfSightOnGrid(A,B) === hasLineOfSightOnGrid(B,A).
 */

const EPS = 1e-10;
const INSET = 1e-4;
const INF = Number.POSITIVE_INFINITY;

/** Девять точек внутри клетки: углы и середины рёбер с отступом + центр (уменьшает «провалы» коридоров). */
function samplePointsInCell(ix, iy) {
  const x0 = ix + INSET;
  const x1 = ix + 1 - INSET;
  const y0 = iy + INSET;
  const y1 = iy + 1 - INSET;
  const xm = ix + 0.5;
  const ym = iy + 0.5;
  return [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
    [xm, y0],
    [xm, y1],
    [x0, ym],
    [x1, ym],
    [xm, ym],
  ];
}

function gridDims(grid) {
  const h = grid?.length ?? 0;
  const w = h > 0 ? grid[0]?.length ?? 0 : 0;
  return { w, h };
}

function inGrid(grid, gx, gy) {
  const { w, h } = gridDims(grid);
  return gy >= 0 && gy < h && gx >= 0 && gx < w;
}

/**
 * Ячейка блокирует луч, если это стена и это не клетка наблюдателя и не клетка цели.
 * Вне сетки считаем непроходимым.
 */
function cellBlocksLos(grid, gx, gy, ox, oy, tx, ty) {
  if (gx === ox && gy === oy) {
    return false;
  }
  if (gx === tx && gy === ty) {
    return false;
  }
  if (!inGrid(grid, gx, gy)) {
    return true;
  }
  return grid[gy][gx] === 1;
}

/**
 * Обходит клетки вдоль отрезка от (px0,py0) до (px1,py1). visitor возвращает false — прервать и вернуть false.
 * При равенстве tMaxX и tMaxY и обоих ненулевых шагах — диагональный шаг (ровные диагонали).
 */
function traverseCellsAlongRay(px0, py0, px1, py1, visitor) {
  let gx = Math.floor(px0);
  let gy = Math.floor(py0);
  const gxEnd = Math.floor(px1);
  const gyEnd = Math.floor(py1);

  const dx = px1 - px0;
  const dy = py1 - py0;

  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) {
    return visitor(gx, gy);
  }

  const stepX = dx > EPS ? 1 : dx < -EPS ? -1 : 0;
  const stepY = dy > EPS ? 1 : dy < -EPS ? -1 : 0;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const tDeltaX = absDx > EPS ? 1 / absDx : INF;
  const tDeltaY = absDy > EPS ? 1 / absDy : INF;

  let tMaxX;
  if (stepX > 0) {
    tMaxX = (gx + 1 - px0) / dx;
  } else if (stepX < 0) {
    tMaxX = (gx - px0) / dx;
  } else {
    tMaxX = INF;
  }

  let tMaxY;
  if (stepY > 0) {
    tMaxY = (gy + 1 - py0) / dy;
  } else if (stepY < 0) {
    tMaxY = (gy - py0) / dy;
  } else {
    tMaxY = INF;
  }

  let guard = 0;
  const guardMax = 65536;

  while (guard < guardMax) {
    guard += 1;
    if (visitor(gx, gy) === false) {
      return false;
    }
    if (gx === gxEnd && gy === gyEnd) {
      return true;
    }

    const tie = Math.abs(tMaxX - tMaxY) <= EPS;
    if (tie && stepX !== 0 && stepY !== 0) {
      gx += stepX;
      gy += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      gx += stepX;
      tMaxX += tDeltaX;
    } else {
      gy += stepY;
      tMaxY += tDeltaY;
    }
  }

  return false;
}

function rayAllowsSight(grid, ox, oy, tx, ty, sx, sy, ex, ey) {
  return traverseCellsAlongRay(sx, sy, ex, ey, (gx, gy) => !cellBlocksLos(grid, gx, gy, ox, oy, tx, ty));
}

/**
 * @param {number[][]} grid — 0 проход, 1 стена (как `run.grid`)
 */
export function hasStrictLineOfSightOnGrid(grid, fromX, fromY, toX, toY) {
  return hasLineOfSightWithEndpoints(grid, fromX, fromY, toX, toY, fromX + 0.5, fromY + 0.5, toX + 0.5, toY + 0.5);
}

function hasLineOfSightWithEndpoints(grid, ox, oy, tx, ty, sx, sy, ex, ey) {
  if (!grid || grid.length === 0) {
    return false;
  }
  const { w, h } = gridDims(grid);
  if (
    !Number.isFinite(ox) || !Number.isFinite(oy) || !Number.isFinite(tx) || !Number.isFinite(ty)
    || oy < 0 || oy >= h || ox < 0 || ox >= w
    || ty < 0 || ty >= h || tx < 0 || tx >= w
  ) {
    return false;
  }

  if (grid[oy][ox] === 1) {
    return false;
  }

  if (ox === tx && oy === ty) {
    return true;
  }

  return rayAllowsSight(grid, ox, oy, tx, ty, sx, sy, ex, ey);
}

/**
 * Пермиссивная видимость: подбираются точки выборки внутри клеток наблюдателя и цели.
 */
export function hasLineOfSightOnGrid(grid, fromX, fromY, toX, toY) {
  if (!grid || grid.length === 0) {
    return false;
  }
  const { w, h } = gridDims(grid);
  const ox = Number(fromX);
  const oy = Number(fromY);
  const tx = Number(toX);
  const ty = Number(toY);
  if (
    !Number.isFinite(ox) || !Number.isFinite(oy) || !Number.isFinite(tx) || !Number.isFinite(ty)
    || oy < 0 || oy >= h || ox < 0 || ox >= w
    || ty < 0 || ty >= h || tx < 0 || tx >= w
  ) {
    return false;
  }

  if (grid[oy][ox] === 1) {
    return false;
  }

  if (ox === tx && oy === ty) {
    return true;
  }

  if (hasStrictLineOfSightOnGrid(grid, ox, oy, tx, ty)) {
    return true;
  }

  const origins = samplePointsInCell(ox, oy);
  const targets = samplePointsInCell(tx, ty);

  for (let i = 0; i < origins.length; i += 1) {
    const [sx, sy] = origins[i];
    for (let j = 0; j < targets.length; j += 1) {
      const [ex, ey] = targets[j];
      if (rayAllowsSight(grid, ox, oy, tx, ty, sx, sy, ex, ey)) {
        return true;
      }
    }
  }

  return false;
}
