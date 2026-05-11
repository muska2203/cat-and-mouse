/**
 * Луч по клеткам сетки (целые координаты) для правил «кастер → точка применения» и каменных стен.
 */

import { getObjectsAt } from "./cellObjects.js?v=0.5.8-pre-alpha";
import { refreshPlayerVisibilityAndFogMemory } from "./playerVisibility.js?v=0.5.8-pre-alpha";
import { createWorldObject } from "./worldObjectModel.js?v=0.5.8-pre-alpha";
import { randomInt } from "./rng.js?v=0.5.8-pre-alpha";

export function getGridCellsOnSegmentInclusive(x0, y0, x1, y1) {
  let x = Number(x0);
  let y = Number(y0);
  const x2 = Number(x1);
  const y2 = Number(y1);
  const dx = Math.abs(x2 - x);
  const dy = -Math.abs(y2 - y);
  const sx = x < x2 ? 1 : -1;
  const sy = y < y2 ? 1 : -1;
  let err = dx + dy;
  const out = [];
  const guard = 4096;
  let steps = 0;
  while (steps < guard) {
    out.push({ x, y });
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    steps += 1;
  }
  return out;
}

/**
 * Уничтожает все объекты stone_wall на отрезке от кастера до точки (включительно).
 * @returns {number} суммарный бонус урона к заклинанию
 */
export function destroyStoneWallsAlongCasterSegment(run, fromX, fromY, toX, toY) {
  if (!run?.objects) return 0;
  const cells = getGridCellsOnSegmentInclusive(fromX, fromY, toX, toY);
  const cellKeys = new Set(cells.map((c) => `${c.x}:${c.y}`));
  let bonus = 0;
  const keep = [];
  for (const object of run.objects) {
    if (object.type !== "stone_wall" || !cellKeys.has(`${object.x}:${object.y}`)) {
      keep.push(object);
      continue;
    }
    bonus += Math.max(0, Number(object.data?.bonusSpellDamage || 0));
  }
  if (keep.length !== run.objects.length) {
    run.objects = keep;
    if (run?.player) {
      refreshPlayerVisibilityAndFogMemory(run, run.visionRange ?? 6);
    }
  }
  return bonus;
}

export function createStoneWallWorldObject(run, x, y, bonusSpellDamage, durationTurns = 3) {
  const id = `stone_wall_${Date.now()}_${x}_${y}_${randomInt(0, 99999, run?.rng || null)}`;
  return createWorldObject({
    id,
    name: "Каменная стена",
    description: "Временное препятствие. Исчезает через несколько ходов.",
    type: "stone_wall",
    purpose: "stone_wall",
    icon: "▨",
    oneTime: false,
    blocksMovement: true,
    blocksEnemyMovement: true,
    activateOnPathPass: false,
    x: Number(x),
    y: Number(y),
    fieldGlowColor: "#78716c",
    data: {
      durationTurns: Math.max(1, Number(durationTurns || 3)),
      bonusSpellDamage: Math.max(0, Number(bonusSpellDamage || 0)),
    },
  });
}
