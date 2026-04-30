import { createInitialState } from "./state.js?v=0.1.2-pre-alpha";
import { createPlayerSheet } from "./state.js?v=0.1.2-pre-alpha";
import { applyLoadoutToSheet } from "./loadout.js?v=0.1.2-pre-alpha";
import { getDefaultStarterLoadout } from "./loadout.js?v=0.1.2-pre-alpha";
import { initializeInventoryForRun } from "./loadout.js?v=0.1.2-pre-alpha";
import { swapItemFromBag } from "./loadout.js?v=0.1.2-pre-alpha";
import { addLootItemToPlayer } from "./loadout.js?v=0.1.2-pre-alpha";
import { recalculateSheetFromInventory } from "./loadout.js?v=0.1.2-pre-alpha";
import { spendLevelUpPoint } from "./loadout.js?v=0.1.2-pre-alpha";
import { getItemById } from "./loadout.js?v=0.1.2-pre-alpha";
import { createRunState } from "./game.js?v=0.1.2-pre-alpha";
import { createNextLevelRun } from "./game.js?v=0.1.2-pre-alpha";
import { tryStep } from "./game.js?v=0.1.2-pre-alpha";
import { useConsumable } from "./game.js?v=0.1.2-pre-alpha";
import { drawRunToCanvas } from "./render.js?v=0.1.2-pre-alpha";
import { renderApp } from "./ui.js?v=0.1.2-pre-alpha";

const root = document.getElementById("app");
const state = createInitialState();

function rerender() {
  renderApp(root, state);
  drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, performance.now());
  syncHpHud();
}

function onRootClick(event) {
  const classCard = event.target.closest("[data-class-id]");
  if (classCard) {
    state.selectedClassId = classCard.dataset.classId;
    rerender();
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === "start-game") {
    if (!state.selectedClassId) {
      return;
    }

    state.starterLoadout = getDefaultStarterLoadout(state.selectedClassId);
    state.playerSheet = applyLoadoutToSheet(
      createPlayerSheet(state.selectedClassId),
      state.starterLoadout
    );
    state.playerSheet = initializeInventoryForRun(state.playerSheet);
    state.playerSheet.baseStats.HP = state.playerSheet.stats.HP_MAX;
    state.playerSheet.stats.HP = state.playerSheet.stats.HP_MAX;
    state.uiHud.hpVisual = state.playerSheet.stats.HP;
    state.run = createRunState(state.playerSheet, 1);
    state.screen = "game";
    rerender();
  }

  if (action === "bag-item-action") {
    const itemId = button.dataset.itemId;
    const bagInstanceId = button.dataset.bagInstanceId;
    const consumableItemId = button.dataset.consumableItemId;
    const bagIndexRaw = Number(button.dataset.bagIndex);
    const bagIndex = Number.isInteger(bagIndexRaw) ? bagIndexRaw : -1;
    if (!itemId || !state.playerSheet || !state.run) {
      return;
    }
    const bagActionKey = bagInstanceId || (consumableItemId ? `consumable:${consumableItemId}` : `item:${itemId}`);
    const nowMs = performance.now();
    const duplicateWindowMs = 220;
    if (
      state.uiHud.lastBagActionInstanceId === bagActionKey &&
      nowMs - (state.uiHud.lastBagActionAtMs || 0) < duplicateWindowMs
    ) {
      return;
    }
    state.uiHud.lastBagActionInstanceId = bagActionKey;
    state.uiHud.lastBagActionAtMs = nowMs;

    const item = getItemById(itemId);
    if (!item) {
      return;
    }

    if (item.isConsumable) {
      const targetConsumableId = consumableItemId || item.id;
      useConsumableByItemId(targetConsumableId, bagInstanceId, bagIndex);
    } else {
      state.playerSheet = swapItemFromBag(state.playerSheet, bagInstanceId, bagIndex);
    }

    rerender();
  }

  if (action === "end-to-welcome") {
    const reset = createInitialState();
    state.screen = reset.screen;
    state.selectedClassId = reset.selectedClassId;
    state.playerSheet = reset.playerSheet;
    state.starterLoadout = reset.starterLoadout;
    state.run = reset.run;
    rerender();
  }

  if (action === "upgrade-stat") {
    const statKey = button.dataset.stat;
    if (!state.playerSheet || !statKey) {
      return;
    }
    state.playerSheet = spendLevelUpPoint(state.playerSheet, statKey);
    rerender();
  }

  if (action === "mobile-move") {
    const direction = button.dataset.direction;
    if (!direction) {
      return;
    }
    performStep(direction);
  }

  if (action === "quickbar-use") {
    const slotIndex = Number(button.dataset.slotIndex);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) {
      return;
    }
    useQuickbarSlot(slotIndex);
  }
}

