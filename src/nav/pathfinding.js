/**
 * Grid-only path helpers and A* variants. Blocking rules live in game.js
 * (callers pass isCellBlocked).
 */

export const DIRS_8 = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
];

export function inBounds(x, y, run) {
  return x >= 0 && y >= 0 && x < run.width && y < run.height;
}

export function isWall(x, y, run) {
  return run.grid[y][x] === 1;
}

export function isDiagonalCutBlocked(_run, _fromX, _fromY, _toX, _toY) {
  // По текущим правилам всем сущностям разрешён «срез угла» при диагональном ходе.
  return false;
}

export function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function buildPathToCell(run, start, target, isCellBlocked) {
  if (!run || !start || !target) {
    return [];
  }
  if (!inBounds(start.x, start.y, run) || !inBounds(target.x, target.y, run)) {
    return [];
  }
  const open = [{ x: start.x, y: start.y }];
  const cameFrom = new Map();
  const gScore = new Map([[`${start.x}:${start.y}`, 0]]);
  const fScore = new Map([[`${start.x}:${start.y}`, chebyshevDistance(start, target)]]);

  while (open.length > 0) {
    open.sort((a, b) => (fScore.get(`${a.x}:${a.y}`) ?? Infinity) - (fScore.get(`${b.x}:${b.y}`) ?? Infinity));
    const current = open.shift();
    const currentKey = `${current.x}:${current.y}`;
    if (current.x === target.x && current.y === target.y) {
      const path = [{ x: current.x, y: current.y }];
      let key = currentKey;
      while (cameFrom.has(key)) {
        const prev = cameFrom.get(key);
        path.push({ x: prev.x, y: prev.y });
        key = `${prev.x}:${prev.y}`;
      }
      path.reverse();
      return path;
    }

    for (const dir of DIRS_8) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!inBounds(nx, ny, run)) continue;
      if (nx === target.x && ny === target.y) {
        // allow target explicitly
      } else if (isCellBlocked(nx, ny)) {
        continue;
      }
      if (isDiagonalCutBlocked(run, current.x, current.y, nx, ny)) {
        continue;
      }

      const tentative = (gScore.get(currentKey) ?? Infinity) + (dir.x !== 0 && dir.y !== 0 ? 1.4142 : 1);
      const nKey = `${nx}:${ny}`;
      if (tentative >= (gScore.get(nKey) ?? Infinity)) {
        continue;
      }
      cameFrom.set(nKey, { x: current.x, y: current.y });
      gScore.set(nKey, tentative);
      fScore.set(nKey, tentative + chebyshevDistance({ x: nx, y: ny }, target));
      if (!open.some((n) => n.x === nx && n.y === ny)) {
        open.push({ x: nx, y: ny });
      }
    }
  }
  return [];
}

export function buildPathTowardTarget(run, start, target, isCellBlocked) {
  if (!run || !start || !target) {
    return [];
  }
  if (!inBounds(start.x, start.y, run) || !inBounds(target.x, target.y, run)) {
    return [];
  }
  const open = [{ x: start.x, y: start.y }];
  const cameFrom = new Map();
  const gScore = new Map([[`${start.x}:${start.y}`, 0]]);
  const fScore = new Map([[`${start.x}:${start.y}`, chebyshevDistance(start, target)]]);
  let bestNode = { x: start.x, y: start.y };
  let bestHeuristic = chebyshevDistance(start, target);
  let bestCost = 0;

  while (open.length > 0) {
    open.sort((a, b) => (fScore.get(`${a.x}:${a.y}`) ?? Infinity) - (fScore.get(`${b.x}:${b.y}`) ?? Infinity));
    const current = open.shift();
    const currentKey = `${current.x}:${current.y}`;
    const currentCost = gScore.get(currentKey) ?? Infinity;
    const currentHeuristic = chebyshevDistance(current, target);
    if (currentHeuristic < bestHeuristic || (currentHeuristic === bestHeuristic && currentCost < bestCost)) {
      bestNode = current;
      bestHeuristic = currentHeuristic;
      bestCost = currentCost;
    }
    if (current.x === target.x && current.y === target.y) {
      bestNode = current;
      break;
    }

    for (const dir of DIRS_8) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!inBounds(nx, ny, run)) continue;
      if (nx === target.x && ny === target.y) {
        // allow target explicitly
      } else if (isCellBlocked(nx, ny)) {
        continue;
      }
      if (isDiagonalCutBlocked(run, current.x, current.y, nx, ny)) {
        continue;
      }

      const tentative = currentCost + (dir.x !== 0 && dir.y !== 0 ? 1.4142 : 1);
      const nKey = `${nx}:${ny}`;
      if (tentative >= (gScore.get(nKey) ?? Infinity)) {
        continue;
      }
      cameFrom.set(nKey, { x: current.x, y: current.y });
      gScore.set(nKey, tentative);
      fScore.set(nKey, tentative + chebyshevDistance({ x: nx, y: ny }, target));
      if (!open.some((n) => n.x === nx && n.y === ny)) {
        open.push({ x: nx, y: ny });
      }
    }
  }

  const path = [{ x: bestNode.x, y: bestNode.y }];
  let key = `${bestNode.x}:${bestNode.y}`;
  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key);
    path.push({ x: prev.x, y: prev.y });
    key = `${prev.x}:${prev.y}`;
  }
  path.reverse();
  return path;
}

