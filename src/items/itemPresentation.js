/**
 * Единый источник текстов для расходников: тултипы и сообщения применения (consumables.js + items/consumableApply.js).
 */
import { localizeStatText } from "../strings/ru.js?v=0.5.6-pre-alpha";
import { floorHp } from "../rules.js?v=0.5.6-pre-alpha";

const HOVER_BY_ID = {
  common_hp_recover_10: "лечит 50% HP МАКС.",
  common_mana_recover_10: "восстанавливает 50% маны МАКС.",
  common_hp_mana_recover_6: "лечит 30% HP МАКС и восстанавливает 30% маны МАКС.",
  common_next_hit_mult_1_5: "следующая атака персонажа получает множитель x1.5.",
  common_trap_damage_8_stun_1:
    "установка в соседнюю свободную клетку. При срабатывании наносит 4 урона и оглушает на 2 хода.",
  rare_next_hit_mult_2: "следующая атака персонажа получает множитель x2.",
  rare_trap_poison_cloud:
    "установка в соседнюю свободную клетку. При срабатывании: 4 урона, оглушение на 2 хода и ядовитый туман 3x3; урон от тумана только если на его клетке стоишь в конце хода окружения (без урона после выхода).",
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
    return `${name}: восстановлено ${ctx.restoredHp ?? 0} HP.`;
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

function roundMana(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function calculateRestoreValue(currentValue, maxValue, percent, roundValue) {
  const normalizedCurrent = Math.max(0, roundValue(currentValue));
  const normalizedMax = Math.max(1, roundValue(maxValue));
  const plannedRestore = Math.max(0, roundValue(normalizedMax * percent));
  const nextValue = Math.min(normalizedMax, normalizedCurrent + plannedRestore);
  const restored = Math.max(0, roundValue(nextValue - normalizedCurrent));
  return {
    current: normalizedCurrent,
    max: normalizedMax,
    plannedRestore,
    restored,
    cappedByMax: restored < plannedRestore,
  };
}

export function getConsumableRecoveryPreview(item, playerSheet) {
  if (!item?.isConsumable || item?.isTrapItem || !playerSheet) {
    return null;
  }
  const hpCurrent = playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0;
  const hpMax = playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1;
  const manaCurrent = playerSheet.mana ?? 0;
  const manaMax = playerSheet.manaMax ?? 0;

  if (item.id === "common_hp_recover_10") {
    return {
      hpPercent: 0.5,
      hp: calculateRestoreValue(hpCurrent, hpMax, 0.5, floorHp),
      manaPercent: 0,
      mana: null,
    };
  }
  if (item.id === "common_mana_recover_10") {
    return {
      hpPercent: 0,
      hp: null,
      manaPercent: 0.5,
      mana: calculateRestoreValue(manaCurrent, manaMax, 0.5, roundMana),
    };
  }
  if (item.id === "common_hp_mana_recover_6") {
    return {
      hpPercent: 0.3,
      hp: calculateRestoreValue(hpCurrent, hpMax, 0.3, floorHp),
      manaPercent: 0.3,
      mana: calculateRestoreValue(manaCurrent, manaMax, 0.3, roundMana),
    };
  }
  return null;
}
