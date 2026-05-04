import { createInitialState } from "./state.js?v=0.4.4-pre-alpha";
import { createPlayerSheet } from "./state.js?v=0.4.4-pre-alpha";
import { PROGRESSION_CONFIG } from "./state.js?v=0.4.4-pre-alpha";
import { applyLoadoutToSheet } from "./loadout.js?v=0.4.4-pre-alpha";
import { chooseStarterLoadoutItem } from "./loadout.js?v=0.4.4-pre-alpha";
import { initializeInventoryForRun } from "./loadout.js?v=0.4.4-pre-alpha";
import { swapItemFromBag } from "./loadout.js?v=0.4.4-pre-alpha";
import { recalculateSheetFromInventory } from "./loadout.js?v=0.4.4-pre-alpha";
import { spendLevelUpPoint } from "./loadout.js?v=0.4.4-pre-alpha";
import { getItemById } from "./loadout.js?v=0.4.4-pre-alpha";
import { createRunState } from "./game.js?v=0.4.4-pre-alpha";
import { createNextLevelRun } from "./game.js?v=0.4.4-pre-alpha";
import { tryStep } from "./game.js?v=0.4.4-pre-alpha";
import { useConsumable } from "./game/consumables.js?v=0.4.4-pre-alpha";
import { useSkillAtCell, getSkillTargetCells } from "./game/runSkills.js?v=0.4.4-pre-alpha";
import { getTrapPlacementCells } from "./game/trapPlacement.js?v=0.4.4-pre-alpha";
import { placeTrap } from "./game/consumables.js?v=0.4.4-pre-alpha";
import { beginEnvironmentTurn } from "./game.js?v=0.4.4-pre-alpha";
import { stepEnvironmentTurn } from "./game.js?v=0.4.4-pre-alpha";
import { buildPathToDiscoveredCell } from "./game.js?v=0.4.4-pre-alpha";
import { drawRunToCanvas } from "./render.js?v=0.4.4-pre-alpha";
import { renderApp, buildInventoryItemDetailHtml } from "./ui.js?v=0.4.4-pre-alpha";
import { getSkillById, getCoreSkillDefs } from "./skills.js?v=0.4.4-pre-alpha";
import { APP_VERSION } from "./app-config.js?v=0.4.4-pre-alpha";
import { GA4_MEASUREMENT_ID } from "./app-config.js?v=0.4.4-pre-alpha";
import { initAnalytics } from "./analytics.js?v=0.4.4-pre-alpha";
import { trackEvent } from "./analytics.js?v=0.4.4-pre-alpha";
import { createRunAnalyticsId } from "./analytics.js?v=0.4.4-pre-alpha";
import { floorHp } from "./rules.js?v=0.4.4-pre-alpha";
import { createInventoryItemPopoverController } from "./ui/inventoryPopover.js?v=0.4.4-pre-alpha";
import { resolveMoveDirectionFromEvent } from "./input/moveKeys.js?v=0.4.4-pre-alpha";
import { resolveQuickbarSlotIndexFromKeyboardEvent } from "./input/gameControls.js?v=0.4.4-pre-alpha";
import { startAnimationLoop } from "./runtime/gameLoop.js?v=0.4.4-pre-alpha";
import {
  isBlockingMotionActive,
  normalizeFinishedAnimationsForRun,
  isLevelTransitionActive as isRunLevelTransitionActive,
} from "./runtime/motionTiming.js?v=0.4.4-pre-alpha";
import { screenPointToGrid, isValidPathTargetCell } from "./runtime/canvasGrid.js?v=0.4.4-pre-alpha";
import { createCanvasRunHandlers } from "./runtime/canvasRunHandlers.js?v=0.4.4-pre-alpha";
import { formatHudStatNumber } from "./ui/hudFormat.js?v=0.4.4-pre-alpha";

const root = document.getElementById("app");
const state = createInitialState();

const inventoryPopover = createInventoryItemPopoverController({
  root,
  getScreen: () => state.screen,
  getItemById,
  buildInventoryItemDetailHtml,
});

function hideInventoryItemDetailPopover() {
  inventoryPopover.hide();
}

function scheduleHideInventoryItemDetailPopover() {
  inventoryPopover.scheduleHide();
}

function updateInventoryItemDetailPopover(event) {
  inventoryPopover.updateFromEvent(event);
}

initAnalytics({ measurementId: GA4_MEASUREMENT_ID, version: APP_VERSION });
let heldMoveDirection = null;

function rerender() {
  hideInventoryItemDetailPopover();
  syncSkillTargetPreview();
  maybeTrackRunEnd();
  renderApp(root, state);
  drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, performance.now());
  syncHpHud();
  syncManaHud();
}

