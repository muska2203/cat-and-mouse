const ENEMY_DEFS = {
  cat_small: {
    idPrefix: "cat_small",
    name: "Котенок",
    icon: "🐱",
    hp: 18,
    damage: 2,
    xp: 6,
  },
  cat_mid: {
    idPrefix: "cat_mid",
    name: "Домашний кот",
    icon: "🐈",
    hp: 27,
    damage: 5,
    xp: 10,
  },
  cat_big: {
    idPrefix: "cat_big",
    name: "Дворовый кот",
    icon: "😾",
    hp: 38,
    damage: 7,
    xp: 15,
  },
};

export function getEnemyDefs() {
  return ENEMY_DEFS;
}

export function getEnemyDefByType(type) {
  return ENEMY_DEFS[type] || null;
}

export function getEnemyDefById(enemyId) {
  const id = String(enemyId || "");
  for (const def of Object.values(ENEMY_DEFS)) {
    if (id.startsWith(def.idPrefix)) {
      return def;
    }
  }
  return null;
}

export function getEnemyMaxHp(enemy) {
  if (!enemy || enemy.type !== "enemy") return 1;
  const explicitMaxHp = Number(enemy.data?.maxHp);
  if (Number.isFinite(explicitMaxHp) && explicitMaxHp > 0) {
    return Math.max(1, Math.floor(explicitMaxHp));
  }
  const def = getEnemyDefById(enemy.id);
  if (def) return Math.max(1, Math.floor(def.hp));
  return Math.max(1, Math.floor(Number(enemy.data?.hp || 1)));
}
