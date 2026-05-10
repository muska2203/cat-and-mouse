import { DIRS_8, inBounds, isWall } from "../nav/pathfinding.js?v=0.5.7-pre-alpha";
import { getItemById, addLootItemToPlayer } from "../loadout.js?v=0.5.7-pre-alpha";
import { rollChestLootItems } from "./chestLoot.js?v=0.5.7-pre-alpha";
import { randomInt } from "./rng.js?v=0.5.7-pre-alpha";
import { ensureRunFxState } from "../runtime/runFxState.js?v=0.5.7-pre-alpha";
import { bumpRunTotal } from "./runTotals.js?v=0.5.7-pre-alpha";
import {
  ACTOR_KIND,
  getObjectsAt,
  canObjectBeActivatedBy,
  removeObject,
} from "./cellObjects.js?v=0.5.7-pre-alpha";
import {
  applyTrapEffectToEnemy,
  applyTrapEffectToPlayer,
  spawnPoisonCloudObjects,
} from "./trapsAndClouds.js?v=0.5.7-pre-alpha";

function collectChestDropCells(run, x, y) {
  const cells = [];
  for (const dir of DIRS_8) {
    const nx = x + dir.x;
    const ny = y + dir.y;
    if (!inBounds(nx, ny, run) || isWall(nx, ny, run)) continue;
    const occupied = getObjectsAt(run, nx, ny);
    if (occupied.length > 0) continue;
    cells.push({ x: nx, y: ny });
  }
  return cells;
}

function spawnGroundLootObjects(run, lootItems, sourceX, sourceY, sourceName) {
  const fx = ensureRunFxState(run);
  const candidateCells = collectChestDropCells(run, sourceX, sourceY);
  let ord = 0;
  let spawnedCount = 0;
  const dropMotions = [];
  for (const item of lootItems) {
    if (!item?.id) continue;
    let targetCell = candidateCells.shift() || null;
    if (!targetCell) {
      const sourceOccupied = getObjectsAt(run, sourceX, sourceY);
      if (sourceOccupied.length === 0) {
        targetCell = { x: sourceX, y: sourceY };
      } else {
        continue;
      }
    }
    const lootObject = {
      id: `ground_loot_${Date.now()}_${targetCell.x}_${targetCell.y}_${ord}_${randomInt(0, 9999, run?.rng || null)}`,
      name: `Лут: ${item.name}`,
      type: "ground_loot",
      purpose: "ground_loot",
      icon: "📦",
      oneTime: true,
      blocksMovement: false,
      blocksEnemyMovement: false,
      activateOnPathPass: false,
      activation: { by: [ACTOR_KIND.PLAYER], effect: "pickup_loot" },
      x: targetCell.x,
      y: targetCell.y,
      data: {
        itemId: item.id,
        itemName: item.name,
        itemIcon: item.icon || "📦",
        itemType: item.type || "",
        itemSubtype: item.subtype || "",
        item,
        sourceName,
      },
    };
    run.objects.push(lootObject);
    spawnedCount += 1;
    if (targetCell.x !== sourceX || targetCell.y !== sourceY) {
      dropMotions.push({
        actorId: lootObject.id,
        kind: "move",
        from: { x: sourceX, y: sourceY },
        to: { x: targetCell.x, y: targetCell.y },
      });
    }
    ord += 1;
  }
  if (dropMotions.length > 0) {
    fx.environmentMotion = {
      kind: "object-move-batch",
      actors: dropMotions,
      durationMs: 220,
      startMs: null,
    };
  }
  return spawnedCount;
}

