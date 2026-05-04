import { PROGRESSION_CONFIG } from "../state.js?v=0.4.5-pre-alpha";

export function getXpForEnemy(enemyId) {
  if (enemyId?.startsWith("cat_big")) return 15;
  if (enemyId?.startsWith("cat_mid")) return 10;
  return 6;
}

export function applyXpGain(playerSheet, gainedXp) {
  if (!playerSheet || gainedXp <= 0) {
    return { playerSheet, levelUps: 0 };
  }

  playerSheet.xp = (playerSheet.xp || 0) + gainedXp;
  let levelUps = 0;
  while ((playerSheet.xp || 0) >= (playerSheet.xpToNext || 1)) {
    playerSheet.xp -= playerSheet.xpToNext;
    playerSheet.level = (playerSheet.level || 1) + 1;
    playerSheet.unspentPoints = (playerSheet.unspentPoints || 0) + PROGRESSION_CONFIG.pointsPerLevel;
    if (playerSheet.level % 2 === 0) {
      playerSheet.skillPoints = (playerSheet.skillPoints || 0) + 1;
    }
    playerSheet.xpToNext = Math.max(1, Math.ceil((playerSheet.xpToNext || PROGRESSION_CONFIG.baseXpToNext) * PROGRESSION_CONFIG.xpGrowthFactor));
    levelUps += 1;
  }

  return { playerSheet, levelUps };
}
