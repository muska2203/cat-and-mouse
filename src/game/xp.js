import { PROGRESSION_CONFIG } from "../state.js?v=0.4.12-pre-alpha";
import { getEnemyDefById } from "./enemyDefs.js?v=0.4.12-pre-alpha";

export function getXpForEnemy(enemyId) {
  const def = getEnemyDefById(enemyId);
  return Math.max(0, Number(def?.xp || 0));
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
    playerSheet.xpToNext = Math.max(1, Math.ceil((playerSheet.xpToNext || PROGRESSION_CONFIG.baseXpToNext) * PROGRESSION_CONFIG.xpGrowthFactor));
    levelUps += 1;
  }

  return { playerSheet, levelUps };
}
