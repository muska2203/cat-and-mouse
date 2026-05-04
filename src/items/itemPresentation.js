/**
 * Единый источник текстов для расходников: тултипы и сообщения применения (вместе с game.js).
 */
import { localizeStatText } from "../strings/ru.js?v=0.4.3-pre-alpha";

const HOVER_BY_ID = {
  cheese_ration: "лечит 10 HP (не выше HP МАКС), дополнительно +4 маны.",
  common_crumb_ration: "лечит 10 HP (не выше HP МАКС).",
  common_mint_drop: "восстанавливает 10 маны (не выше максимума).",
  common_warm_milk: "лечит 6 HP и восстанавливает 6 маны.",
  common_sharp_pepper: "следующая атака персонажа получает множитель x1.5.",
  common_mousetrap:
    "установка в соседнюю свободную клетку. При срабатывании наносит 8 урона и оглушает на 1 ход.",
  common_glue_trap: "установка в соседнюю свободную клетку. При срабатывании оглушает на 2 хода.",
  rare_hearty_stew: "лечит 18 HP (не выше HP МАКС).",
  rare_focus_tonic: "восстанавливает 16 маны (не выше максимума).",
  rare_dual_elixir: "лечит 12 HP и восстанавливает 12 маны.",
  rare_battle_pepper: "следующая атака персонажа получает множитель x2.",
  rare_venom_trap:
    "установка в соседнюю свободную клетку. При срабатывании: 4 урона и ядовитый туман на клетке и вокруг (3x3).",
  unique_phoenix_broth: "лечит 28 HP (не выше HP МАКС).",
  unique_aether_draught: "восстанавливает 24 маны (не выше максимума).",
  unique_twilight_mix: "лечит 20 HP и восстанавливает 20 маны.",
  unique_storm_pepper: "следующая атака персонажа получает множитель x2.5.",
  hard_cheese: "+5 HP МАКС до конца забега (эффект стакается).",
  common_cracker: "+4 HP МАКС до конца забега (эффект стакается).",
  rare_royal_cheese: "лечит 20 HP, +1 HP МАКС до конца забега и +8 маны.",
  rare_spice_vial: "следующий удар персонажа получает множитель x2.",
  pepper_bomb: "наносит 8 урона ближайшему коту.",
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