function onKeyDown(event) {
  if (state.screen !== "game" || !state.run) {
    return;
  }

  const map = {
    ArrowUp: "up",
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowRight: "right",
    KeyW: "up",
    KeyA: "left",
    KeyS: "down",
    KeyD: "right",
    w: "up",
    W: "up",
    a: "left",
    A: "left",
    s: "down",
    S: "down",
    d: "right",
    D: "right",
    ц: "up",
    Ц: "up",
    ф: "left",
    Ф: "left",
    ы: "down",
    Ы: "down",
    в: "right",
    В: "right",
  };
  const direction = map[event.code] || map[event.key];
  if (direction) {
    event.preventDefault();
    performStep(direction);
    return;
  }

  const quickSlotByCode = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
    Digit5: 4,
    Digit6: 5,
    Digit7: 6,
    Digit8: 7,
    Digit9: 8,
    Numpad1: 0,
    Numpad2: 1,
    Numpad3: 2,
    Numpad4: 3,
    Numpad5: 4,
    Numpad6: 5,
    Numpad7: 6,
    Numpad8: 7,
    Numpad9: 8,
  };
  const quickSlot = quickSlotByCode[event.code];
  if (quickSlot == null) {
    return;
  }

  event.preventDefault();
  useQuickbarSlot(quickSlot);
}

function performStep(direction) {
  if (state.screen !== "game" || !state.run) {
    return;
  }

  const stepResult = tryStep(state.run, state.playerSheet, direction);
  state.run = stepResult.run;
  state.playerSheet = stepResult.playerSheet;
  if (state.run && stepResult.motion) {
    state.run.motion = stepResult.motion;
  }

  if (state.run?.pendingLoot && state.playerSheet) {
    const lootResult = addLootItemToPlayer(state.playerSheet, state.run.pendingLoot.itemId);
    state.playerSheet = lootResult.playerSheet;
    if (lootResult.addedTo === "equip") {
      state.run.lastLog = `${state.run.lastLog} Автоэкипировка.`;
    }
    if (lootResult.addedTo === "bag") {
      state.run.lastLog = `${state.run.lastLog} Предмет отправлен в сумку.`;
    }
    delete state.run.pendingLoot;
  }

  if (state.run?.status === "victory" || state.run?.status === "defeat") {
    state.screen = "ending";
  }

  rerender();
}

function onResize() {
  if (state.screen === "game") {
    drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, performance.now());
  }
}

function animationLoop(nowMs) {
  if (state.screen === "game" && state.run) {
    handleLevelTransition(nowMs);
    drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, nowMs);
    animateHpHud();
  }
  requestAnimationFrame(animationLoop);
}

function handleLevelTransition(nowMs) {
  if (!state.run || state.run.status !== "level_complete" || !state.run.levelTransition) {
    return;
  }

  if (state.run.levelTransition.startedMs == null) {
    state.run.levelTransition.startedMs = nowMs;
    return;
  }

  const elapsed = nowMs - state.run.levelTransition.startedMs;
  if (elapsed < state.run.levelTransition.durationMs) {
    return;
  }

  const nextRun = createNextLevelRun(state.run, state.playerSheet);
  state.run = nextRun;
  rerender();
}

