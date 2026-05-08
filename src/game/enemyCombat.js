import { removeObject } from "./cellObjects.js?v=0.5.1-pre-alpha";
import { applyXpGain, getXpForEnemy } from "./xp.js?v=0.5.1-pre-alpha";

export function applyDamageToEnemyAndResolveDefeat(run, playerSheet, enemy, damage) {
  if (!run || !playerSheet || !enemy || enemy.type !== "enemy") {
    return {
      enemyHp: 0,
      defeated: false,
      gainedXp: 0,
      levelUps: 0,
      levelUpLog: "",
      defeatLog: "",
    };
  }
  const safeDamage = Math.max(0, Number(damage || 0));
  const hpNow = Math.max(0, Number(enemy.data?.hp || 0));
  const enemyHp = Math.max(0, hpNow - safeDamage);
  enemy.data.hp = enemyHp;
  if (enemyHp > 0) {
    return {
      enemyHp,
      defeated: false,
      gainedXp: 0,
      levelUps: 0,
      levelUpLog: "",
      defeatLog: "",
    };
  }
  const gainedXp = getXpForEnemy(enemy.id);
  const xpResult = applyXpGain(playerSheet, gainedXp);
  removeObject(run, enemy.id);
  const levelUps = Math.max(0, Number(xpResult?.levelUps || 0));
  const levelUpLog = levelUps > 0
    ? ` Уровень повышен: ${playerSheet.level}. Очков прокачки: ${playerSheet.unspentPoints}.`
    : "";
  return {
    enemyHp,
    defeated: true,
    gainedXp,
    levelUps,
    levelUpLog,
    defeatLog: `Кот повержен. +${gainedXp} XP.${levelUpLog}`,
  };
}
