/**
 * Единый источник текстов для расходников: тултипы и сообщения применения (consumables.js + items/consumableApply.js).
 */
import { localizeStatText } from "../strings/ru.js?v=0.4.7-pre-alpha";

const HOVER_BY_ID = {
  common_hp_recover_10_mana_4: "лечит 10 HP (не выше HP МАКС), дополнительно +4 маны.",
  common_hp_recover_10: "лечит 10 HP (не выше HP МАКС).",
  common_mana_recover_10: "восстанавливает 10 маны (не выше максимума).",
  common_hp_mana_recover_6: "лечит 6 HP и восстанавливает 6 маны.",
  common_next_hit_mult_1_5: "следующая атака персонажа получает множитель x1.5.",
  common_trap_damage_8_stun_1:
    "установка в соседнюю свободную клетку. При срабатывании наносит 8 урона и оглушает на 1 ход.",
  common_trap_stun_2: "установка в соседнюю свободную клетку. При срабатывании оглушает на 2 хода.",
  rare_hp_recover_18: "лечит 18 HP (не выше HP МАКС).",
  rare_mana_recover_16: "восстанавливает 16 маны (не выше максимума).",
  rare_hp_mana_recover_12: "лечит 12 HP и восстанавливает 12 маны.",
  rare_next_hit_mult_2: "следующая атака персонажа получает множитель x2.",
  rare_trap_poison_cloud:
    "установка в соседнюю свободную клетку. При срабатывании: 4 урона и ядовитый туман на клетке и вокруг (3x3).",
  unique_hp_recover_28: "лечит 28 HP (не выше HP МАКС).",
  unique_mana_recover_24: "восстанавливает 24 маны (не выше максимума).",
  unique_hp_mana_recover_20: "лечит 20 HP и восстанавливает 20 маны.",
  unique_next_hit_mult_2_5: "следующая атака персонажа получает множитель x2.5.",
  stack_hp_max_plus_5: "+5 HP МАКС до конца забега (эффект стакается).",
  stack_hp_max_plus_4: "+4 HP МАКС до конца забега (эффект стакается).",
  stack_hp_max_plus_1_heal_20_mana_8: "лечит 20 HP, +1 HP МАКС до конца забега и +8 маны.",
  rare_next_hit_mult_2_alt: "следующий удар персонажа получает множитель x2.",
  enemy_damage_8_nearest: "наносит 8 урона ближайшему коту.",
};

/**
 * Текст для title / hover (расходник). count — стак в сумке.
 */
export function getConsumableHoverText(item, count = 1) {
  if (!item) return "";
  const stacksText = count > 1 ? `\nСтак: ${count}` : "";
  const body = HOVER_BY_ID[item.id];
  if (body) {
    return `${item.name}: ${body}${stacksText}`;
  }
  return `${item.name}: ${localizeStatText(item.effectText)}.${stacksText}`;
}

/**
 * Лог применения расходника (без суффикса маны — его добавляет игра).
 */
export function getConsumableApplyLog(item, kind, ctx = {}) {
  const name = item?.name || "Предмет";
  if (kind === "trap_prompt") {
    return `${name}: выбери соседнюю свободную клетку для установки.`;
  }
  if (kind === "generic") {
    return `${name} применен.`;
  }
  if (kind === "heal_hp_10") {
    return `${name}: восстановлено 10 HP.`;
  }
  if (kind === "heal_mana") {
    return `${name}: восстановлено ${ctx.restored} маны.`;
  }
  if (kind === "heal_hybrid_small") {
    return `${name}: восстановлено ${ctx.restoredHp} HP и ${ctx.restoredMp} маны.`;
  }
  if (kind === "next_hit_1_5") {
    return `${name}: следующая атака получает множитель x1.5.`;
  }
  if (kind === "heal_hp_18") {
    return `${name}: восстановлено 18 HP.`;
  }
  if (kind === "heal_hybrid_12") {
    return `${name}: восстановлено ${ctx.restoredHp} HP и ${ctx.restoredMp} маны.`;
  }
  if (kind === "next_hit_2") {
    return `${name}: следующая атака получает множитель x2.`;
  }
  if (kind === "heal_hp_28") {
    return `${name}: восстановлено 28 HP.`;
  }
  if (kind === "heal_hybrid_20") {
    return `${name}: восстановлено ${ctx.restoredHp} HP и ${ctx.restoredMp} маны.`;
  }
  if (kind === "next_hit_2_5") {
    return `${name}: следующая атака получает множитель x2.5.`;
  }
  if (kind === "hp_max_5") {
    return `${name}: HP МАКС +5 до конца забега.`;
  }
  if (kind === "hp_max_4") {
    return `${name}: HP МАКС +4 до конца забега.`;
  }
  if (kind === "royal_cheese") {
    return `${name}: +1 HP МАКС и лечение 20 HP.`;
  }
  if (kind === "next_hit_spice") {
    return `${name}: следующий удар мышки x2.`;
  }
  if (kind === "pepper_no_enemy") {
    return `${name}: поблизости нет котов.`;
  }
  if (kind === "pepper_hit") {
    return `${name}: ${ctx.enemyName} получает 8 урона.`;
  }
  return `${name} применен.`;
}

export function appendManaToLog(log, deltaMana) {
  if (deltaMana > 0) {
    return `${log} Маны: +${deltaMana}.`;
  }
  return log;
}
