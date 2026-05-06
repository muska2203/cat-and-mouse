/**
 * Клик / hover по игровому canvas и автопоход по залоченному пути.
 * Зависимости передаются снаружи (состояние живёт в main.js).
 */
import { resolveDirectionByDelta } from "../input/directionMap.js?v=0.4.8-pre-alpha";
import { ensureRunFxState } from "./runFxState.js?v=0.4.8-pre-alpha";

export function createCanvasRunHandlers(deps) {
  const {
    getState,
    canAcceptPlayerAction,
    rerender,
    clearPathingState,
    performStep,
    tryStep,
    buildPathToDiscoveredCell,
    isValidPathTargetCell,
    screenPointToGrid,
    isPlayerInputBlocked,
    getItemById,
    getEnemyById,
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
  } = deps;

  function getEnemyAtCell(run, cell) {
    if (!run || !cell) {
      return null;
    }
    return run.objects.find((object) => object.type === "enemy" && object.x === cell.x && object.y === cell.y) || null;
  }

  function onCanvasClick(event, canvas) {
    const state = getState();
    if (!canAcceptPlayerAction(state)) {
      return;
    }
    const nowMs = performance.now();
    if (isPlayerInputBlocked(nowMs)) {
      return;
    }

    const targeting = state.uiHud.skillTargeting;
    const trapTargeting = state.uiHud.trapTargeting;
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const cell = screenPointToGrid(
      state.run,
      localX,
      localY,
      rect.width,
      rect.height,
      state.uiHud?.canvasZoom ?? 1,
    );
    if (!cell) {
      return;
    }
    if (trapTargeting?.itemId) {
      const canPlace = (trapTargeting.targets || []).some((target) => target.x === cell.x && target.y === cell.y);
      if (!canPlace) {
        state.run.lastLog = "Выбери соседнюю свободную клетку для ловушки.";
        rerender();
        return;
      }
      const item = getItemById(trapTargeting.itemId);
      const placeResult = placeTrap(state.run, state.playerSheet, item, cell.x, cell.y);
      state.run = placeResult.run;
      state.playerSheet = placeResult.playerSheet;
      if (!placeResult.ok) {
        state.run.lastLog = placeResult.log || "Не удалось поставить ловушку.";
        rerender();
        return;
      }
      const nextBag = [...(state.playerSheet.bag || [])];
      const removeIndex = trapTargeting.bagRemoveIndex;
      if (Number.isInteger(removeIndex) && removeIndex >= 0 && removeIndex < nextBag.length) {
        nextBag.splice(removeIndex, 1);
        state.playerSheet = recalculateSheetFromInventory(
          state.playerSheet,
          state.playerSheet.equippedByType,
          nextBag
        );
      }
      clearSkillTargeting();
      consumePlayerActionAndStartEnvironment();
      rerender();
      return;
    }
    if (!targeting?.skillId) {
      const enemyAtCell = getEnemyAtCell(state.run, cell);
      const dx = cell.x - state.run.player.x;
      const dy = cell.y - state.run.player.y;
      const adjacentDirection = resolveDirectionByDelta(dx, dy);
      if (adjacentDirection) {
        const consumed = performStep(adjacentDirection);
        if (consumed) {
          return;
        }
      }
      if (enemyAtCell) {
        lockAutoPathToEnemy(enemyAtCell.id);
      } else {
        lockAutoPathToCell(cell);
      }
      maybeRunAutoMoveStep();
      rerender();
      return;
    }
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

  function onCanvasMouseMove(event, canvas) {
    const state = getState();
    if (!canAcceptPlayerAction(state)) {
      return;
    }
    if (state.uiHud.autoMoveActive || state.uiHud.skillTargeting?.skillId || state.uiHud.trapTargeting?.itemId) {
      return;
    }
    const nowMs = performance.now();
    if (isPlayerInputBlocked(nowMs)) {
      if (state.uiHud.pathHoverCell || (state.uiHud.pathPreviewCells || []).length > 0) {
        state.uiHud.pathHoverCell = null;
        state.uiHud.pathPreviewCells = [];
        rerender();
      }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const cell = screenPointToGrid(
      state.run,
      localX,
      localY,
      rect.width,
      rect.height,
      state.uiHud?.canvasZoom ?? 1,
    );
    if (!cell) {
      if (state.uiHud.pathHoverCell || (state.uiHud.pathPreviewCells || []).length > 0 || state.uiHud.pathHoverEnemy) {
        state.uiHud.pathHoverCell = null;
        state.uiHud.pathHoverEnemy = null;
        state.uiHud.pathPreviewCells = [];
        rerender();
      }
      return;
    }
    if (!isValidPathTargetCell(state.run, cell)) {
      if (state.uiHud.pathHoverCell || (state.uiHud.pathPreviewCells || []).length > 0 || state.uiHud.pathHoverEnemy) {
        state.uiHud.pathHoverCell = null;
        state.uiHud.pathHoverEnemy = null;
        state.uiHud.pathPreviewCells = [];
        rerender();
      }
      return;
    }
    const path = buildPathToDiscoveredCell(
      state.run,
      { x: state.run.player.x, y: state.run.player.y },
      { x: cell.x, y: cell.y },
      {
        allowPlayer: true,
        allowGoal: true,
        blockObjects: true,
      }
    );
    state.uiHud.pathHoverCell = { x: cell.x, y: cell.y };
    const enemyAtCell = getEnemyAtCell(state.run, cell);
    state.uiHud.pathHoverEnemy = enemyAtCell ? enemyAtCell.id : null;
    state.uiHud.pathPreviewCells = path.length > 1 ? path.slice(1) : [];
    rerender();
  }

  function onCanvasMouseLeave() {
    const state = getState();
    if (state.uiHud.autoMoveActive) {
      return;
    }
    if (state.uiHud.pathHoverCell || (state.uiHud.pathPreviewCells || []).length > 0 || state.uiHud.pathHoverEnemy) {
      state.uiHud.pathHoverCell = null;
      state.uiHud.pathHoverEnemy = null;
      state.uiHud.pathPreviewCells = [];
      rerender();
    }
  }

  function lockAutoPathToCell(targetCell) {
    const state = getState();
    if (!state.run || !state.playerSheet) {
      return;
    }
    if (!isValidPathTargetCell(state.run, targetCell)) {
      state.run.lastLog = "Маршрут можно строить только по открытым проходимым клеткам.";
      clearPathingState();
      return;
    }
    const path = buildPathToDiscoveredCell(
      state.run,
      { x: state.run.player.x, y: state.run.player.y },
      { x: targetCell.x, y: targetCell.y },
      {
        allowPlayer: true,
        allowGoal: true,
        blockObjects: true,
      }
    );
    if (path.length < 2) {
      state.run.lastLog = "Нет доступного пути к выбранной клетке.";
      clearPathingState();
      return;
    }
    state.uiHud.pathLockedTarget = { x: targetCell.x, y: targetCell.y };
    state.uiHud.pathLockedEnemyId = null;
    state.uiHud.pathLockedCells = path.slice(1).map((cell) => ({ x: cell.x, y: cell.y }));
    state.uiHud.autoMoveActive = true;
    state.uiHud.autoMoveLastHp = state.playerSheet?.stats?.HP ?? 0;
  }

  function lockAutoPathToEnemy(enemyId) {
    const state = getState();
    if (!state.run || !state.playerSheet || !enemyId) {
      return;
    }
    const enemy = getEnemyById(state.run, enemyId);
    if (!enemy) {
      state.run.lastLog = "Автодвижение к противнику не запущено: цель не найдена.";
      clearPathingState();
      return;
    }
    const targetCell = { x: enemy.x, y: enemy.y };
    const path = buildPathToDiscoveredCell(
      state.run,
      { x: state.run.player.x, y: state.run.player.y },
      targetCell,
      {
        allowPlayer: true,
        allowGoal: true,
        blockObjects: true,
      }
    );
    if (path.length < 2) {
      state.run.lastLog = "Нет доступного пути к выбранному противнику.";
      clearPathingState();
      return;
    }
    state.uiHud.pathLockedTarget = targetCell;
    state.uiHud.pathLockedEnemyId = enemyId;
    state.uiHud.pathLockedCells = path.slice(1).map((cell) => ({ x: cell.x, y: cell.y }));
    state.uiHud.autoMoveActive = true;
    state.uiHud.autoMoveLastHp = state.playerSheet?.stats?.HP ?? 0;
  }

  function advanceLockedPathAfterStep() {
    const state = getState();
    if (!state.uiHud.autoMoveActive) {
      return;
    }
    if (!Array.isArray(state.uiHud.pathLockedCells) || state.uiHud.pathLockedCells.length === 0) {
      clearPathingState();
      return;
    }
    state.uiHud.pathLockedCells = state.uiHud.pathLockedCells.slice(1);
    if (state.uiHud.pathLockedCells.length === 0) {
      clearPathingState();
    }
  }

  function maybeRunAutoMoveStep() {
    const state = getState();
    if (!state.run || !state.playerSheet || !state.uiHud.autoMoveActive) {
      return;
    }
    if (!canAcceptPlayerAction(state)) {
      return;
    }
    const nowMs = performance.now();
    const fx = ensureRunFxState(state.run);
    normalizeFinishedAnimationsForRun(state.run, nowMs);
    if (isBlockingMotionActive(fx.motion, nowMs) || isBlockingMotionActive(fx.environmentMotion, nowMs)) {
      return;
    }
    const hpNowBeforeStep = Number(state.playerSheet?.stats?.HP ?? state.playerSheet?.baseStats?.HP ?? 0);
    const hpAtLock = Number(state.uiHud.autoMoveLastHp ?? hpNowBeforeStep);
    if (hpNowBeforeStep < hpAtLock) {
      state.run.lastLog = "Автодвижение остановлено: персонаж получил урон.";
      clearPathingState();
      rerender();
      return;
    }
    if (state.uiHud.pathLockedEnemyId) {
      const targetEnemy = getEnemyById(state.run, state.uiHud.pathLockedEnemyId);
      if (!targetEnemy) {
        state.run.lastLog = "Автодвижение остановлено: противник больше не найден.";
        clearPathingState();
        rerender();
        return;
      }
      const targetCell = { x: targetEnemy.x, y: targetEnemy.y };
      const path = buildPathToDiscoveredCell(
        state.run,
        { x: state.run.player.x, y: state.run.player.y },
        targetCell,
        {
          allowPlayer: true,
          allowGoal: true,
          blockObjects: true,
        }
      );
      if (path.length < 2) {
        state.run.lastLog = "Автодвижение остановлено: путь к противнику недоступен.";
        clearPathingState();
        rerender();
        return;
      }
      state.uiHud.pathLockedTarget = targetCell;
      state.uiHud.pathLockedCells = path.slice(1).map((cell) => ({ x: cell.x, y: cell.y }));
    }
    const next = state.uiHud.pathLockedCells?.[0];
    if (!next) {
      clearPathingState();
      rerender();
      return;
    }
    const dx = next.x - state.run.player.x;
    const dy = next.y - state.run.player.y;
    const direction = resolveDirectionByDelta(dx, dy);
    if (!direction) {
      state.run.lastLog = "Автодвижение остановлено: маршрут устарел.";
      clearPathingState();
      rerender();
      return;
    }
    const stepResult = tryStep(state.run, state.playerSheet, direction);
    if (!stepResult.actionConsumed) {
      state.run.lastLog = "Автодвижение остановлено: путь заблокирован.";
      clearPathingState();
      rerender();
      return;
    }
    state.run = stepResult.run;
    state.playerSheet = stepResult.playerSheet;
    if (state.run && stepResult.motion) {
      fx.motion = stepResult.motion;
    }
    const hpNowAfterStep = Number(state.playerSheet?.stats?.HP ?? state.playerSheet?.baseStats?.HP ?? 0);
    state.uiHud.autoMoveLastHp = hpNowAfterStep;
    if (stepResult.playerDamaged || stepResult.objectActivated) {
      clearPathingState();
      rerender();
      return;
    }
    const movedToNextCell = state.run.player.x === next.x && state.run.player.y === next.y;
    if (movedToNextCell) {
      advanceLockedPathAfterStep();
    }
    consumePlayerActionAndStartEnvironment();
    rerender();
  }

  return {
    onCanvasClick,
    onCanvasMouseMove,
    onCanvasMouseLeave,
    lockAutoPathToCell,
    lockAutoPathToEnemy,
    advanceLockedPathAfterStep,
    maybeRunAutoMoveStep,
  };
}
