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
    const bagIndexRaw = Number(button.dataset.bagIndex);
    const bagIndex = Number.isInteger(bagIndexRaw) ? bagIndexRaw : -1;
    if (!itemId || !bagInstanceId || !state.playerSheet || !state.run) {
      return;
    }
    const nowMs = performance.now();
    const duplicateWindowMs = 220;
    if (
      state.uiHud.lastBagActionInstanceId === bagInstanceId &&
      nowMs - (state.uiHud.lastBagActionAtMs || 0) < duplicateWindowMs
    ) {
      return;
    }
    state.uiHud.lastBagActionInstanceId = bagInstanceId;
    state.uiHud.lastBagActionAtMs = nowMs;

    const item = getItemById(itemId);
    if (!item) {
      return;
    }

    if (item.isConsumable) {
      const useResult = useConsumable(state.run, state.playerSheet, item);
      state.run = useResult.run;
      state.playerSheet = useResult.playerSheet;
      const nextBag = [...(state.playerSheet.bag || [])];
      const removeByInstanceIndex = nextBag.findIndex((entry) => entry.instanceId === bagInstanceId);
      if (removeByInstanceIndex !== -1) {
        nextBag.splice(removeByInstanceIndex, 1);
      } else if (bagIndex >= 0 && bagIndex < nextBag.length) {
        nextBag.splice(bagIndex, 1);
      }
      state.playerSheet = recalculateSheetFromInventory(
        state.playerSheet,
        state.playerSheet.equippedByType,
        nextBag
      );
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
  if (!direction) {
    return;
  }

  event.preventDefault();
  performStep(direction);
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

root.addEventListener("click", onRootClick);
root.addEventListener("wheel", onRootWheel, { passive: false });
root.addEventListener("mouseover", onRootMouseOver);
root.addEventListener("mouseout", onRootMouseOut);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", onResize);
requestAnimationFrame(animationLoop);
rerender();
