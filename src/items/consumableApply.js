import { floorHp, floorHpMax } from "../rules.js?v=0.5.5-pre-alpha";
import { getConsumableApplyLog, getConsumableRecoveryPreview } from "./itemPresentation.js?v=0.5.5-pre-alpha";
import { syncPlayerHp } from "../game/syncHp.js?v=0.5.5-pre-alpha";
import { enqueueFloatingText } from "../runtime/runFxState.js?v=0.5.5-pre-alpha";

const FLOATING_RECOVERY_DURATION_MS = 700;
const FLOATING_RECOVERY_SCALE = 1.1;
const FLOATING_RECOVERY_HP_COLOR = "#4ade80";
const FLOATING_RECOVERY_MP_COLOR = "#38bdf8";

/** Всплывающие «+N» над игроком — те же параметры движения/прозрачности, что у текста урона. */
function enqueuePlayerRecoveryFloating(run, delta, color) {
  const amount = Number(delta || 0);
  if (!run?.player || amount <= 0) return;
  enqueueFloatingText(run, {
    x: run.player.x,
    y: run.player.y,
    value: `+${Math.floor(amount)}`,
    color,
    durationMs: FLOATING_RECOVERY_DURATION_MS,
    scale: FLOATING_RECOVERY_SCALE,
    startMs: null,
  });
}

/**
 * @typedef {{ run: object, playerSheet: object, item: object }} ConsumableApplyContext
 * @typedef {{ log: string, restoredMana?: number }} ConsumableApplyResult
 */

function roundMana(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonCrumbRation(ctx) {
  const { run, playerSheet, item } = ctx;
  const preview = getConsumableRecoveryPreview(item, playerSheet);
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const restoredHp = Math.max(0, floorHp(preview?.hp?.restored ?? 0));
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + restoredHp));
  syncPlayerHp(playerSheet, nextHp);
  const restoredActualHp = floorHp(nextHp - currentHp);
  enqueuePlayerRecoveryFloating(run, restoredActualHp, FLOATING_RECOVERY_HP_COLOR);
  return { log: getConsumableApplyLog(item, "heal_hp_12", { restoredHp: restoredActualHp }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonMintDrop(ctx) {
  const { run, playerSheet, item } = ctx;
  const preview = getConsumableRecoveryPreview(item, playerSheet);
  const currentMana = roundMana(playerSheet.mana ?? 0);
  const currentManaMax = roundMana(playerSheet.manaMax ?? 0);
  const restored = roundMana(Math.max(0, preview?.mana?.restored ?? 0));
  const nextMana = roundMana(Math.min(currentManaMax, currentMana + restored));
  playerSheet.mana = nextMana;
  const restoredActual = roundMana(Math.max(0, nextMana - currentMana));
  enqueuePlayerRecoveryFloating(run, restoredActual, FLOATING_RECOVERY_MP_COLOR);
  return { log: getConsumableApplyLog(item, "heal_mana", { restored: restoredActual }) };
}

/** @param {ConsumableApplyContext} ctx @returns {ConsumableApplyResult} */
function applyCommonWarmMilk(ctx) {
  const { run, playerSheet, item } = ctx;
  const preview = getConsumableRecoveryPreview(item, playerSheet);
  const currentHp = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats.HP ?? 0);
  const currentHpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats.HP_MAX ?? 1);
  const currentMana = roundMana(playerSheet.mana ?? 0);
  const currentManaMax = roundMana(playerSheet.manaMax ?? 0);
  const plannedHp = Math.max(0, floorHp(preview?.hp?.restored ?? 0));
  const plannedMana = Math.max(0, roundMana(preview?.mana?.restored ?? 0));
  const nextHp = floorHp(Math.min(currentHpMax, currentHp + plannedHp));
  const nextMana = roundMana(Math.min(currentManaMax, currentMana + plannedMana));
  syncPlayerHp(playerSheet, nextHp);
  playerSheet.mana = nextMana;
  const restoredHp = floorHp(nextHp - currentHp);
  const restoredMp = roundMana(Math.max(0, nextMana - currentMana));
  enqueuePlayerRecoveryFloating(run, restoredHp, FLOATING_RECOVERY_HP_COLOR);
  enqueuePlayerRecoveryFloating(run, restoredMp, FLOATING_RECOVERY_MP_COLOR);
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
