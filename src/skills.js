import { getHealSkillRawValue, getRegenHealPerTurn, getRegenTotalHeal } from "./skills/coreSkillCalc.js?v=0.4.8-pre-alpha";

export const SKILL_DEFS = {
  skill_support_regen: {
    id: "skill_support_regen",
    name: "Перевязать раны",
    icon: "🩹",
    description: "Выбери клетку персонажа. Восстанавливает HP несколько ходов подряд.",
    manaCost: (playerSheet) => {
      const manaMax = Number(playerSheet?.manaMax ?? 0);
      if (!Number.isFinite(manaMax) || manaMax <= 0) return 0;
      return Math.floor(manaMax * 0.3);
    },
    maxLevel: 3,
    property: "Лечение за ход: % от МАКС HP. Длительность: 3 хода. Нельзя повторить, пока эффект активен.",
  },
  skill_support_heal: {
    id: "skill_support_heal",
    name: "Исцеление",
    icon: "💚",
    description: "Выбери клетку персонажа. Восстанавливает большое количество HP.",
    manaCost: 30,
    maxLevel: 3,
    property: "Мгновенное лечение: зависит от Интеллекта и уровня. Цель: своя клетка.",
  },
};

export function getCoreSkillDefs() {
  return Object.values(SKILL_DEFS);
}

export function getSkillById(skillId) {
  return SKILL_DEFS[skillId] || null;
}

export function getSkillManaCost(skillDef, playerSheet) {
  if (!skillDef) return 0;
  if (typeof skillDef.manaCost === "function") {
    return Math.max(0, Math.floor(skillDef.manaCost(playerSheet)));
  }
  return Math.max(0, Number(skillDef.manaCost || 0));
}

/** Текст для title / hover по скиллу (единое место с числами уровня). */
export function getSkillHoverText(skill, skillState, playerSheet) {
  const level = skillState?.level || 0;
  const manaCost = getSkillManaCost(skill, playerSheet);
  
  if (skill.id === "skill_support_regen") {
    const healPerTurn = getRegenHealPerTurn(level, playerSheet);
    const totalHeal = getRegenTotalHeal(level, playerSheet, 3);
    let percent = 8;
    if (level === 2) percent = 10;
    if (level >= 3) percent = 13;
    return `${skill.name}\nМана: ${manaCost} (30% от МАКС)\nЛечение: ${percent}% МАКС HP (${healPerTurn} HP) за ход, 3 хода подряд (всего до ${totalHeal} HP).\nЦель: своя клетка. Пока эффект активен — повторить нельзя.`;
  }
  if (skill.id === "skill_support_heal") {
    const heal = getHealSkillRawValue(level, playerSheet);
    return `${skill.name}\nМана: ${manaCost}\nМгновенное лечение: 20 + ИНТ×1.6 + уровень×10 = ${heal} HP (не выше HP макс).\nЦель: своя клетка.`;
  }
  return `${skill.name}\nМана: ${manaCost}\n${skill.description}`;
}