function onRootClick(event) {
  if (state.uiHud.autoMoveActive) {
    clearPathingState();
    if (state.run?.status === "running") {
      state.run.lastLog = "Автодвижение отменено.";
    }
    rerender();
  }

  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (
    state.uiHud.skillsPanelOpen &&
    action !== "learn-skill" &&
    action !== "upgrade-skill" &&
    action !== "close-skills"
  ) {
    return;
  }
  if (action === "open-help") {
    state.uiHud.helpOpen = true;
    rerender();
  }
  if (action === "close-help") {
    state.uiHud.helpOpen = false;
    rerender();
  }
  if (action === "start-game") {
    if (state.preGamePointsRemaining !== 0) {
      return;
    }

    state.playerSheet = applyLoadoutToSheet(createPlayerSheet(state.preGameStats), state.starterLoadout);
    state.playerSheet = initializeInventoryForRun(state.playerSheet);
    const startHp = floorHp(state.playerSheet.stats.HP_MAX);
    state.playerSheet.baseStats.HP = startHp;
    state.playerSheet.stats.HP = startHp;
    state.uiHud.hpVisual = startHp;
    state.uiHud.manaVisual = state.playerSheet.mana || 0;
    state.run = createRunState(state.playerSheet, 1);
    state.run.analyticsRunId = createRunAnalyticsId();
    state.run.analyticsRunEndTracked = false;
    state.screen = "game";
    trackEvent("game_start", {
      class_id: null,
      run_id: state.run.analyticsRunId,
    });
    rerender();
  }

  if (action === "pregame-stat-plus") {
    const statKey = button.dataset.stat;
    const allowed = new Set(["STR", "INT", "AGI", "LUK"]);
    if (!allowed.has(statKey) || state.preGamePointsRemaining <= 0) {
      return;
    }
    state.preGameStats[statKey] = (state.preGameStats[statKey] || 0) + 1;
    state.preGamePointsRemaining -= 1;
    rerender();
    return;
  }

  if (action === "pregame-stat-minus") {
    const statKey = button.dataset.stat;
    const allowed = new Set(["STR", "INT", "AGI", "LUK"]);
    if (!allowed.has(statKey) || (state.preGameStats[statKey] || 0) <= 0) {
      return;
    }
    state.preGameStats[statKey] -= 1;
    state.preGamePointsRemaining += 1;
    rerender();
    return;
  }

  if (action === "toggle-starter-item") {
    const itemId = button.dataset.itemId;
    if (!itemId) {
      return;
    }
    state.starterLoadout = chooseStarterLoadoutItem(state.starterLoadout, itemId);
    rerender();
    return;
  }

  if (action === "bag-item-action") {
    const itemId = button.dataset.itemId;
    const bagInstanceId = button.dataset.bagInstanceId;
    const consumableItemId = button.dataset.consumableItemId;
    const bagIndexRaw = Number(button.dataset.bagIndex);
    const bagIndex = Number.isInteger(bagIndexRaw) ? bagIndexRaw : -1;
    if (!itemId || !state.playerSheet || !state.run || state.run.turnPhase !== "player") {
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
      consumePlayerActionAndStartEnvironment();
    }

    rerender();
  }

  if (action === "end-to-welcome") {
    const reset = createInitialState();
    state.screen = reset.screen;
    state.preGameStats = reset.preGameStats;
    state.preGamePointsRemaining = reset.preGamePointsRemaining;
    state.playerSheet = reset.playerSheet;
    state.starterLoadout = reset.starterLoadout;
    state.run = reset.run;
    state.uiHud = reset.uiHud;
    clearSkillTargeting();
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

  if (action === "close-skills") {
    state.uiHud.skillsPanelOpen = false;
    clearSkillTargeting();
    rerender();
    return;
  }

  if (action === "quickbar-use") {
    const slotIndex = Number(button.dataset.slotIndex);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) {
      return;
    }
    useQuickbarSlot(slotIndex);
  }

  if (action === "left-skill-use") {
    const skillId = button.dataset.skillId;
    if (!skillId || !state.playerSheet || !state.run || state.run.turnPhase !== "player") {
      return;
    }
    const skillDef = getSkillById(skillId);
    const skillState = state.playerSheet.skills?.[skillId];
    if (!skillDef || !skillState?.learned || skillState.level <= 0) {
      return;
    }
    const manaCost = Math.max(1, skillDef.manaCost);
    if ((state.playerSheet.mana || 0) < manaCost) {
      state.run.lastLog = "Недостаточно маны.";
      rerender();
      return;
    }
    const targets = getSkillTargetCells(state.run, state.playerSheet, skillId);
    if (targets.length === 0) {
      state.run.lastLog = "Нет доступных клеток для применения.";
      rerender();
      return;
    }
    clearPathingState();
    state.uiHud.skillTargeting = {
      slotIndex: null,
      skillId,
      previousSkillPoints: state.playerSheet.skillPoints || 0,
      targets,
    };
    rerender();
  }

  if (action === "learn-skill" || action === "upgrade-skill") {
    const skillId = button.dataset.skillId;
    if (!skillId || !state.playerSheet) {
      return;
    }
    const skillDef = getSkillById(skillId);
    const skillState = state.playerSheet.skills?.[skillId];
    if (!skillDef || !skillState || (state.playerSheet.skillPoints || 0) <= 0) {
      return;
    }
    if (skillState.level >= skillDef.maxLevel) {
      return;
    }
    const wasLearned = Boolean(skillState.learned);
    skillState.learned = true;
    skillState.level += 1;
    state.playerSheet.skillPoints -= 1;
    if (!wasLearned) {
      assignQuickbarSlotIfAvailable({ kind: "skill", skillId });
    }
    if ((state.playerSheet.skillPoints || 0) <= 0) {
      state.uiHud.skillsPanelOpen = false;
    }
    rerender();
  }

  if (action === "debug-level-up") {
    if (!state.playerSheet) {
      return;
    }
    state.playerSheet.level = (state.playerSheet.level || 1) + 1;
    state.playerSheet.unspentPoints = (state.playerSheet.unspentPoints || 0) + PROGRESSION_CONFIG.pointsPerLevel;
    if (state.playerSheet.level % 2 === 0) {
      state.playerSheet.skillPoints = (state.playerSheet.skillPoints || 0) + 1;
    }
    maybeOpenSkillsOnNewPoint(0);
    rerender();
  }
}

