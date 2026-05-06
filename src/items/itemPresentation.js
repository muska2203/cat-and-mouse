/**
 * Единый источник текстов для расходников: тултипы и сообщения применения (consumables.js + items/consumableApply.js).
 */
import { localizeStatText } from "../strings/ru.js?v=0.4.8-pre-alpha";

const HOVER_BY_ID = {
  common_hp_recover_10: "лечит 12 HP (не выше HP МАКС).",
  common_mana_recover_10: "восстанавливает 12 маны (не выше максимума).",
  common_hp_mana_recover_6: "лечит 8 HP и восстанавливает 8 маны.",
  common_next_hit_mult_1_5: "следующая атака персонажа получает множитель x1.5.",
  common_trap_damage_8_stun_1:
    "установка в соседнюю свободную клетку. При срабатывании наносит 8 урона и оглушает на 1 ход.",
  common_trap_stun_2: "установка в соседнюю свободную клетку. При срабатывании оглушает на 2 хода.",
  rare_next_hit_mult_2: "следующая атака персонажа получает множитель x2.",
  rare_trap_poison_cloud:
    "установка в соседнюю свободную клетку. При срабатывании: 4 урона и ядовитый туман на клетке и вокруг (3x3).",
  unique_next_hit_mult_2_5: "следующая атака персонажа получает множитель x2.5.",
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

export function getConsumableDescription(item) {
  if (!item) return "";
  const body = HOVER_BY_ID[item.id];
  if (body) {
    return body;
  }
  return localizeStatText(item.effectText);
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
  if (kind === "heal_hp_12") {
    return `${name}: восстановлено 12 HP.`;
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
  if (kind === "next_hit_2") {
    return `${name}: следующая атака получает множитель x2.`;
  }
  if (kind === "next_hit_2_5") {
    return `${name}: следующая атака получает множитель x2.5.`;
  }
  return `${name} применен.`;
}

export function appendManaToLog(log, deltaMana) {
  if (deltaMana > 0) {
    return `${log} Маны: +${deltaMana}.`;
  }
  return log;
}
