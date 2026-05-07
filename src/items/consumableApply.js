import { floorHp, floorHpMax } from "../rules.js?v=0.4.10-pre-alpha";
import { getConsumableApplyLog } from "./itemPresentation.js?v=0.4.10-pre-alpha";
import { syncPlayerHp } from "../game/syncHp.js?v=0.4.10-pre-alpha";

/**
 * @typedef {{ run: object, playerSheet: object, item: object }} ConsumableApplyContext
 * @typedef {{ log: string, restoredMana?: number }} ConsumableApplyResult
 */

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonCrumbRation(ctx) {
  const { playerSheet, item } = ctx;
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 12));
  syncPlayerHp(playerSheet, nextHp);
  return { log: getConsumableApplyLog(item, "heal_hp_12") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonMintDrop(ctx) {
  const { playerSheet, item } = ctx;
  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const nextMana = Math.min(currentManaMax, currentMana + 12);
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
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + 8));
  const nextMana = Math.min(currentManaMax, currentMana + 8);
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
function applyRareBattlePepper(ctx) {
  const { run, item } = ctx;
  run.nextHitMultiplier = 2;
  return { log: getConsumableApplyLog(item, "next_hit_2") };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyUniqueStormPepper(ctx) {
  const { run, item } = ctx;
  run.nextHitMultiplier = 2.5;
  return { log: getConsumableApplyLog(item, "next_hit_2_5") };
}

export const CONSUMABLE_APPLY_BY_ID = {
  common_hp_recover_10: applyCommonCrumbRation,
  common_mana_recover_10: applyCommonMintDrop,
  common_hp_mana_recover_6: applyCommonWarmMilk,
  common_next_hit_mult_1_5: applyCommonSharpPepper,
  rare_next_hit_mult_2: applyRareBattlePepper,
  unique_next_hit_mult_2_5: applyUniqueStormPepper,
};

export function getConsumableApplyConsistencyReport(allItems = []) {
  const runtimeConsumables = new Set(
    (allItems || [])
      .filter((item) => item?.isConsumable && !item?.isTrapItem)
      .map((item) => item.id),
  );
  const handlerIds = Object.keys(CONSUMABLE_APPLY_BY_ID);
  const missingHandlerIds = Array.from(runtimeConsumables).filter((id) => !CONSUMABLE_APPLY_BY_ID[id]);
  const orphanHandlerIds = handlerIds.filter((id) => !runtimeConsumables.has(id));
  return {
    ok: missingHandlerIds.length === 0 && orphanHandlerIds.length === 0,
    missingHandlerIds,
    orphanHandlerIds,
  };
}

/**
 * @param {object | null | undefined} item
 * @returns {((ctx: ConsumableApplyContext) => ConsumableApplyResult) | null}
 */
export function resolveConsumableApply(item) {
  if (!item?.id) {
    return null;
  }
  return CONSUMABLE_APPLY_BY_ID[item.id] || null;
}