function onKeyDown(event) {
  if (state.uiHud.autoMoveActive) {
    clearPathingState();
    if (state.run?.status === "running") {
      state.run.lastLog = "Автодвижение отменено.";
    }
    rerender();
  }
  if (state.screen !== "game" || !state.run || state.run.turnPhase !== "player") {
    return;
  }
  if (state.uiHud.skillsPanelOpen) {
    return;
  }
  if (state.uiHud.trapTargeting?.itemId && (event.code === "Space" || event.key === " ")) {
    event.preventDefault();
    state.run.lastLog = "Выбери клетку мышью для установки ловушки.";
    rerender();
    return;
  }
  if (state.uiHud.skillTargeting?.skillId && (event.code === "Space" || event.key === " ")) {
    event.preventDefault();
    tryCastPreparedSkillOnSelf();
    return;
  }
  if (!state.uiHud.skillTargeting?.skillId && (event.code === "Space" || event.key === " ")) {
    event.preventDefault();
    state.run.lastLog = "Ход пропущен.";
    consumePlayerActionAndStartEnvironment();
    rerender();
    return;
  }

  const direction = resolveMoveDirectionFromEvent(event);
  if (direction) {
    event.preventDefault();
    heldMoveDirection = direction;
    if (state.uiHud.skillTargeting?.skillId) {
      tryCastPreparedSkillByDirection(direction);
      return;
    }
    if (event.repeat) {
      return;
    }
    clearSkillTargeting();
    performStep(direction);
    return;
  }

  const quickSlot = resolveQuickbarSlotIndexFromKeyboardEvent(event);
  if (quickSlot == null) {
    return;
  }

  event.preventDefault();
  useQuickbarSlot(quickSlot);
}

function onKeyUp(event) {
  const direction = resolveMoveDirectionFromEvent(event);
  if (!direction) {
    return;
  }
  if (heldMoveDirection === direction) {
    heldMoveDirection = null;
  }
}

function performStep(direction) {
  if (state.screen !== "game" || !state.run || state.run.turnPhase !== "player") {
    return false;
  }
  clearPathingState();

  const progressBefore = snapshotProgress();
  const stepResult = tryStep(state.run, state.playerSheet, direction);
  state.run = stepResult.run;
  state.playerSheet = stepResult.playerSheet;
  if (state.run && stepResult.motion) {
    state.run.motion = stepResult.motion;
  }

  if (state.run?.status === "victory" || state.run?.status === "defeat") {
    state.screen = "ending";
  }
  if (stepResult.actionConsumed) {
    consumePlayerActionAndStartEnvironment();
  }
  maybeOpenSkillsOnNewPoint(progressBefore.skillPoints);
  maybeTriggerLevelUpPulse(progressBefore);

  rerender();
  return Boolean(stepResult.actionConsumed);
}

function onResize() {
  hideInventoryItemDetailPopover();
  if (state.screen === "game") {
    drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, performance.now());
  }
}

function animationLoop(nowMs) {
  if (state.screen === "game" && state.run) {
    handleLevelTransition(nowMs);
    maybeStartDeferredEnvironmentTurn(nowMs);
    runEnvironmentPhase(nowMs);
    canvasHandlers.maybeRunAutoMoveStep();
    maybeRunHeldMoveStep(nowMs);
    drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, nowMs);
    animateHpHud();
    animateManaHud();
    maybeExpireLevelUpPulse(nowMs);
  }
}