function syncHpHud() {
  if (state.screen !== "game" || !state.playerSheet) {
    return;
  }
  const hp = state.playerSheet.stats.HP;
  if (state.uiHud.hpVisual == null) {
    state.uiHud.hpVisual = hp;
  }
  const hpFill = root.querySelector(".hp-fill");
  const hpValue = root.querySelector(".hp-value");
  if (!hpFill || !hpValue) {
    return;
  }
  const hpMax = Math.max(1, state.playerSheet.stats.HP_MAX);
  const percent = Math.max(0, Math.min(100, (state.uiHud.hpVisual / hpMax) * 100));
  hpFill.style.width = `${percent}%`;
  hpValue.textContent = `${Math.round(state.uiHud.hpVisual)} / ${hpMax}`;
}

function animateHpHud() {
  if (state.screen !== "game" || !state.playerSheet) {
    return;
  }
  const target = state.playerSheet.stats.HP;
  if (state.uiHud.hpVisual == null) {
    state.uiHud.hpVisual = target;
  }
  const diff = target - state.uiHud.hpVisual;
  if (Math.abs(diff) < 0.05) {
    state.uiHud.hpVisual = target;
  } else {
    state.uiHud.hpVisual += diff * 0.22;
  }
  syncHpHud();
}

function onRootWheel(event) {
  const classList = event.target.closest(".class-list");
  if (!classList) {
    return;
  }

  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    classList.scrollLeft += event.deltaY;
    event.preventDefault();
  }
}

function onRootMouseOver(event) {
  const upgradeButton = event.target.closest("[data-action='upgrade-stat']");
  if (upgradeButton) {
    const stat = upgradeButton.dataset.stat || null;
    const changed = state.uiHud.upgradePreviewStat !== stat || state.uiHud.equipPreviewBagInstanceId !== null;
    state.uiHud.upgradePreviewStat = stat;
    state.uiHud.equipPreviewBagInstanceId = null;
    if (changed) {
      rerender();
    }
    return;
  }

  const bagButton = event.target.closest("[data-action='bag-item-action']");
  if (!bagButton) {
    return;
  }
  const itemId = bagButton.dataset.itemId;
  const bagInstanceId = bagButton.dataset.bagInstanceId || null;
  const item = itemId ? getItemById(itemId) : null;
  if (!item || item.isConsumable || !bagInstanceId) {
    return;
  }
  const changed = state.uiHud.equipPreviewBagInstanceId !== bagInstanceId || state.uiHud.upgradePreviewStat !== null;
  state.uiHud.equipPreviewBagInstanceId = bagInstanceId;
  state.uiHud.upgradePreviewStat = null;
  if (changed) {
    rerender();
  }
}

function onRootMouseOut(event) {
  const fromPreviewButton = event.target.closest("[data-action='upgrade-stat'], [data-action='bag-item-action']");
  if (!fromPreviewButton) {
    return;
  }
  const toPreviewButton = event.relatedTarget?.closest?.("[data-action='upgrade-stat'], [data-action='bag-item-action']");
  if (toPreviewButton) {
    return;
  }
  if (state.uiHud.upgradePreviewStat || state.uiHud.equipPreviewBagInstanceId) {
    state.uiHud.upgradePreviewStat = null;
    state.uiHud.equipPreviewBagInstanceId = null;
    rerender();
  }
}

function onRootDragStart(event) {
  const quickbarSlot = event.target.closest("[data-drag-kind='quick-slot']");
  if (quickbarSlot) {
    const slotIndex = Number(quickbarSlot.dataset.dragSlotIndex);
    const itemId = state.uiHud.quickbarSlots?.[slotIndex] || null;
    if (!itemId) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "quick-slot", slotIndex };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `quick-slot:${slotIndex}`);
    return;
  }

  const consumable = event.target.closest("[data-drag-kind='consumable']");
  if (!consumable) {
    return;
  }
  const itemId = consumable.dataset.dragItemId;
  if (!itemId) {
    event.preventDefault();
    return;
  }
  state.uiHud.dragPayload = { kind: "consumable", itemId };
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("text/plain", `consumable:${itemId}`);
}