export function applyObjectActivationOnCell(run, playerSheet, actorKind, x, y, actorEntity = null, options = {}) {
  const fx = ensureRunFxState(run);
  const objects = getObjectsAt(run, x, y);
  const logs = [];
  let nextPlayerSheet = playerSheet;
  const isRouteStepFinal = options.isRouteStepFinal !== false;
  for (const object of objects) {
    if (!canObjectBeActivatedBy(object, actorKind)) {
      continue;
    }
    if (actorKind === ACTOR_KIND.PLAYER && !isRouteStepFinal && object?.activateOnPathPass !== true) {
      continue;
    }
    if (object.activation?.effect === "open_chest" && actorKind === ACTOR_KIND.PLAYER) {
      removeObject(run, object.id);
      const chestRarity = object?.data?.chestRarity || "common";
      const lootItems = rollChestLootItems(chestRarity, nextPlayerSheet?.stats?.LUK ?? 0, run?.rng || null);
      if (lootItems.length > 0) {
        const spawnedCount = spawnGroundLootObjects(run, lootItems, x, y, object.name);
        if (spawnedCount > 0) {
          logs.push(`${object.name}: лут высыпан рядом (${spawnedCount}).`);
        } else {
          logs.push(`${object.name}: рядом нет места для лута.`);
        }
      } else {
        logs.push(`${object.name} оказался пустым.`);
      }
    }
    if (object.activation?.effect === "open_anvil" && actorKind === ACTOR_KIND.PLAYER) {
      if (!Array.isArray(run.pendingUiActions)) {
        run.pendingUiActions = [];
      }
      run.pendingUiActions.push({
        type: "open_anvil",
        objectId: object.id,
      });
      logs.push("Наковальня готова к работе.");
    }
    if (object.activation?.effect === "pickup_loot" && actorKind === ACTOR_KIND.PLAYER) {
      const itemId = object?.data?.itemId || null;
      const item = itemId ? getItemById(itemId) : null;
      if (!item) {
        removeObject(run, object.id);
        logs.push("Предмет испорчен и исчез.");
      } else {
        const lootResult = addLootItemToPlayer(nextPlayerSheet, item.id);
        nextPlayerSheet = lootResult.playerSheet;
        bumpRunTotal(run, "itemsPickedUp", 1);
        removeObject(run, object.id);
        if (lootResult.addedTo === "equip") {
          logs.push(`Подобрано: ${item.name}. Автоэкипировка.`);
        } else if (lootResult.addedTo === "bag") {
          logs.push(`Подобрано: ${item.name}. В сумке.`);
        } else {
          logs.push(`Подобрано: ${item.name}.`);
        }
      }
    }
    if (object.activation?.effect === "trigger_trap") {
      const trapConfig = object?.data?.trapConfig || {};
      let effectLog = "";
      if (actorKind === ACTOR_KIND.ENEMY) {
        effectLog = applyTrapEffectToEnemy(run, actorEntity, trapConfig);
      } else if (actorKind === ACTOR_KIND.PLAYER) {
        effectLog = applyTrapEffectToPlayer(run, playerSheet, trapConfig);
      }
      if (trapConfig?.spawnPoisonCloud) {
        spawnPoisonCloudObjects(run, object.x, object.y, object.name, trapConfig);
      }
      removeObject(run, object.id);
      const triggerLog = effectLog ? `${object.name}: ${effectLog}.` : `${object.name}: сработала.`;
      logs.push(triggerLog);
    }
    if (object.activation?.effect === "trigger_poison_cloud") {
      const cloudConfig = object?.data?.trapConfig || {};
      let effectLog = "";
      if (actorKind === ACTOR_KIND.ENEMY) {
        effectLog = applyTrapEffectToEnemy(run, actorEntity, cloudConfig);
      } else if (actorKind === ACTOR_KIND.PLAYER) {
        effectLog = applyTrapEffectToPlayer(run, playerSheet, cloudConfig);
      }
      if (effectLog) {
        logs.push(`${object.name}: ${effectLog}.`);
      }
    }
  }
  if (actorKind === ACTOR_KIND.PLAYER && run.player.x === run.goal.x && run.player.y === run.goal.y) {
    if ((run.level || 1) >= (run.maxLevel || 10)) {
      run.status = "victory";
    } else {
      if (!Array.isArray(run.pendingUiActions)) {
        run.pendingUiActions = [];
      }
      const nextLevel = (run.level || 1) + 1;
      run.pendingUiActions.push({
        type: "open_descend_prompt",
        currentLevel: run.level || 1,
        nextLevel,
      });
      logs.push(`Нора найдена. Спуститься на уровень ${nextLevel} или остаться?`);
    }
  }
  return { log: logs.join(" "), playerSheet: nextPlayerSheet };
}

export function applyEndOfEnvironmentObjectEffects(run, playerSheet) {
  const objects = Array.isArray(run?.objects) ? [...run.objects] : [];
  let nextPlayerSheet = playerSheet;
  let effectCount = 0;

  for (const source of objects) {
    if (source?.turnTick?.effect !== "affect_cooccupants_with_trap") {
      continue;
    }
    const trapConfig = source?.data?.trapConfig || {};

    const objectsOnCell = getObjectsAt(run, source.x, source.y).filter((target) => target.id !== source.id);
    for (const target of objectsOnCell) {
      if (target.type !== "enemy") {
        continue;
      }
      const effectLog = applyTrapEffectToEnemy(run, target, trapConfig);
      if (effectLog) {
        effectCount += 1;
      }
      if ((target.data?.hp || 0) <= 0) {
        removeObject(run, target.id);
      }
    }

    if (run.player?.x === source.x && run.player?.y === source.y) {
      const effectLog = applyTrapEffectToPlayer(run, nextPlayerSheet, trapConfig);
      if (effectLog) {
        effectCount += 1;
      }
    }
  }

  return { playerSheet: nextPlayerSheet, effectCount };
}