function maybeRunHeldMoveStep(nowMs) {
  if (!heldMoveDirection) {
    return;
  }
  if (!state.run || !state.playerSheet || state.screen !== "game") {
    return;
  }
  if (state.run.status !== "running" || state.run.turnPhase !== "player") {
    return;
  }
  if (state.uiHud.skillsPanelOpen || state.uiHud.skillTargeting?.skillId || state.uiHud.trapTargeting?.itemId) {
    return;
  }
  if (isPlayerInputBlocked(nowMs)) {
    return;
  }
  clearSkillTargeting();
  performStep(heldMoveDirection);
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
  hpValue.textContent = `${formatHudStatNumber(state.uiHud.hpVisual)} / ${formatHudStatNumber(hpMax)}`;
}

function syncManaHud() {
  if (state.screen !== "game" || !state.playerSheet) {
    return;
  }
  const mana = state.playerSheet.mana || 0;
  if (state.uiHud.manaVisual == null) {
    state.uiHud.manaVisual = mana;
  }
  const manaFill = root.querySelector(".mana-fill");
  const manaValue = root.querySelector(".mana-value");
  if (!manaFill || !manaValue) {
    return;
  }
  const manaMax = Math.max(1, state.playerSheet.manaMax || 1);
  const percent = Math.max(0, Math.min(100, (state.uiHud.manaVisual / manaMax) * 100));
  manaFill.style.width = `${percent}%`;
  manaValue.textContent = `${formatHudStatNumber(state.uiHud.manaVisual)} / ${formatHudStatNumber(manaMax)}`;
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

function animateManaHud() {
  if (state.screen !== "game" || !state.playerSheet) {
    return;
  }
  const target = state.playerSheet.mana || 0;
  if (state.uiHud.manaVisual == null) {
    state.uiHud.manaVisual = target;
  }
  const diff = target - state.uiHud.manaVisual;
  if (Math.abs(diff) < 0.05) {
    state.uiHud.manaVisual = target;
  } else {
    state.uiHud.manaVisual += diff * 0.22;
  }
  syncManaHud();
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
  hideInventoryItemDetailPopover();
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
  if (consumable) {
    const itemId = consumable.dataset.dragItemId;
    if (!itemId) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "consumable", itemId };
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", `consumable:${itemId}`);
    return;
  }

  const equipItem = event.target.closest("[data-drag-kind='bag-equip']");
  if (equipItem) {
    const bagInstanceId = equipItem.dataset.dragBagInstanceId;
    const itemType = equipItem.dataset.dragItemType;
    if (!bagInstanceId || !itemType) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "bag-equip", bagInstanceId, itemType };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `bag-equip:${bagInstanceId}`);
    return;
  }

  const skill = event.target.closest("[data-drag-kind='skill']");
  if (!skill) {
    return;
  }
  const skillId = skill.dataset.dragSkillId;
  if (!skillId) {
    event.preventDefault();
    return;
  }
  state.uiHud.dragPayload = { kind: "skill", skillId };
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("text/plain", `skill:${skillId}`);
}