function onRootDragOver(event) {
  const quickbarSlot = event.target.closest("[data-slot-index]");
  if (!quickbarSlot) {
    return;
  }
  if (!state.uiHud.dragPayload) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function onRootDrop(event) {
  const quickbarSlot = event.target.closest("[data-slot-index]");
  if (!quickbarSlot || !state.uiHud.dragPayload) {
    return;
  }
  const targetSlot = Number(quickbarSlot.dataset.slotIndex);
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot > 8) {
    state.uiHud.dragPayload = null;
    return;
  }
  event.preventDefault();
  const slots = [...(state.uiHud.quickbarSlots || [])];
  const payload = state.uiHud.dragPayload;
  if (payload.kind === "consumable" && payload.itemId) {
    slots[targetSlot] = payload.itemId;
  }
  if (payload.kind === "quick-slot" && Number.isInteger(payload.slotIndex)) {
    const sourceSlot = payload.slotIndex;
    if (sourceSlot !== targetSlot) {
      const tmp = slots[targetSlot] || null;
      slots[targetSlot] = slots[sourceSlot] || null;
      slots[sourceSlot] = tmp;
    }
  }
  state.uiHud.quickbarSlots = slots;
  state.uiHud.dragPayload = null;
  rerender();
}

function onRootDragEnd(event) {
  const payload = state.uiHud.dragPayload;
  if (
    payload?.kind === "quick-slot" &&
    Number.isInteger(payload.slotIndex) &&
    event.dataTransfer?.dropEffect === "none"
  ) {
    const slots = [...(state.uiHud.quickbarSlots || [])];
    slots[payload.slotIndex] = null;
    state.uiHud.quickbarSlots = slots;
    state.uiHud.dragPayload = null;
    rerender();
    return;
  }
  state.uiHud.dragPayload = null;
}

function useQuickbarSlot(slotIndex) {
  if (!state.playerSheet || !state.run) {
    return;
  }
  const itemId = state.uiHud.quickbarSlots?.[slotIndex];
  if (!itemId) {
    return;
  }
  const consumed = useConsumableByItemId(itemId, null, -1);
  if (!consumed) {
    return;
  }
  pulseQuickbarSlot(slotIndex);
  rerender();
}

function useConsumableByItemId(itemId, bagInstanceId, bagIndex) {
  if (!itemId || !state.playerSheet || !state.run) {
    return false;
  }
  const item = getItemById(itemId);
  if (!item || !item.isConsumable) {
    return false;
  }
  const nextBag = [...(state.playerSheet.bag || [])];
  let removeIndex = -1;
  if (itemId) {
    removeIndex = nextBag.findIndex((entry) => {
      const bagItemId = typeof entry === "string" ? entry : entry?.itemId;
      return bagItemId === itemId;
    });
  }
  if (removeIndex === -1 && bagInstanceId) {
    removeIndex = nextBag.findIndex((entry) => entry.instanceId === bagInstanceId);
  }
  if (removeIndex === -1 && bagIndex >= 0 && bagIndex < nextBag.length) {
    removeIndex = bagIndex;
  }
  if (removeIndex === -1) {
    return false;
  }

  const useResult = useConsumable(state.run, state.playerSheet, item);
  state.run = useResult.run;
  state.playerSheet = useResult.playerSheet;
  nextBag.splice(removeIndex, 1);
  state.playerSheet = recalculateSheetFromInventory(
    state.playerSheet,
    state.playerSheet.equippedByType,
    nextBag
  );
  return true;
}

function pulseQuickbarSlot(slotIndex) {
  state.uiHud.quickbarPulseSlot = slotIndex;
  setTimeout(() => {
    if (state.uiHud.quickbarPulseSlot !== slotIndex) {
      return;
    }
    state.uiHud.quickbarPulseSlot = null;
    rerender();
  }, 220);
}

root.addEventListener("click", onRootClick);
root.addEventListener("wheel", onRootWheel, { passive: false });
root.addEventListener("mouseover", onRootMouseOver);
root.addEventListener("mouseout", onRootMouseOut);
root.addEventListener("dragstart", onRootDragStart);
root.addEventListener("dragover", onRootDragOver);
root.addEventListener("drop", onRootDrop);
root.addEventListener("dragend", onRootDragEnd);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", onResize);
requestAnimationFrame(animationLoop);
rerender();
