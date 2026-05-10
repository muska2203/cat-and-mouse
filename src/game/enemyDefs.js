const ENEMY_DEFS = {
  cat_small: {
    idPrefix: "cat_small",
    name: "Моховый фамильяр Проклятой норы",
    description:
      "Худой кот-служка подпольного культа: шепчет охотничьи молитвы против мышиных следов, рвет сумерки рясой и режет коротким клинком как память о первых победах над Норой.",
    icon: "🐱",
    hp: 18,
    damage: 2,
    xp: 6,
    visionRange: 5,
    searchWanderTurns: 3,
  },
  cat_mid: {
    idPrefix: "cat_mid",
    name: "Рыжий кот-топорщик Норы-кладбища",
    description:
      "Табби-берсерк, что рубит мышиные укрытия двуручным топором: шкура пахнет сырыми подвалами, на стали охотничьи руны мерцают зелёным.",
    icon: "🪓",
    hp: 27,
    damage: 5,
    xp: 10,
    visionRange: 6,
    searchWanderTurns: 3,
  },
  cat_big: {
    idPrefix: "cat_big",
    name: "Кот-рыцарь ордена Мёртвой Лапы",
    description:
      "Тяжёлый страж легендарной охоты на белые следы: уши на шлеме — знак рода, на синей накидке давно выветренный перечень пропавших нор; щит с царапинами напоминает последнее слово кота перед трапезой.",
    icon: "🛡",
    hp: 38,
    damage: 7,
    xp: 15,
    visionRange: 7,
    searchWanderTurns: 3,
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
