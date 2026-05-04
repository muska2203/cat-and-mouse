import { floorHp } from "../rules.js?v=0.4.5-pre-alpha";
import {
  chebyshevDistance,
  buildPathToNearestEnemyAttackCell as buildPathToNearestEnemyAttackCellNav,
} from "../nav/pathfinding.js?v=0.4.5-pre-alpha";
import { ACTOR_KIND, isObjectBlockingForActor, removeObject } from "./cellObjects.js?v=0.4.5-pre-alpha";
import { getEnemyById } from "./enemies.js?v=0.4.5-pre-alpha";
import { syncPlayerHp } from "./syncHp.js?v=0.4.5-pre-alpha";
import {
  ensureEnemyStatus,
  ensurePlayerStatus,
  tickTemporaryObjects,
} from "./trapsAndClouds.js?v=0.4.5-pre-alpha";
import { applyObjectActivationOnCell } from "./cellActivation.js?v=0.4.5-pre-alpha";
import {
  isCellBlockedForEnemy,
  isCellBlockedForEnemyWithReservations,
} from "./cellBlocking.js?v=0.4.5-pre-alpha";
import { revealAroundPlayer } from "./fogReveal.js?v=0.4.5-pre-alpha";
import { processTurnEffects } from "./turnEffects.js?v=0.4.5-pre-alpha";

export function beginEnvironmentTurn(run) {
  if (!run || run.status !== "running") {
    return run;
  }
  const queue = (run.objects || [])
    .filter((object) => object.type === "enemy")
    .map((object) => object.id);
  run.turnPhase = "environment";
  run.environmentActionQueue = queue;
  run.environmentNextStepAtMs = 0;
  return run;
}

export function stepEnvironmentTurn(run, playerSheet) {
  if (!run || !playerSheet || run.status !== "running" || run.turnPhase !== "environment") {
    return { run, playerSheet, finished: true, progressed: false };
  }

  if ((run.environmentActionQueue || []).length > 0) {
    const actionQueue = [...run.environmentActionQueue];
    run.environmentActionQueue = [];
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
    let effectCount = 0;
    let lastAttackerName = "";

    for (const enemyId of actionQueue) {
      const enemy = getEnemyById(run, enemyId);
      if (!enemy) {
        continue;
      }
      const status = ensureEnemyStatus(enemy);
      if ((status.poisonTurns || 0) > 0 && (status.poisonDamage || 0) > 0) {
        const poisonDamage = Math.max(0, status.poisonDamage || 0);
        enemy.data.hp = Math.max(0, (enemy.data?.hp || 0) - poisonDamage);
        status.poisonTurns = Math.max(0, (status.poisonTurns || 0) - 1);
        run.floatingTexts.push({
          x: enemy.x,
          y: enemy.y,
          value: `-${poisonDamage}`,
          color: "#86efac",
          durationMs: 620,
          scale: 1.0,
          startMs: null,
        });
        effectCount += 1;
        if ((enemy.data?.hp || 0) <= 0) {
          removeObject(run, enemy.id);
          continue;
        }
      }
      if ((status.stunTurns || 0) > 0) {
        status.stunTurns = Math.max(0, (status.stunTurns || 0) - 1);
        effectCount += 1;
        continue;
      }

      if (!run.discovered?.[enemy.y]?.[enemy.x]) {
        continue;
      }

      const distance = chebyshevDistance(enemy, run.player);
      if (distance === 1) {
        const damageTaken = Math.max(0, enemy.data?.damage || 0);
        const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
        const nextHp = floorHp(hpNow - damageTaken);
        syncPlayerHp(playerSheet, nextHp);
        run.floatingTexts.push({
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

      const path = buildPathToNearestEnemyAttackCellNav(run, enemy, (x, y) => {
        if (!run.discovered?.[y]?.[x]) {
          return true;
        }
        return isCellBlockedForEnemyWithReservations(
          run,
          x,
          y,
          enemy.id,
          occupiedByCell,
          reservedDestinations
        );
      });
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
      run.environmentMotion = {
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

  while ((run.environmentActionQueue || []).length > 0) {
    const enemyId = run.environmentActionQueue.shift();
    const enemy = getEnemyById(run, enemyId);
    if (!enemy) {
      continue;
    }

    if (!run.discovered?.[enemy.y]?.[enemy.x]) {
      continue;
    }

    const distance = Math.abs(enemy.x - run.player.x) + Math.abs(enemy.y - run.player.y);
    if (distance === 1) {
      const damageTaken = Math.max(0, enemy.data?.damage || 0);
      const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const nextHp = floorHp(hpNow - damageTaken);
      syncPlayerHp(playerSheet, nextHp);
      run.floatingTexts.push({
        x: run.player.x,
        y: run.player.y,
        value: `-${damageTaken}`,
        color: "#fca5a5",
        durationMs: 620,
        scale: 1.05,
        startMs: null,
      });
      run.lastLog = `${enemy.name} атакует мышонка на ${damageTaken}.`;
      if (nextHp <= 0) {
        run.status = "defeat";
      }
      return { run, playerSheet, finished: false, progressed: true };
    }

    const candidates = [
      { x: enemy.x + 1, y: enemy.y },
      { x: enemy.x - 1, y: enemy.y },
      { x: enemy.x, y: enemy.y + 1 },
      { x: enemy.x, y: enemy.y - 1 },
    ]
      .filter((cell) => !isCellBlockedForEnemy(run, cell.x, cell.y, enemy.id))
      .map((cell) => ({
        ...cell,
        d: Math.abs(cell.x - run.player.x) + Math.abs(cell.y - run.player.y),
      }))
      .sort((a, b) => a.d - b.d);

    if (candidates.length > 0 && candidates[0].d < distance) {
      const from = { x: enemy.x, y: enemy.y };
      enemy.x = candidates[0].x;
      enemy.y = candidates[0].y;
      run.environmentMotion = {
        kind: "object-move",
        actorId: enemy.id,
        from,
        to: { x: enemy.x, y: enemy.y },
        durationMs: 170,
        startMs: null,
      };
      run.lastLog = `${enemy.name} приближается к мышонку.`;
      return { run, playerSheet, finished: false, progressed: true };
    }
  }

  run.turnPhase = "player";
  run.turns += 1;
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
