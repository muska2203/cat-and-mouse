import { floorHp } from "../rules.js?v=0.5.6-pre-alpha";
import {
  chebyshevDistance,
  inBounds,
  isWall,
  DIRS_8,
  buildPathToNearestEnemyAttackCell as buildPathToNearestEnemyAttackCellNav,
  buildPathTowardTarget,
  buildPathToNearestAttackCellAroundFocus,
} from "../nav/pathfinding.js?v=0.5.6-pre-alpha";
import { ACTOR_KIND, isObjectBlockingForActor, removeObject } from "./cellObjects.js?v=0.5.6-pre-alpha";
import { getEnemyById } from "./enemies.js?v=0.5.6-pre-alpha";
import { getEnemyMaxHp } from "./enemyDefs.js?v=0.5.6-pre-alpha";
import { syncPlayerHp } from "./syncHp.js?v=0.5.6-pre-alpha";
import {
  ensureEnemyStatus,
  ensurePlayerStatus,
  tickTemporaryObjects,
} from "./trapsAndClouds.js?v=0.5.6-pre-alpha";
import { applyEndOfEnvironmentObjectEffects, applyObjectActivationOnCell } from "./cellActivation.js?v=0.5.6-pre-alpha";
import {
  isCellBlockedForEnemyWithReservations,
} from "./cellBlocking.js?v=0.5.6-pre-alpha";
import {
  AI_IDLE,
  AI_PURSUIT,
  AI_SEARCH,
  broadcastPursuitIntel,
  checkAggroAfterPlayerAction,
  ensureEnemyBrain,
  enemyAtHome,
  enemyInLastKnownVicinity,
  enemySeesPlayer,
} from "./enemyAggro.js?v=0.5.6-pre-alpha";
import { randomFloat } from "./rng.js?v=0.5.6-pre-alpha";
import { revealAroundPlayer } from "./fogReveal.js?v=0.5.6-pre-alpha";
import { processTurnEffects } from "./turnEffects.js?v=0.5.6-pre-alpha";
import { ensureRunFxState, enqueueFloatingText } from "../runtime/runFxState.js?v=0.5.6-pre-alpha";

function processEnvironmentStartEffects(run, playerSheet, actionQueue, fx) {
  const stunnedEnemyIds = new Set();
  let effectCount = 0;
  for (const enemyId of actionQueue) {
    const enemy = getEnemyById(run, enemyId);
    if (!enemy) continue;

    const status = ensureEnemyStatus(enemy);
    if ((status.burnTurns || 0) > 0) {
      const burnPercent = Math.max(0, Number(status.burnPercent || 0.1));
      const enemyHpMax = Math.max(1, Number(getEnemyMaxHp(enemy) || 1));
      const burnDamage = Math.max(2, Math.floor(enemyHpMax * burnPercent));
      enemy.data.hp = Math.max(0, (enemy.data?.hp || 0) - burnDamage);
      status.burnTurns = Math.max(0, (status.burnTurns || 0) - 1);
      enqueueFloatingText(run, {
        x: enemy.x,
        y: enemy.y,
        value: `-${burnDamage}`,
        color: "#fb923c",
        durationMs: 620,
        scale: 1.0,
        startMs: null,
      });
      effectCount += 1;
    }

    if ((enemy.data?.hp || 0) <= 0) {
      removeObject(run, enemy.id);
      continue;
    }

    if ((status.poisonTurns || 0) > 0 && (status.poisonDamage || 0) > 0) {
      const poisonDamage = Math.max(0, status.poisonDamage || 0);
      enemy.data.hp = Math.max(0, (enemy.data?.hp || 0) - poisonDamage);
      status.poisonTurns = Math.max(0, (status.poisonTurns || 0) - 1);
      enqueueFloatingText(run, {
        x: enemy.x,
        y: enemy.y,
        value: `-${poisonDamage}`,
        color: "#86efac",
        durationMs: 620,
        scale: 1.0,
        startMs: null,
      });
      effectCount += 1;
    }

    if ((enemy.data?.hp || 0) <= 0) {
      removeObject(run, enemy.id);
      continue;
    }

    if ((status.stunTurns || 0) > 0) {
      status.stunTurns = Math.max(0, (status.stunTurns || 0) - 1);
      stunnedEnemyIds.add(enemy.id);
      effectCount += 1;
    }
  }
  return { stunnedEnemyIds, effectCount };
}

