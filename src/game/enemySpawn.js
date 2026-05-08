import { randomFloat, randomInt } from "./rng.js?v=0.5.4-pre-alpha";

function weightedEnemyType(level, rng = null) {
  const t = Math.max(0, Math.min(1, (level - 1) / 9));
  const pSmall = 0.62 - t * 0.47;
  const pMid = 0.28 + t * 0.15;
  const roll = randomFloat(rng);
  if (roll < pSmall) return "cat_small";
  if (roll < pSmall + pMid) return "cat_mid";
  return "cat_big";
}

export function getEnemyCountsForLevel(level, walkableCells = 120, rng = null) {
  const mapScaleFactor = Math.max(1, walkableCells / 120);
  const total = randomInt(6, 10, rng) + Math.floor((mapScaleFactor - 1) * 5);
  const counts = { cat_small: 0, cat_mid: 0, cat_big: 0 };
  for (let i = 0; i < total; i += 1) {
    counts[weightedEnemyType(level, rng)] += 1;
  }
  return counts;
}