function onRootDragOver(event) {
  const quickbarSlot = event.target.closest("[data-slot-index]");
  const equipSlot = event.target.closest("[data-equip-type]");
  if (!state.uiHud.dragPayload || (!quickbarSlot && !equipSlot)) {
    return;
  }
  if (equipSlot) {
    const equipType = equipSlot.dataset.equipType;
    const payload = state.uiHud.dragPayload;
    if (payload.kind !== "bag-equip" || !equipType || payload.itemType !== equipType) {
      return;
    }
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function onRootDrop(event) {
  const equipSlot = event.target.closest("[data-equip-type]");
  if (equipSlot && state.uiHud.dragPayload?.kind === "bag-equip") {
    const equipType = equipSlot.dataset.equipType;
    const payload = state.uiHud.dragPayload;
    if (
      state.playerSheet &&
      state.run &&
      state.run.turnPhase === "player" &&
      equipType &&
      payload.itemType === equipType &&
      payload.bagInstanceId
    ) {
      event.preventDefault();
      const previousSheet = state.playerSheet;
      state.playerSheet = swapItemFromBag(state.playerSheet, payload.bagInstanceId, -1);
      if (state.playerSheet !== previousSheet) {
        consumePlayerActionAndStartEnvironment();
      }
      state.uiHud.dragPayload = null;
      rerender();
      return;
    }
  }

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
    slots[targetSlot] = { kind: "consumable", itemId: payload.itemId };
  }
  if (payload.kind === "skill" && payload.skillId) {
    slots[targetSlot] = { kind: "skill", skillId: payload.skillId };
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
  if (!state.playerSheet || !state.run || state.run.turnPhase !== "player") {
    return;
  }
  const slotValue = state.uiHud.quickbarSlots?.[slotIndex];
  if (!slotValue) {
    return;
  }
  const slotPayload = normalizeQuickbarSlot(slotValue);
  if (!slotPayload) {
    return;
  }
  let consumed = false;
  if (slotPayload.kind === "consumable") {
    clearSkillTargeting();
    consumed = useConsumableByItemId(slotPayload.itemId, null, -1);
  } else if (slotPayload.kind === "skill") {
    clearPathingState();
    const skillTargets = getSkillTargetCells(state.run, state.playerSheet, slotPayload.skillId);
    if (skillTargets.length === 0) {
      consumed = false;
    } else {
      const alreadyActive = state.uiHud.skillTargeting?.slotIndex === slotIndex;
      if (alreadyActive) {
        clearSkillTargeting();
      } else {
        state.uiHud.skillTargeting = {
          slotIndex,
          skillId: slotPayload.skillId,
          previousSkillPoints: state.playerSheet.skillPoints || 0,
          targets: skillTargets,
        };
      }
      rerender();
      return;
    }
  }
  if (!consumed) {
    rerender();
    return;
  }
  pulseQuickbarSlot(slotIndex);
  rerender();
}

function normalizeQuickbarSlot(value) {
  if (!value) return null;
  if (typeof value === "string") {
    return { kind: "consumable", itemId: value };
  }
  if (value.kind === "consumable" && value.itemId) {
    return value;
  }
  if (value.kind === "skill" && value.skillId) {
    return value;
  }
  return null;
}

function findNearestEmptyQuickbarSlotIndex() {
  const slots = state.uiHud.quickbarSlots || [];
  for (let index = 0; index < 9; index += 1) {
    if (!slots[index]) {
      return index;
    }
  }
  return -1;
}

function isQuickbarPayloadAssigned(targetPayload) {
  const slots = state.uiHud.quickbarSlots || [];
  for (const slotValue of slots) {
    const slotPayload = normalizeQuickbarSlot(slotValue);
    if (!slotPayload || slotPayload.kind !== targetPayload.kind) {
      continue;
    }
    if (slotPayload.kind === "consumable" && slotPayload.itemId === targetPayload.itemId) {
      return true;
    }
    if (slotPayload.kind === "skill" && slotPayload.skillId === targetPayload.skillId) {
      return true;
    }
  }
  return false;
}

function assignQuickbarSlotIfAvailable(payload) {
  if (!payload || isQuickbarPayloadAssigned(payload)) {
    return false;
  }
  const slotIndex = findNearestEmptyQuickbarSlotIndex();
  if (slotIndex < 0) {
    return false;
  }
  const slots = [...(state.uiHud.quickbarSlots || [])];
  slots[slotIndex] = payload;
  state.uiHud.quickbarSlots = slots;
  return true;
}

function useConsumableByItemId(itemId, bagInstanceId, bagIndex) {
  if (!itemId || !state.playerSheet || !state.run || state.run.turnPhase !== "player") {
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
  if (item.isTrapItem) {
    const targets = getTrapPlacementCells(state.run);
    if (targets.length === 0) {
      state.run.lastLog = "Нет свободных соседних клеток для установки ловушки.";
      return false;
    }
    clearSkillTargeting();
    state.uiHud.trapTargeting = {
      itemId: item.id,
      bagRemoveIndex: removeIndex,
      targets,
    };
    return false;
  }

  const progressBefore = snapshotProgress();
  const useResult = useConsumable(state.run, state.playerSheet, item);
  state.run = useResult.run;
  state.playerSheet = useResult.playerSheet;
  nextBag.splice(removeIndex, 1);
  state.playerSheet = recalculateSheetFromInventory(
    state.playerSheet,
    state.playerSheet.equippedByType,
    nextBag
  );
  consumePlayerActionAndStartEnvironment();
  maybeOpenSkillsOnNewPoint(progressBefore.skillPoints);
  maybeTriggerLevelUpPulse(progressBefore);
  return true;
}

function pulseQuickbarSlot(slotIndex) {
  state.uiHud.quickbarPulseSlot = slotIndex;
  setTimeout(() => {
    if (state.uiHud.quickbarPulseSlot !== slotIndex) {
      return;
    }
    state.uiHud.quickbarPulseSlot = null;
    if (!state.uiHud.skillsPanelOpen) {
      rerender();
    }
  }, 220);
}

function clearSkillTargeting() {
  state.uiHud.skillTargeting = null;
  state.uiHud.trapTargeting = null;
  if (state.run) {
    delete state.run.skillTargetCells;
    delete state.run.skillTargetingPreview;
  }
}

function clearPathingState() {
  state.uiHud.pathHoverCell = null;
  state.uiHud.pathPreviewCells = [];
  state.uiHud.pathLockedCells = [];
  state.uiHud.pathLockedTarget = null;
  state.uiHud.autoMoveActive = false;
  state.uiHud.autoMoveLastHp = null;
  if (state.run) {
    delete state.run.hoverCell;
    delete state.run.previewPathCells;
    delete state.run.lockedPathCells;
    delete state.run.lockedPathTarget;
  }
}

function syncSkillTargetPreview() {
  if (!state.run) {
    return;
  }
  const targets = state.uiHud.skillTargeting?.targets || state.uiHud.trapTargeting?.targets || [];
  state.run.skillTargetCells = targets;
  const skillId = state.uiHud.skillTargeting?.skillId;
  state.run.skillTargetingPreview = skillId ? buildPreparedSkillPreview(skillId) : null;
  state.run.hoverCell = state.uiHud.pathHoverCell || null;
  state.run.previewPathCells = state.uiHud.pathPreviewCells || [];
  state.run.lockedPathCells = state.uiHud.pathLockedCells || [];
  state.run.lockedPathTarget = state.uiHud.pathLockedTarget || null;
}

function maybeOpenSkillsOnNewPoint(previousPoints = 0) {
  const nowPoints = state.playerSheet?.skillPoints || 0;
  if (state.screen !== "game" || nowPoints <= previousPoints) {
    return;
  }
  if (!hasAvailableSkillUpgrade(state.playerSheet)) {
    state.uiHud.deferSkillsPanelOpen = false;
    return;
  }
  const nowMs = performance.now();
  const shouldDeferOpen = !state.run
    || state.run.turnPhase !== "player"
    || isPlayerInputBlocked(nowMs);
  if (shouldDeferOpen) {
    state.uiHud.deferSkillsPanelOpen = true;
    return;
  }
  state.uiHud.skillsPanelOpen = true;
  state.uiHud.deferSkillsPanelOpen = false;
  clearSkillTargeting();
}

function snapshotProgress() {
  return {
    level: state.playerSheet?.level || 1,
    unspentPoints: state.playerSheet?.unspentPoints || 0,
    skillPoints: state.playerSheet?.skillPoints || 0,
  };
}

function maybeTriggerLevelUpPulse(previousProgress) {
  const prev = previousProgress || { level: 1, unspentPoints: 0 };
  const currentLevel = state.playerSheet?.level || 1;
  const currentUnspent = state.playerSheet?.unspentPoints || 0;
  const leveledUp = currentLevel > (prev.level || 1) || currentUnspent > (prev.unspentPoints || 0);
  if (!leveledUp) {
    return;
  }
  state.uiHud.levelUpPulseUntil = performance.now() + 2200;
}

function maybeExpireLevelUpPulse(nowMs) {
  if (!state.uiHud.levelUpPulseUntil || nowMs < state.uiHud.levelUpPulseUntil) {
    return;
  }
  state.uiHud.levelUpPulseUntil = 0;
  if (!state.uiHud.skillsPanelOpen) {
    rerender();
  }
}

function maybeOpenDeferredSkillsPanel() {
  if (!state.uiHud.deferSkillsPanelOpen) {
    return false;
  }
  if (state.screen !== "game" || !state.run || state.run.turnPhase !== "player") {
    return false;
  }
  if ((state.playerSheet?.skillPoints || 0) <= 0) {
    state.uiHud.deferSkillsPanelOpen = false;
    return false;
  }
  if (!hasAvailableSkillUpgrade(state.playerSheet)) {
    state.uiHud.deferSkillsPanelOpen = false;
    return false;
  }
  const nowMs = performance.now();
  if (isPlayerInputBlocked(nowMs)) {
    return false;
  }
  state.uiHud.skillsPanelOpen = true;
  state.uiHud.deferSkillsPanelOpen = false;
  clearSkillTargeting();
  return true;
}

function hasAvailableSkillUpgrade(playerSheet) {
  if (!playerSheet || (playerSheet.skillPoints || 0) <= 0) {
    return false;
  }
  for (const skillDef of getCoreSkillDefs()) {
    const skillState = playerSheet.skills?.[skillDef.id];
    const currentLevel = skillState?.level || 0;
    if (currentLevel < skillDef.maxLevel) {
      return true;
    }
  }
  return false;
}

function buildPreparedSkillPreview(skillId) {
  const skillDef = getSkillById(skillId);
  const normalizedSkillId = skillDef?.id || skillId;
  const skillState = state.playerSheet?.skills?.[normalizedSkillId] || state.playerSheet?.skills?.[skillId];
  const level = skillState?.level || 0;
  if (!skillDef || level <= 0) {
    return null;
  }
  if (normalizedSkillId === "skill_support_heal") {
    const value = 40 + Math.max(0, (level - 1) * 10);
    return { kind: "heal", value };
  }
  if (normalizedSkillId === "skill_support_regen") {
    const value = 5 + level;
    return { kind: "heal", value };
  }
  return null;
}

function tryCastPreparedSkillByDirection(direction) {
  const targeting = state.uiHud.skillTargeting;
  if (!targeting?.skillId || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return;
  }
  const px = state.run.player.x;
  const py = state.run.player.y;
  const targets = targeting.targets || [];
  const directionalTargets = targets.filter((cell) => {
    if (direction === "up") return cell.x === px && cell.y < py;
    if (direction === "down") return cell.x === px && cell.y > py;
    if (direction === "left") return cell.y === py && cell.x < px;
    if (direction === "right") return cell.y === py && cell.x > px;
    return false;
  });

  if (directionalTargets.length !== 1) {
    state.run.lastLog = "В выбранном направлении должна быть ровно одна доступная клетка для подготовленного скилла.";
    rerender();
    return;
  }

  const cell = directionalTargets[0];
  const progressBefore = snapshotProgress();
  const result = useSkillAtCell(state.run, state.playerSheet, targeting.skillId, cell.x, cell.y);
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  if (!result.ok) {
    rerender();
    return;
  }
  if (Number.isInteger(targeting.slotIndex)) {
    pulseQuickbarSlot(targeting.slotIndex);
  }
  clearSkillTargeting();
  maybeOpenSkillsOnNewPoint(progressBefore.skillPoints);
  maybeTriggerLevelUpPulse(progressBefore);
  if (result.actionConsumed) {
    trackSkillUse(targeting.skillId);
    consumePlayerActionAndStartEnvironment();
  }
  rerender();
}

function tryCastPreparedSkillOnSelf() {
  const targeting = state.uiHud.skillTargeting;
  if (!targeting?.skillId || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return;
  }
  const px = state.run.player.x;
  const py = state.run.player.y;
  const selfCellAllowed = (targeting.targets || []).some((cell) => cell.x === px && cell.y === py);
  if (!selfCellAllowed) {
    state.run.lastLog = "Этот скилл нельзя применить на текущую клетку.";
    rerender();
    return;
  }
  const progressBefore = snapshotProgress();
  const result = useSkillAtCell(state.run, state.playerSheet, targeting.skillId, px, py);
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  if (!result.ok) {
    rerender();
    return;
  }
  if (Number.isInteger(targeting.slotIndex)) {
    pulseQuickbarSlot(targeting.slotIndex);
  }
  clearSkillTargeting();
  maybeOpenSkillsOnNewPoint(progressBefore.skillPoints);
  maybeTriggerLevelUpPulse(progressBefore);
  if (result.actionConsumed) {
    trackSkillUse(targeting.skillId);
    consumePlayerActionAndStartEnvironment();
  }
  rerender();
}

function maybeTrackRunEnd() {
  if (!state.run || !state.playerSheet) {
    return;
  }
  if (state.run.analyticsRunEndTracked) {
    return;
  }
  if (state.run.status !== "victory" && state.run.status !== "defeat") {
    return;
  }

  const commonPayload = {
    run_id: state.run.analyticsRunId || null,
    class_id: null,
    result: state.run.status,
  };
  trackEvent("run_end", commonPayload);

  if (state.run.status === "defeat") {
    trackEvent("defeat_reason", {
      ...commonPayload,
      level: state.run.level || 1,
      reason: inferDefeatReason(state.run),
    });
  }
  state.run.analyticsRunEndTracked = true;
}

function inferDefeatReason(run) {
  const log = String(run?.lastLog || "").toLowerCase();
  if (log.includes("атакует")) {
    return "enemy_attack";
  }
  return "hp_zero";
}

function trackSkillUse(skillId) {
  if (!state.run || !state.playerSheet || !skillId) {
    return;
  }
  trackEvent("skill_use", {
    run_id: state.run.analyticsRunId || null,
    class_id: null,
    skill_id: skillId,
  });
}

function consumePlayerActionAndStartEnvironment() {
  if (!state.run || state.run.status !== "running" || state.run.turnPhase !== "player") {
    return;
  }
  clearSkillTargeting();
  const nowMs = performance.now();
  normalizeFinishedAnimationsForRun(state.run, nowMs);
  if (isBlockingMotionActive(state.run.motion, nowMs) || isBlockingMotionActive(state.run.environmentMotion, nowMs)) {
    state.run.deferEnvironmentTurn = true;
    return;
  }
  state.run.deferEnvironmentTurn = false;
  beginEnvironmentTurn(state.run);
}

function maybeStartDeferredEnvironmentTurn(nowMs) {
  if (!state.run || state.run.status !== "running" || state.run.turnPhase !== "player" || !state.run.deferEnvironmentTurn) {
    return;
  }
  normalizeFinishedAnimationsForRun(state.run, nowMs);
  if (isBlockingMotionActive(state.run.motion, nowMs) || isBlockingMotionActive(state.run.environmentMotion, nowMs)) {
    return;
  }
  if (isRunLevelTransitionActive(state.run, nowMs)) {
    return;
  }
  state.run.deferEnvironmentTurn = false;
  beginEnvironmentTurn(state.run);
  rerender();
}

function isPlayerInputBlocked(nowMs) {
  if (!state.run) {
    return true;
  }
  normalizeFinishedAnimationsForRun(state.run, nowMs);
  return Boolean(
    isBlockingMotionActive(state.run.motion, nowMs) ||
    isBlockingMotionActive(state.run.environmentMotion, nowMs) ||
    isRunLevelTransitionActive(state.run, nowMs)
  );
}

function runEnvironmentPhase(nowMs) {
  if (!state.run || !state.playerSheet || state.run.turnPhase !== "environment" || state.run.status !== "running") {
    return;
  }
  const playerMotion = state.run.motion;
  if (playerMotion) {
    if (playerMotion.startMs == null) {
      playerMotion.startMs = nowMs;
      return;
    }
    if (nowMs - playerMotion.startMs < playerMotion.durationMs) {
      return;
    }
    state.run.motion = null;
  }
  const envMotion = state.run.environmentMotion;
  if (envMotion) {
    if (envMotion.startMs == null) {
      envMotion.startMs = nowMs;
      return;
    }
    const elapsed = nowMs - envMotion.startMs;
    if (elapsed < envMotion.durationMs) {
      return;
    }
    state.run.environmentMotion = null;
  }
  if ((state.run.environmentNextStepAtMs || 0) > nowMs) {
    return;
  }
  const result = stepEnvironmentTurn(state.run, state.playerSheet);
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  // Не добавляем искусственную паузу между фазами:
  // ожидание уже регулируется активными анимациями motion/environmentMotion.
  state.run.environmentNextStepAtMs = nowMs;
  if (state.run?.status === "defeat") {
    state.screen = "ending";
    rerender();
    return;
  }
  if (result.finished) {
    if (state.uiHud.autoMoveActive) {
      const hpNow = state.playerSheet?.stats?.HP ?? 0;
      const hpBefore = state.uiHud.autoMoveLastHp ?? hpNow;
      if (hpNow < hpBefore) {
        state.run.lastLog = "Автодвижение остановлено: персонаж получил урон.";
        clearPathingState();
      } else {
        state.uiHud.autoMoveLastHp = hpNow;
      }
    }
    maybeOpenDeferredSkillsPanel();
    rerender();
  }
}

const canvasHandlers = createCanvasRunHandlers({
  getState: () => state,
  rerender,
  clearPathingState,
  performStep,
  tryStep,
  buildPathToDiscoveredCell,
  isValidPathTargetCell,
  screenPointToGrid,
  isPlayerInputBlocked,
  getItemById,
  placeTrap,
  recalculateSheetFromInventory,
  consumePlayerActionAndStartEnvironment,
  clearSkillTargeting,
  useSkillAtCell,
  snapshotProgress,
  maybeOpenSkillsOnNewPoint,
  maybeTriggerLevelUpPulse,
  pulseQuickbarSlot,
  trackSkillUse,
  normalizeFinishedAnimationsForRun,
  isBlockingMotionActive,
});

root.addEventListener("click", onRootClick);
root.addEventListener("wheel", onRootWheel, { passive: false });
root.addEventListener("mouseover", onRootMouseOver);
root.addEventListener("mouseout", onRootMouseOut);
root.addEventListener("dragstart", onRootDragStart);
root.addEventListener("dragover", onRootDragOver);
root.addEventListener("drop", onRootDrop);
root.addEventListener("dragend", onRootDragEnd);
root.addEventListener("mouseup", (event) => {
  const canvas = event.target.closest("#gameCanvas");
  if (canvas) {
    if (state.uiHud.autoMoveActive) {
      clearPathingState();
      if (state.run?.status === "running") {
        state.run.lastLog = "Автодвижение отменено.";
      }
      rerender();
      if (!state.run || state.run.turnPhase !== "player") {
        return;
      }
    }
    canvasHandlers.onCanvasClick(event, canvas);
  }
});
root.addEventListener("mousemove", (event) => {
  updateInventoryItemDetailPopover(event);
  const canvas = event.target.closest("#gameCanvas");
  if (canvas) {
    canvasHandlers.onCanvasMouseMove(event, canvas);
  }
});
root.addEventListener("mouseout", (event) => {
  if (event.target.closest("#gameCanvas") && !event.relatedTarget?.closest?.("#gameCanvas")) {
    canvasHandlers.onCanvasMouseLeave();
  }
});
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("resize", onResize);
window.addEventListener("blur", hideInventoryItemDetailPopover);
startAnimationLoop(animationLoop);
rerender();
