import { getConsumableApplyLog, appendManaToLog } from "../items/itemPresentation.js?v=0.4.4-pre-alpha";
import { resolveConsumableApply } from "../items/consumableApply.js?v=0.4.4-pre-alpha";
import { getTrapPlacementCells } from "./trapPlacement.js?v=0.4.4-pre-alpha";

export function useConsumable(run, playerSheet, item) {
  if (!run || !playerSheet || !item?.isConsumable) {
    return { run, playerSheet, log: "" };
  }
  if (item.isTrapItem) {
    return { run, playerSheet, log: getConsumableApplyLog(item, "trap_prompt"), actionConsumed: false };
  }

  const apply = resolveConsumableApply(item);
  if (!apply) {
    const log = getConsumableApplyLog(item, "generic");
    run.lastLog = log;
    return { run, playerSheet, log, actionConsumed: true };
  }

  const currentMana = playerSheet.mana ?? 0;
  const currentManaMax = playerSheet.manaMax ?? 0;
  const { log: rawLog, restoredMana = 0 } = apply({ run, playerSheet, item });
  let log = rawLog;
  if (restoredMana > 0) {
    const nextMana = Math.min(currentManaMax, currentMana + restoredMana);
    const deltaMana = nextMana - currentMana;
    playerSheet.mana = nextMana;
    log = appendManaToLog(log, deltaMana);
  }

  run.lastLog = log;
  return { run, playerSheet, log, actionConsumed: true };
}

export function placeTrap(run, playerSheet, item, targetX, targetY) {
  if (!run || !playerSheet || !item?.isTrapItem || !item?.trapConfig) {
    return { run, playerSheet, ok: false, log: "" };
  }
  const validCells = getTrapPlacementCells(run);
  const canPlace = validCells.some((cell) => cell.x === targetX && cell.y === targetY);
  if (!canPlace) {
    return {
      run,
      playerSheet,
      ok: false,
      log: "Ловушку можно поставить только в соседнюю свободную клетку.",
    };
  }
  const trapType = item.trapConfig?.trapType || "trap";
  run.objects.push({
    id: `trap_${trapType}_${Date.now()}_${targetX}_${targetY}_${Math.floor(Math.random() * 10000)}`,
    name: item.name,
    type: "trap",
    purpose: "trap",
    icon: item.icon || "🪤",
    oneTime: true,
    blocksMovement: false,
    blocksEnemyMovement: false,
    activation: { by: ["player", "enemy"], effect: "trigger_trap" },
    x: targetX,
    y: targetY,
    data: {
      trapType,
      trapConfig: { ...item.trapConfig },
    },
  });
  const log = `${item.name}: ловушка установлена.`;
  run.lastLog = log;
  return { run, playerSheet, ok: true, log };
}
