export const CLASS_START_MANA = {
  mage: 100,
  warrior: 50,
};

export const SKILL_DEFS = {
  mage_arc_shot: {
    id: "mage_arc_shot",
    classId: "mage",
    name: "Арканный выстрел",
    icon: "🔷",
    description: "Выбери клетку с котом. Наносит магический урон выбранной цели.",
    manaCost: 18,
    maxLevel: 3,
    property: "Урон = ATK_MAGIC * (1.1 + 0.2 * уровень_скилла). Дальность: любая видимая клетка с врагом.",
  },
  mage_mirror_veil: {
    id: "mage_mirror_veil",
    classId: "mage",
    name: "Зеркальная вуаль",
    icon: "🪞",
    description: "Выбери клетку персонажа. Накладывает щит на несколько входящих ударов.",
    manaCost: 20,
    maxLevel: 3,
    property: "Заряды = 1 + уровень_скилла, снижение урона = 1 + уровень_скилла на каждый заряд.",
  },
  warrior_power_hit: {
    id: "warrior_power_hit",
    classId: "warrior",
    name: "Силовой удар",
    icon: "🪓",
    description: "Выбери соседнюю клетку с котом (радиус 1). Наносит мощный физический урон.",
    manaCost: 14,
    maxLevel: 3,
    property: "Урон = ATK_PHYS * (1.2 + 0.25 * уровень_скилла). Только по врагу на выбранной клетке.",
  },
  warrior_roll: {
    id: "warrior_roll",
    classId: "warrior",
    name: "Кувырок",
    icon: "🤸",
    description: "Выбери клетку через 1 по прямой (вверх/вниз/влево/вправо).",
    manaCost: 10,
    maxLevel: 3,
    property: "Нельзя через стену/на врага. При прыжке враг в промежуточной клетке получает урон: AGI * 0.6 + уровень_скилла.",
  },
  warrior_bandage: {
    id: "warrior_bandage",
    classId: "warrior",
    name: "Перевязать раны",
    icon: "🩹",
    description: "Выбери клетку персонажа. Восстанавливает HP несколько ходов подряд.",
    manaCost: 10,
    maxLevel: 3,
    property: "Лечение за тик = 5 + уровень_скилла. Длительность = 3 хода. Нельзя повторно, пока эффект активен.",
  },
  mage_heal: {
    id: "mage_heal",
    classId: "mage",
    name: "Исцеление",
    icon: "💚",
    description: "Выбери клетку персонажа. Восстанавливает большое количество HP.",
    manaCost: 30,
    maxLevel: 3,
    property: "Лечение = 40 + 10 * (уровень_скилла - 1). Цель: клетка персонажа.",
  },
};

export function getSkillsForClass(classId) {
  return Object.values(SKILL_DEFS).filter((skill) => skill.classId === classId);
}

export function getSkillById(skillId) {
  return SKILL_DEFS[skillId] || null;
}
