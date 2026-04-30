function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createGrid(width, height, value) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => value));
}

function shuffledDirs() {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  for (let i = dirs.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    const tmp = dirs[i];
    dirs[i] = dirs[j];
    dirs[j] = tmp;
  }
  return dirs;
}

function pickRandomFrom(list) {
  return list[randomInt(0, list.length - 1)];
}

function carvePerfectMaze(grid, width, height) {
  const startX = randomInt(0, Math.floor((width - 3) / 2)) * 2 + 1;
  const startY = randomInt(0, Math.floor((height - 3) / 2)) * 2 + 1;
  const stack = [{ x: startX, y: startY }];
  grid[startY][startX] = 0;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = [];
    for (const dir of shuffledDirs()) {
      const nx = current.x + dir.x * 2;
      const ny = current.y + dir.y * 2;
      if (!inBounds(nx, ny, width - 1, height - 1)) continue;
      if (nx <= 0 || nx >= width - 1 || ny <= 0 || ny >= height - 1) continue;
      if (grid[ny][nx] === 1) {
        candidates.push({ nx, ny, wallX: current.x + dir.x, wallY: current.y + dir.y });
      }
    }

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = pickRandomFrom(candidates);
    grid[next.wallY][next.wallX] = 0;
    grid[next.ny][next.nx] = 0;
    stack.push({ x: next.nx, y: next.ny });
  }
}

function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function buildDistanceMap(grid, start) {
  const height = grid.length;
  const width = grid[0].length;
  const distances = createGrid(width, height, -1);
  const queue = [{ x: start.x, y: start.y }];
  distances[start.y][start.x] = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    const base = distances[current.y][current.x];
    for (const dir of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!inBounds(nx, ny, width, height)) continue;
      if (grid[ny][nx] === 1) continue;
      if (distances[ny][nx] !== -1) continue;
      distances[ny][nx] = base + 1;
      queue.push({ x: nx, y: ny });
    }
  }

  return distances;
}

function countWalkableNeighbors(grid, x, y) {
  let count = 0;
  const height = grid.length;
  const width = grid[0].length;
  for (const dir of [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]) {
    const nx = x + dir.x;
    const ny = y + dir.y;
    if (!inBounds(nx, ny, width, height)) continue;
    if (grid[ny][nx] === 0) count += 1;
  }
  return count;
}

function pickStartAndGoalLongPath(grid, width, height) {
  const walkable = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (grid[y][x] === 0) walkable.push({ x, y });
    }
  }

  const start = pickRandomFrom(walkable);
  const distances = buildDistanceMap(grid, start);
  const deadEndCandidates = [];
  const fallbackCandidates = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const d = distances[y][x];
      if (d < 0 || (x === start.x && y === start.y)) {
        continue;
      }
      const candidate = { x, y, d };
      fallbackCandidates.push(candidate);
      if (countWalkableNeighbors(grid, x, y) === 1) {
        deadEndCandidates.push(candidate);
      }
    }
  }

  const source = deadEndCandidates.length > 0 ? deadEndCandidates : fallbackCandidates;
  if (source.length === 0) {
    return null;
  }

  source.sort((a, b) => b.d - a.d);
  const farthestDistance = source[0].d;
  const farthestGroup = source.filter((c) => c.d === farthestDistance);
  const picked = pickRandomFrom(farthestGroup);
  return {
    start,
    goal: { x: picked.x, y: picked.y },
  };
}

function canReachGoal(grid, start, goal) {
  const height = grid.length;
  const width = grid[0].length;
  const queue = [{ x: start.x, y: start.y }];
  const seen = new Set([`${start.x}:${start.y}`]);
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) {
      return true;
    }

    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!inBounds(nx, ny, width, height)) {
        continue;
      }
      if (grid[ny][nx] === 1) {
        continue;
      }
      const key = `${nx}:${ny}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  return false;
}

export function generateMazeRun() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const width = randomInt(10, 15);
    const height = randomInt(10, 15);
    const grid = createGrid(width, height, 1);
    carvePerfectMaze(grid, width, height);
    const points = pickStartAndGoalLongPath(grid, width, height);
    if (!points) {
      continue;
    }
    const { start, goal } = points;

    if (canReachGoal(grid, start, goal)) return { width, height, grid, start, goal };
  }

  // Fallback на случай очень неудачной рандомизации.
  const width = 10;
  const height = 10;
  const grid = createGrid(width, height, 0);
  return {
    width,
    height,
    grid,
    start: { x: 1, y: 1 },
    goal: { x: width - 2, y: height - 2 },
  };
}
