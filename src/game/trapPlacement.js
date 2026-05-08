import { DIRS_8, inBounds, isWall } from "../nav/pathfinding.js?v=0.5.3-pre-alpha";
import { getObjectsAt } from "./cellObjects.js?v=0.5.3-pre-alpha";

export function getTrapPlacementCells(run) {
  if (!run?.player) {
    return [];
  }
  const cells = [];
  for (const dir of DIRS_8) {
    const x = run.player.x + dir.x;
    const y = run.player.y + dir.y;
    if (!inBounds(x, y, run) || isWall(x, y, run)) {
      continue;
    }
    if (getObjectsAt(run, x, y).length > 0) {
      continue;
    }
    cells.push({ x, y });
  }
  return cells;
}
