import { createInitialState } from "./state.js?v=0.3.1-pre-alpha";
import { createPlayerSheet } from "./state.js?v=0.3.1-pre-alpha";
import { PROGRESSION_CONFIG } from "./state.js?v=0.3.1-pre-alpha";
import { applyLoadoutToSheet } from "./loadout.js?v=0.3.1-pre-alpha";
import { getDefaultStarterLoadout } from "./loadout.js?v=0.3.1-pre-alpha";
import { initializeInventoryForRun } from "./loadout.js?v=0.3.1-pre-alpha";
import { swapItemFromBag } from "./loadout.js?v=0.3.1-pre-alpha";
import { addLootItemToPlayer } from "./loadout.js?v=0.3.1-pre-alpha";
import { recalculateSheetFromInventory } from "./loadout.js?v=0.3.1-pre-alpha";
import { spendLevelUpPoint } from "./loadout.js?v=0.3.1-pre-alpha";
import { getItemById } from "./loadout.js?v=0.3.1-pre-alpha";
import { createRunState } from "./game.js?v=0.3.1-pre-alpha";
import { createNextLevelRun } from "./game.js?v=0.3.1-pre-alpha";
import { tryStep } from "./game.js?v=0.3.1-pre-alpha";
import { useConsumable } from "./game.js?v=0.3.1-pre-alpha";
import { useSkillAtCell } from "./game.js?v=0.3.1-pre-alpha";
import { getSkillTargetCells } from "./game.js?v=0.3.1-pre-alpha";
import { beginEnvironmentTurn } from "./game.js?v=0.3.1-pre-alpha";
import { stepEnvironmentTurn } from "./game.js?v=0.3.1-pre-alpha";
import { drawRunToCanvas } from "./render.js?v=0.3.1-pre-alpha";
import { renderApp } from "./ui.js?v=0.3.1-pre-alpha";
import { getSkillById } from "./skills.js?v=0.3.1-pre-alpha";

const root = document.getElementById("app");
const state = createInitialState();

