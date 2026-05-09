import { inBounds } from "../nav/pathfinding.js?v=0.5.6-pre-alpha";
import { hasLineOfSightOnGrid } from "../nav/lineOfSight.js?v=0.5.6-pre-alpha";
import { checkAggroAfterPlayerAction } from "./enemyAggro.js?v=0.5.6-pre-alpha";
import { refreshPlayerVisibilityAndFogMemory } from "./playerVisibility.js?v=0.5.6-pre-alpha";

export function revealAroundPlayer(run, visionRange) {
  const px = run.player.x;
  const py = run.player.y;
  run.discovered[py][px] = true;

  for (let y = py - visionRange; y <= py + visionRange; y += 1) {
    for (let x = px - visionRange; x <= px + visionRange; x += 1) {
      if (!inBounds(x, y, run)) continue;
      const distance = Math.hypot(x - px, y - py);
      if (distance > visionRange) continue;
      if (hasLineOfSightOnGrid(run.grid, px, py, x, y)) {
        run.discovered[y][x] = true;
      }
    }
  }
  refreshPlayerVisibilityAndFogMemory(run, visionRange);
  checkAggroAfterPlayerAction(run);
}