/**
 * Путь к ближайшей «ударной» клетке вокруг focus (игрок или последняя известная позиция).
 */
export function buildPathToNearestAttackCellAroundFocus(run, enemy, focus, isCellBlocked, options = {}) {
  if (!run || !enemy || !focus) {
    return [];
  }
  const canUseAttackCell = typeof options.canUseAttackCell === "function" ? options.canUseAttackCell : null;
  let attackCellsAll = DIRS_8
    .map((dir) => ({ x: focus.x + dir.x, y: focus.y + dir.y }))
    .filter((cell) => inBounds(cell.x, cell.y, run))
    .filter((cell) => !isWall(cell.x, cell.y, run))
    .filter((cell) => !(run.goal?.x === cell.x && run.goal?.y === cell.y));
  if (canUseAttackCell) {
    attackCellsAll = attackCellsAll.filter((cell) => canUseAttackCell(cell));
  }
  const attackCellsFree = attackCellsAll.filter((cell) => !isCellBlocked(cell.x, cell.y));
  const attackCells = attackCellsFree.length > 0 ? attackCellsFree : attackCellsAll;
  if (attackCells.length === 0) {
    return [];
  }

  const currentDistanceToFocus = chebyshevDistance(enemy, focus);
  const candidates = [];
  for (const attackCell of attackCells) {
    const path = buildPathTowardTarget(run, { x: enemy.x, y: enemy.y }, attackCell, isCellBlocked);
    if (path.length === 0) {
      continue;
    }
    const end = path[path.length - 1];
    const nextStep = path[1] || end;
    if (
      (nextStep.x !== enemy.x || nextStep.y !== enemy.y)
      && isCellBlocked(nextStep.x, nextStep.y)
    ) {
      continue;
    }
    const distanceToTarget = chebyshevDistance(end, attackCell);
    const nextDistanceToFocus = chebyshevDistance(nextStep, focus);
    candidates.push({
      path,
      distanceToTarget,
      nextDistanceToFocus,
      pathLength: path.length,
    });
  }
  if (candidates.length === 0) {
    return [];
  }

  const nonRetreatCandidates = candidates.filter(
    (candidate) => candidate.nextDistanceToFocus <= currentDistanceToFocus
  );
  const pool = nonRetreatCandidates.length > 0 ? nonRetreatCandidates : candidates;

  pool.sort((a, b) => {
    if (a.distanceToTarget !== b.distanceToTarget) {
      return a.distanceToTarget - b.distanceToTarget;
    }
    if (a.nextDistanceToFocus !== b.nextDistanceToFocus) {
      return a.nextDistanceToFocus - b.nextDistanceToFocus;
    }
    return a.pathLength - b.pathLength;
  });
  return pool[0]?.path || [];
}

export function buildPathToNearestEnemyAttackCell(run, enemy, isCellBlocked, options = {}) {
  if (!run?.player || !enemy) {
    return [];
  }
  return buildPathToNearestAttackCellAroundFocus(run, enemy, run.player, isCellBlocked, options);
}