function rerender() {
  syncSkillTargetPreview();
  renderApp(root, state);
  drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, performance.now());
  syncHpHud();
  syncManaHud();
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
  if (state.uiHud.skillsPanelOpen && action !== "learn-skill" && action !== "upgrade-skill") {
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
    state.uiHud.manaVisual = state.playerSheet.mana || 0;
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
    state.selectedClassId = reset.selectedClassId;
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
    const manaCost = Math.max(1, skillDef.manaCost - (skillId === "warrior_roll" ? (skillState.level - 1) : 0));
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
    if (skillDef.classId !== state.playerSheet.classId || skillState.level >= skillDef.maxLevel) {
      return;
    }
    skillState.learned = true;
    skillState.level += 1;
    state.playerSheet.skillPoints -= 1;
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
  if (state.screen !== "game" || !state.run || state.run.turnPhase !== "player") {
    return;
  }
  if (state.uiHud.skillsPanelOpen) {
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
    if (state.uiHud.skillTargeting?.skillId) {
      tryCastPreparedSkillByDirection(direction);
      return;
    }
    clearSkillTargeting();
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
  if (state.screen !== "game" || !state.run || state.run.turnPhase !== "player") {
    return;
  }

  const previousSkillPoints = state.playerSheet?.skillPoints || 0;
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
  if (stepResult.actionConsumed) {
    consumePlayerActionAndStartEnvironment();
  }
  maybeOpenSkillsOnNewPoint(previousSkillPoints);

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
    runEnvironmentPhase(nowMs);
    drawRunToCanvas(document.getElementById("gameCanvas"), state.run, state.playerSheet, nowMs);
    animateHpHud();
    animateManaHud();
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
  manaValue.textContent = `${Math.round(state.uiHud.manaVisual)} / ${manaMax}`;
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

function onCanvasClick(event, canvas) {
  if (state.screen !== "game" || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return;
  }
  const targeting = state.uiHud.skillTargeting;
  if (!targeting?.skillId) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const cell = screenPointToGrid(localX, localY, rect.width, rect.height);
  if (!cell) {
    return;
  }
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
  if (state.run?.pendingLoot && state.playerSheet) {
    const lootResult = addLootItemToPlayer(state.playerSheet, state.run.pendingLoot.itemId);
    state.playerSheet = lootResult.playerSheet;
    delete state.run.pendingLoot;
  }
  maybeOpenSkillsOnNewPoint(targeting.previousSkillPoints || 0);
  if (result.actionConsumed) {
    consumePlayerActionAndStartEnvironment();
  }
  rerender();
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
  maybeOpenSkillsOnNewPoint(0);
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

function clearSkillTargeting() {
  state.uiHud.skillTargeting = null;
  if (state.run) {
    delete state.run.skillTargetCells;
    delete state.run.skillTargetingPreview;
  }
}

function syncSkillTargetPreview() {
  if (!state.run) {
    return;
  }
  const targets = state.uiHud.skillTargeting?.targets || [];
  state.run.skillTargetCells = targets;
  const skillId = state.uiHud.skillTargeting?.skillId;
  state.run.skillTargetingPreview = skillId ? buildPreparedSkillPreview(skillId) : null;
}

function maybeOpenSkillsOnNewPoint(previousPoints = 0) {
  const nowPoints = state.playerSheet?.skillPoints || 0;
  if (state.screen === "game" && nowPoints > previousPoints) {
    state.uiHud.skillsPanelOpen = true;
    clearSkillTargeting();
  }
}

function screenPointToGrid(localX, localY, width, height) {
  if (!state.run) {
    return null;
  }
  const tile = Math.max(24, Math.floor(Math.min(width, height) / 11));
  const cameraX = state.run.player.x + 0.5;
  const cameraY = state.run.player.y + 0.5;
  const offsetX = width / 2 - cameraX * tile;
  const offsetY = height / 2 - cameraY * tile;
  const gx = Math.floor((localX - offsetX) / tile);
  const gy = Math.floor((localY - offsetY) / tile);
  if (gx < 0 || gy < 0 || gx >= state.run.width || gy >= state.run.height) {
    return null;
  }
  return { x: gx, y: gy };
}

function buildPreparedSkillPreview(skillId) {
  const skillDef = getSkillById(skillId);
  const skillState = state.playerSheet?.skills?.[skillId];
  const level = skillState?.level || 0;
  const atkMagic = state.playerSheet?.derived?.ATK_MAGIC ?? 0;
  const atkPhys = state.playerSheet?.derived?.ATK_PHYS ?? 0;
  const agi = state.playerSheet?.stats?.AGI ?? state.playerSheet?.baseStats?.AGI ?? 0;
  if (!skillDef || level <= 0) {
    return null;
  }
  if (skillId === "mage_arc_shot") {
    const value = Math.max(1, Math.floor(atkMagic * (1.1 + level * 0.2)));
    return { kind: "damage", value };
  }
  if (skillId === "warrior_power_hit") {
    const value = Math.max(1, Math.floor(atkPhys * (1.2 + level * 0.25)));
    return { kind: "damage", value };
  }
  if (skillId === "warrior_roll") {
    const value = Math.max(1, Math.floor(agi * 0.6 + level));
    return { kind: "damage", value };
  }
  if (skillId === "mage_heal") {
    const value = 40 + Math.max(0, (level - 1) * 10);
    return { kind: "heal", value };
  }
  if (skillId === "warrior_bandage") {
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
  if (state.run?.pendingLoot && state.playerSheet) {
    const lootResult = addLootItemToPlayer(state.playerSheet, state.run.pendingLoot.itemId);
    state.playerSheet = lootResult.playerSheet;
    delete state.run.pendingLoot;
  }
  maybeOpenSkillsOnNewPoint(targeting.previousSkillPoints || 0);
  if (result.actionConsumed) {
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
  maybeOpenSkillsOnNewPoint(targeting.previousSkillPoints || 0);
  if (result.actionConsumed) {
    consumePlayerActionAndStartEnvironment();
  }
  rerender();
}

function consumePlayerActionAndStartEnvironment() {
  if (!state.run || state.run.status !== "running" || state.run.turnPhase !== "player") {
    return;
  }
  beginEnvironmentTurn(state.run);
  clearSkillTargeting();
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
  state.run.environmentNextStepAtMs = nowMs + (result.progressed ? 170 : 80);
  if (state.run?.status === "defeat") {
    state.screen = "ending";
    rerender();
    return;
  }
  if (result.finished) {
    rerender();
  }
}

root.addEventListener("click", onRootClick);
root.addEventListener("wheel", onRootWheel, { passive: false });
root.addEventListener("mouseover", onRootMouseOver);
root.addEventListener("mouseout", onRootMouseOut);
root.addEventListener("dragstart", onRootDragStart);
root.addEventListener("dragover", onRootDragOver);
root.addEventListener("drop", onRootDrop);
root.addEventListener("dragend", onRootDragEnd);
root.addEventListener("click", (event) => {
  const canvas = event.target.closest("#gameCanvas");
  if (canvas) {
    onCanvasClick(event, canvas);
  }
});
window.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", onResize);
requestAnimationFrame(animationLoop);
rerender();
