import { floorHp, floorHpMax } from "../rules.js?v=0.4.7-pre-alpha";
import { getConsumableApplyLog } from "./itemPresentation.js?v=0.4.7-pre-alpha";
import { removeObject } from "../game/cellObjects.js?v=0.4.7-pre-alpha";
import { getXpForEnemy, applyXpGain } from "../game/xp.js?v=0.4.7-pre-alpha";
import { findNearestEnemy } from "../game/enemies.js?v=0.4.7-pre-alpha";
import { syncPlayerHp } from "../game/syncHp.js?v=0.4.7-pre-alpha";

/**
 * @typedef {{ run: object, playerSheet: object, item: object }} ConsumableApplyContext
 * @typedef {{ log: string, restoredMana?: number }} ConsumableApplyResult
 */

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCheeseRation(ctx) {
  const { run, playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 10));
  syncPlayerHp(playerSheet, nextHp);
  return { log: getConsumableApplyLog(item, "heal_hp_10"), restoredMana: 4 };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonCrumbRation(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 10));
  syncPlayerHp(playerSheet, nextHp);
  return { log: getConsumableApplyLog(item, "heal_hp_10") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonMintDrop(ctx) {
  const { playerSheet, item } = ctx;
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const nextMana = Math.min(currentManaMax, currentMana + 10);
  playerSheet.mana = nextMana;
  const restored = Math.max(0, nextMana - currentMana);
  return { log: getConsumableApplyLog(item, "heal_mana", { restored }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonWarmMilk(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 6));
  const nextMana = Math.min(currentManaMax, currentMana + 6);
  syncPlayerHp(playerSheet, nextHp);
  playerSheet.mana = nextMana;
  const restoredHp = floorHp(nextHp - currentHp);
  const restoredMp = Math.max(0, nextMana - currentMana);
  return { log: getConsumableApplyLog(item, "heal_hybrid_small", { restoredHp, restoredMp }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonSharpPepper(ctx) {
  const { run, item } = ctx;
  run.nextHitMultiplier = 1.5;
  return { log: getConsumableApplyLog(item, "next_hit_1_5") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyRareHeartyStew(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 18));
  syncPlayerHp(playerSheet, nextHp);
  return { log: getConsumableApplyLog(item, "heal_hp_18") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyRareFocusTonic(ctx) {
  const { playerSheet, item } = ctx;
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const nextMana = Math.min(currentManaMax, currentMana + 16);
  playerSheet.mana = nextMana;
  const restored = Math.max(0, nextMana - currentMana);
  return { log: getConsumableApplyLog(item, "heal_mana", { restored }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyRareDualElixir(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 12));
  const nextMana = Math.min(currentManaMax, currentMana + 12);
  syncPlayerHp(playerSheet, nextHp);
  playerSheet.mana = nextMana;
  const restoredHp = floorHp(nextHp - currentHp);
  const restoredMp = Math.max(0, nextMana - currentMana);
  return { log: getConsumableApplyLog(item, "heal_hybrid_12", { restoredHp, restoredMp }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyRareBattlePepper(ctx) {
  const { run, item } = ctx;
  run.nextHitMultiplier = 2;
  return { log: getConsumableApplyLog(item, "next_hit_2") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyUniquePhoenixBroth(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 28));
  syncPlayerHp(playerSheet, nextHp);
  return { log: getConsumableApplyLog(item, "heal_hp_28") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyUniqueAetherDraught(ctx) {
  const { playerSheet, item } = ctx;
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const nextMana = Math.min(currentManaMax, currentMana + 24);
  playerSheet.mana = nextMana;
  const restored = Math.max(0, nextMana - currentMana);
  return { log: getConsumableApplyLog(item, "heal_mana", { restored }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyUniqueTwilightMix(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 20));
  const nextMana = Math.min(currentManaMax, currentMana + 20);
  syncPlayerHp(playerSheet, nextHp);
  playerSheet.mana = nextMana;
  const restoredHp = floorHp(nextHp - currentHp);
  const restoredMp = Math.max(0, nextMana - currentMana);
  return { log: getConsumableApplyLog(item, "heal_hybrid_20", { restoredHp, restoredMp }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyUniqueStormPepper(ctx) {
  const { run, item } = ctx;
  run.nextHitMultiplier = 2.5;
  return { log: getConsumableApplyLog(item, "next_hit_2_5") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyHardCheese(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  playerSheet.bonusHpMaxFromEffects = (playerSheet.bonusHpMaxFromEffects || 0) + 5;
  syncPlayerHp(playerSheet, currentHp);
  playerSheet.effectStacks = {
    ...(playerSheet.effectStacks || {}),
    hp_max_plus_5: (playerSheet.effectStacks?.hp_max_plus_5 || 0) + 1,
  };
  return { log: getConsumableApplyLog(item, "hp_max_5") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonCracker(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  playerSheet.bonusHpMaxFromEffects = (playerSheet.bonusHpMaxFromEffects || 0) + 4;
  syncPlayerHp(playerSheet, currentHp);
  playerSheet.effectStacks = {
    ...(playerSheet.effectStacks || {}),
    hp_max_plus_4: (playerSheet.effectStacks?.hp_max_plus_4 || 0) + 1,
  };
  return { log: getConsumableApplyLog(item, "hp_max_4") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyRareRoyalCheese(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const nextHpMaxApprox = currentHpMax + 1;
  const nextHp = floorHp(Math.min(nextHpMaxApprox, currentHp + 20));
  playerSheet.bonusHpMaxFromEffects = (playerSheet.bonusHpMaxFromEffects || 0) + 1;
  syncPlayerHp(playerSheet, nextHp);
  playerSheet.effectStacks = {
    ...(playerSheet.effectStacks || {}),
    hp_max_plus_1: (playerSheet.effectStacks?.hp_max_plus_1 || 0) + 1,
  };
  return { log: getConsumableApplyLog(item, "royal_cheese"), restoredMana: 8 };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyRareSpiceVial(ctx) {
  const { run, item } = ctx;
  run.nextHitMultiplier = 2;
  return { log: getConsumableApplyLog(item, "next_hit_spice") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyPepperBomb(ctx) {
  const { run, playerSheet, item } = ctx;
  const enemy = findNearestEnemy(run);
  if (!enemy) {
    return { log: getConsumableApplyLog(item, "pepper_no_enemy") };
  }
  enemy.data.hp = Math.max(0, enemy.data.hp - 8);
  let log = getConsumableApplyLog(item, "pepper_hit", { enemyName: enemy.name });
  if (enemy.data.hp <= 0) {
    const gainedXp = getXpForEnemy(enemy.id);
    const xpResult = applyXpGain(playerSheet, gainedXp);
    removeObject(run, enemy.id);
    const levelUpLog = xpResult.levelUps > 0
      ? ` Уровень повышен: ${playerSheet.level}. Очков прокачки: ${playerSheet.unspentPoints}.`
      : "";
    log += ` Кот повержен. +${gainedXp} XP.${levelUpLog}`;
  }
  return { log };
}

export const CONSUMABLE_APPLY_BY_ID = {
  common_hp_recover_10_mana_4: applyCheeseRation,
  common_hp_recover_10: applyCommonCrumbRation,
  common_mana_recover_10: applyCommonMintDrop,
  common_hp_mana_recover_6: applyCommonWarmMilk,
  common_next_hit_mult_1_5: applyCommonSharpPepper,
  rare_hp_recover_18: applyRareHeartyStew,
  rare_mana_recover_16: applyRareFocusTonic,
  rare_hp_mana_recover_12: applyRareDualElixir,
  rare_next_hit_mult_2: applyRareBattlePepper,
  unique_hp_recover_28: applyUniquePhoenixBroth,
  unique_mana_recover_24: applyUniqueAetherDraught,
  unique_hp_mana_recover_20: applyUniqueTwilightMix,
  unique_next_hit_mult_2_5: applyUniqueStormPepper,
  stack_hp_max_plus_5: applyHardCheese,
  stack_hp_max_plus_4: applyCommonCracker,
  stack_hp_max_plus_1_heal_20_mana_8: applyRareRoyalCheese,
  rare_next_hit_mult_2_alt: applyRareSpiceVial,
  enemy_damage_8_nearest: applyPepperBomb,
};

const LEGACY_CONSUMABLE_ID_ALIASES = {
  cheese_ration: "common_hp_recover_10_mana_4",
  common_crumb_ration: "common_hp_recover_10",
  common_mint_drop: "common_mana_recover_10",
  common_warm_milk: "common_hp_mana_recover_6",
  common_sharp_pepper: "common_next_hit_mult_1_5",
  rare_hearty_stew: "rare_hp_recover_18",
  rare_focus_tonic: "rare_mana_recover_16",
  rare_dual_elixir: "rare_hp_mana_recover_12",
  rare_battle_pepper: "rare_next_hit_mult_2",
  unique_phoenix_broth: "unique_hp_recover_28",
  unique_aether_draught: "unique_mana_recover_24",
  unique_twilight_mix: "unique_hp_mana_recover_20",
  unique_storm_pepper: "unique_next_hit_mult_2_5",
  hard_cheese: "stack_hp_max_plus_5",
  common_cracker: "stack_hp_max_plus_4",
  rare_royal_cheese: "stack_hp_max_plus_1_heal_20_mana_8",
  rare_spice_vial: "rare_next_hit_mult_2_alt",
  pepper_bomb: "common_trap_damage_8_stun_1",
};

/**
 * @param {object | null | undefined} item
 * @returns {((ctx: ConsumableApplyContext) => ConsumableApplyResult) | null}
 */
export function resolveConsumableApply(item) {
  if (!item?.id) {
    return null;
  }
  if (typeof item.applyWhenUsed === "function") {
    return item.applyWhenUsed;
  }
  const normalizedId = LEGACY_CONSUMABLE_ID_ALIASES[item.id] || item.id;
  return CONSUMABLE_APPLY_BY_ID[normalizedId] || null;
}

/**
 * Вешает на объекты из каталога ссылку на эффект применения (для отладки и явной связи данные↔логика).
 * @param {object[]} items
 */
export function attachConsumableApplyToItems(items) {
  for (const item of items) {
    if (item?.isConsumable && !item?.isTrapItem && CONSUMABLE_APPLY_BY_ID[item.id]) {
      item.applyWhenUsed = CONSUMABLE_APPLY_BY_ID[item.id];
    }
  }
}
