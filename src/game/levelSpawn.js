import { randomFloat, randomPick } from "./rng.js?v=0.4.13-pre-alpha";

function createFilledMask(width, height, fill) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function buildDistanceMapFromCell(maze, start) {
  const distances = createFilledMask(maze.width, maze.height, -1);
  const queue = [{ x: start.x, y: start.y }];
  distances[start.y][start.x] = 0;
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  while (queue.length > 0) {
    const current = queue.shift();
    const base = distances[current.y][current.x];
    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) continue;
      if (maze.grid[ny][nx] === 1) continue;
      if (distances[ny][nx] !== -1) continue;
      distances[ny][nx] = base + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return distances;
}

function getWalkableCellsInRoom(maze, room) {
  const cells = [];
  const maxY = Math.min(maze.height - 1, room.y + room.h - 1);
  const maxX = Math.min(maze.width - 1, room.x + room.w - 1);
  for (let y = Math.max(0, room.y); y <= maxY; y += 1) {
    for (let x = Math.max(0, room.x); x <= maxX; x += 1) {
      if (maze.grid[y][x] === 0) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function isEdgeRoom(maze, room) {
  return (
    room.x <= 1 ||
    room.y <= 1 ||
    room.x + room.w >= maze.width - 1 ||
    room.y + room.h >= maze.height - 1
  );
}

export function planStartAndGoalSpawn(maze, rng = null) {
  const rooms = Array.isArray(maze.rooms) ? maze.rooms : [];
  const roomCandidates = rooms
    .map((room, index) => ({ room, index, cells: getWalkableCellsInRoom(maze, room) }))
    .filter((entry) => entry.cells.length > 0);

  if (roomCandidates.length === 0) {
    return {
      start: maze.start,
      goal: maze.goal,
      playerRoomIndex: -1,
      blockedSpawnKeys: new Set(),
    };
  }

  const edgeCandidates = roomCandidates.filter((entry) => isEdgeRoom(maze, entry.room));
  const startRoomEntry = randomPick(edgeCandidates.length > 0 ? edgeCandidates : roomCandidates, rng);
  const start = randomPick(startRoomEntry.cells, rng);
  const blockedSpawnKeys = new Set(startRoomEntry.cells.map((cell) => `${cell.x}:${cell.y}`));

  const distances = buildDistanceMapFromCell(maze, start);
  const targetRoomCandidates = roomCandidates.filter((entry) => entry.index !== startRoomEntry.index);
  let chosenGoalCell = null;
  let chosenDistance = -1;

  for (const entry of targetRoomCandidates) {
    const reachableCells = entry.cells
      .map((cell) => ({ ...cell, d: distances[cell.y][cell.x] }))
      .filter((cell) => cell.d >= 0);
    if (reachableCells.length === 0) {
      continue;
    }
    reachableCells.sort((a, b) => b.d - a.d);
    const bestDistance = reachableCells[0].d;
    if (bestDistance < chosenDistance) {
      continue;
    }
    const farthestGroup = reachableCells.filter((cell) => cell.d === bestDistance);
    const picked = randomPick(farthestGroup, rng);
    if (bestDistance > chosenDistance || randomFloat(rng) < 0.5) {
      chosenDistance = bestDistance;
      chosenGoalCell = { x: picked.x, y: picked.y };
    }
  }

  if (!chosenGoalCell) {
    const fallbackCells = [];
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const d = distances[y][x];
        if (d < 0 || (x === start.x && y === start.y)) continue;
        fallbackCells.push({ x, y, d });
      }
    }
    if (fallbackCells.length > 0) {
      fallbackCells.sort((a, b) => b.d - a.d);
      const maxD = fallbackCells[0].d;
      const farthest = fallbackCells.filter((cell) => cell.d === maxD);
      const picked = randomPick(farthest, rng);
      chosenGoalCell = { x: picked.x, y: picked.y };
    } else {
      chosenGoalCell = maze.goal;
    }
  }

  return {
    start,
    goal: chosenGoalCell,
    playerRoomIndex: startRoomEntry.index,
    blockedSpawnKeys,
  };
}