function pickRandomSearchStep(run, enemy, isCellBlocked) {
  const dirs = [...DIRS_8];
  for (let i = dirs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFloat(run.rng) * (i + 1));
    const tmp = dirs[i];
    dirs[i] = dirs[j];
    dirs[j] = tmp;
  }
  for (const dir of dirs) {
    const nx = enemy.x + dir.x;
    const ny = enemy.y + dir.y;
    if (!inBounds(nx, ny, run)) continue;
    if (isWall(nx, ny, run)) continue;
    if (isCellBlocked(nx, ny)) continue;
    return [{ x: enemy.x, y: enemy.y }, { x: nx, y: ny }];
  }
  return [];
}

export function beginEnvironmentTurn(run) {
  const fx = ensureRunFxState(run);
  if (!run || run.status !== "running") {
    return run;
  }
  /** Пропуск хода не вызывает tryStep/reveal — всё равно проверяем, кто видит героя. */
  checkAggroAfterPlayerAction(run);
  const queue = (run.objects || [])
    .filter((object) => object.type === "enemy")
    .map((object) => object.id);
  run.turnPhase = "environment";
  run.environmentActionQueue = queue;
  fx.environmentNextStepAtMs = 0;
  return run;
}

export function stepEnvironmentTurn(run, playerSheet) {
  if (!run || !playerSheet || run.status !== "running" || run.turnPhase !== "environment") {
    return { run, playerSheet, finished: true, progressed: false };
  }
  const fx = ensureRunFxState(run);

  if ((run.environmentActionQueue || []).length > 0) {
    const actionQueue = [...run.environmentActionQueue];
    run.environmentActionQueue = [];
    const {
      stunnedEnemyIds,
      effectCount: prePhaseEffectCount,
    } = processEnvironmentStartEffects(run, playerSheet, actionQueue, fx);
    const plannedMoves = [];
    const plannedAttacks = [];
    const reservedDestinations = new Set();
    const occupiedByCell = new Map();
    for (const object of run.objects || []) {
      if (!isObjectBlockingForActor(object, ACTOR_KIND.ENEMY)) {
        continue;
      }
      occupiedByCell.set(`${object.x}:${object.y}`, object.id);
    }

    let attackCount = 0;
    let movedCount = 0;
    let effectCount = prePhaseEffectCount;
    let lastAttackerName = "";

    const enemyCellBlocked = (enemy, x, y) => isCellBlockedForEnemyWithReservations(
      run,
      x,
      y,
      enemy.id,
      occupiedByCell,
      reservedDestinations
    );

    for (const enemy of run.objects || []) {
      if (!enemy || enemy.type !== "enemy") continue;
      if (stunnedEnemyIds.has(enemy.id)) continue;
      ensureEnemyBrain(enemy);
      if (enemy.data.aiState === AI_PURSUIT && !enemySeesPlayer(run, enemy)) {
        enemy.data.aiState = AI_SEARCH;
        enemy.data.searchWanderRemaining = -1;
      }
    }
    broadcastPursuitIntel(run);

    for (const enemyId of actionQueue) {
      const enemy = getEnemyById(run, enemyId);
      if (!enemy) {
        continue;
      }
      if (stunnedEnemyIds.has(enemy.id)) {
        continue;
      }

      ensureEnemyBrain(enemy);
      const seesPlayer = enemySeesPlayer(run, enemy);
      const aiState = enemy.data.aiState;

      let path = [];

      if (aiState === AI_IDLE) {
        if (!enemyAtHome(enemy)) {
          path = buildPathTowardTarget(
            run,
            { x: enemy.x, y: enemy.y },
            { x: enemy.data.homeX, y: enemy.data.homeY },
            (x, y) => enemyCellBlocked(enemy, x, y),
          );
        }
      } else if (aiState === AI_PURSUIT) {
        if (!seesPlayer) {
          continue;
        }
        enemy.data.lastSeenPlayer = { x: run.player.x, y: run.player.y };
        const distance = chebyshevDistance(enemy, run.player);
        if (distance === 1) {
          const damageTaken = Math.max(0, enemy.data?.damage || 0);
          const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
          const nextHp = floorHp(hpNow - damageTaken);
          syncPlayerHp(playerSheet, nextHp);
          enqueueFloatingText(run, {
            x: run.player.x,
            y: run.player.y,
            value: `-${damageTaken}`,
            color: "#fca5a5",
            durationMs: 620,
            scale: 1.05,
            startMs: null,
          });
          attackCount += 1;
          lastAttackerName = enemy.name;
          plannedAttacks.push({
            actorId: enemy.id,
            kind: "bounce",
            from: { x: enemy.x, y: enemy.y },
            target: { x: run.player.x, y: run.player.y },
          });
          if (nextHp <= 0) {
            run.status = "defeat";
            run.lastLog = `${enemy.name} атакует мышонка на ${damageTaken}.`;
            return { run, playerSheet, finished: true, progressed: true };
          }
          continue;
        }
        path = buildPathToNearestEnemyAttackCellNav(run, enemy, (x, y) => enemyCellBlocked(enemy, x, y));
      } else if (aiState === AI_SEARCH) {
        const last = enemy.data.lastSeenPlayer;
        if (!last) {
          enemy.data.aiState = AI_IDLE;
          enemy.data.searchWanderRemaining = -1;
          continue;
        }
        if (!enemyInLastKnownVicinity(enemy, last)) {
          enemy.data.searchWanderRemaining = -1;
          path = buildPathToNearestAttackCellAroundFocus(run, enemy, last, (x, y) => enemyCellBlocked(enemy, x, y));
        } else if (enemy.data.searchWanderRemaining < 0) {
          enemy.data.searchWanderRemaining = Number(enemy.data.searchWanderTurns) || 3;
          continue;
        } else if (enemy.data.searchWanderRemaining > 0) {
          path = pickRandomSearchStep(run, enemy, (x, y) => enemyCellBlocked(enemy, x, y));
          enemy.data.searchWanderRemaining -= 1;
          if (enemy.data.searchWanderRemaining === 0) {
            enemy.data.aiState = AI_IDLE;
            enemy.data.lastSeenPlayer = null;
          }
        } else {
          enemy.data.aiState = AI_IDLE;
          enemy.data.lastSeenPlayer = null;
          enemy.data.searchWanderRemaining = -1;
        }
      }

      if (path.length > 1) {
        const nextCell = path[1];
        const from = { x: enemy.x, y: enemy.y };
        const to = { x: nextCell.x, y: nextCell.y };
        plannedMoves.push({ actorId: enemy.id, kind: "move", from, to });
        reservedDestinations.add(`${to.x}:${to.y}`);
        occupiedByCell.delete(`${from.x}:${from.y}`);
        occupiedByCell.set(`${to.x}:${to.y}`, enemy.id);
        movedCount += 1;
      }
    }

    for (const motion of plannedMoves) {
      const enemy = getEnemyById(run, motion.actorId);
      if (!enemy) continue;
      enemy.x = motion.to.x;
      enemy.y = motion.to.y;
      applyObjectActivationOnCell(run, playerSheet, ACTOR_KIND.ENEMY, enemy.x, enemy.y, enemy);
    }

    const plannedMotions = [...plannedMoves, ...plannedAttacks];
    if (plannedMotions.length > 0) {
      fx.environmentMotion = {
        kind: "object-move-batch",
        actors: plannedMotions,
        durationMs: 170,
        startMs: null,
      };
    }

    if (attackCount > 0 && movedCount > 0) {
      run.lastLog = `${lastAttackerName} и другие коты действуют (${attackCount} атак, ${movedCount} перемещений).`;
    } else if (attackCount > 0) {
      run.lastLog = `${lastAttackerName} и другие коты атакуют (${attackCount}).`;
    } else if (movedCount > 0) {
      run.lastLog = `Коты перемещаются (${movedCount}).`;
    } else if (effectCount > 0) {
      run.lastLog = `Коты страдают от эффектов (${effectCount}).`;
    } else {
      run.lastLog = "Коты затаились.";
    }
    return { run, playerSheet, finished: false, progressed: attackCount > 0 || movedCount > 0 || effectCount > 0 };
  }

  run.turnPhase = "player";
  run.turns += 1;
  const objectTurnEffects = applyEndOfEnvironmentObjectEffects(run, playerSheet);
  playerSheet = objectTurnEffects.playerSheet || playerSheet;
  processTurnEffects(run, playerSheet);
  tickTemporaryObjects(run);
  if ((playerSheet.stats?.HP ?? 0) <= 0) {
    run.status = "defeat";
    run.lastLog = "Мышонок пал от эффекта ловушки.";
    return { run, playerSheet, finished: true, progressed: true };
  }
  const playerStatus = ensurePlayerStatus(run);
  if ((playerStatus.stunTurns || 0) > 0) {
    playerStatus.stunTurns = Math.max(0, (playerStatus.stunTurns || 0) - 1);
    run.lastLog = `Мышонок оглушен и пропускает ход (${playerStatus.stunTurns} осталось).`;
    beginEnvironmentTurn(run);
    return { run, playerSheet, finished: false, progressed: true };
  }
  revealAroundPlayer(run, run.visionRange || 6);
  run.lastLog = "Ход окружения завершен. Ваш ход.";
  return { run, playerSheet, finished: true, progressed: false };
}
