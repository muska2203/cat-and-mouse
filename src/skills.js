export const SKILL_DEFS = {
  skill_support_regen: {
    id: "skill_support_regen",
    name: "Перевязать раны",
    icon: "🩹",
    description: "Выбери клетку персонажа. Восстанавливает HP несколько ходов подряд.",
    manaCost: 10,
    maxLevel: 3,
    property: "Лечение за ход: 5 + уровень скилла. Длительность: 3 хода. Нельзя повторить, пока эффект активен.",
  },
  skill_support_heal: {
    id: "skill_support_heal",
    name: "Исцеление",
    icon: "💚",
    description: "Выбери клетку персонажа. Восстанавливает большое количество HP.",
    manaCost: 30,
    maxLevel: 3,
    property: "Мгновенное лечение: 40 + 10 × (уровень − 1). Цель: своя клетка.",
  },
};

const LEGACY_SKILL_ID_ALIASES = {
  warrior_bandage: "skill_support_regen",
  mage_heal: "skill_support_heal",
};

export function getCoreSkillDefs() {
  return Object.values(SKILL_DEFS);
}

export function getSkillById(skillId) {
  const normalizedId = LEGACY_SKILL_ID_ALIASES[skillId] || skillId;
  return SKILL_DEFS[normalizedId] || null;
}

/** Текст для title / hover по скиллу (единое место с числами уровня). */
export function getSkillHoverText(skill, skillState, _playerSheet) {
  const level = skillState?.level || 0;
  const manaCost = Math.max(1, skill.manaCost);
  if (skill.id === "skill_support_regen") {
    const healPerTurn = 5 + level;
    const totalHeal = healPerTurn * 3;
    return `${skill.name}\nМана: ${manaCost}\nЛечение: ${healPerTurn} HP за ход, 3 хода подряд (всего до ${totalHeal} HP).\nЦель: своя клетка. Пока эффект активен — повторить нельзя.`;
  }
  if (skill.id === "skill_support_heal") {
    const heal = 40 + Math.max(0, (level - 1) * 10);
    return `${skill.name}\nМана: ${manaCost}\nМгновенное лечение: 40 + 10×(уровень−1) = ${heal} HP (не выше HP макс).\nЦель: своя клетка.`;
  }
  return `${skill.name}\nМана: ${manaCost}\n${skill.description}`;
}
