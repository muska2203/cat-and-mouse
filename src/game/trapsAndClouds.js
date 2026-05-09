import { floorHp } from "../rules.js?v=0.5.6-pre-alpha";
import { inBounds, isWall } from "../nav/pathfinding.js?v=0.5.6-pre-alpha";
import { syncPlayerHp } from "./syncHp.js?v=0.5.6-pre-alpha";
import { randomInt } from "./rng.js?v=0.5.6-pre-alpha";
import { enqueueFloatingText, enqueueObjectDissolve } from "../runtime/runFxState.js?v=0.5.6-pre-alpha";
import { createWorldObject } from "./worldObjectModel.js?v=0.5.6-pre-alpha";

export function ensureEnemyStatus(enemy) {
  if (!enemy?.data) return { stunTurns: 0, poisonTurns: 0, poisonDamage: 0, burnTurns: 0, burnPercent: 0 };
  if (!enemy.data.status) {
    enemy.data.status = { stunTurns: 0, poisonTurns: 0, poisonDamage: 0, burnTurns: 0, burnPercent: 0 };
  }
  if (!Number.isFinite(enemy.data.status.burnTurns)) enemy.data.status.burnTurns = 0;
  if (!Number.isFinite(enemy.data.status.burnPercent)) enemy.data.status.burnPercent = 0;
  return enemy.data.status;
}

export function ensurePlayerStatus(run) {
  if (!run.playerStatus) {
    run.playerStatus = {
      stunTurns: 0,
    };
  }
  return run.playerStatus;
}

export function applyTrapEffectToEnemy(run, enemy, trapConfig) {
  if (!enemy) return "";
  const status = ensureEnemyStatus(enemy);
  const parts = [];
  const damage = Math.max(0, trapConfig?.damage || 0);
  if (damage > 0) {
    enemy.data.hp = Math.max(0, (enemy.data?.hp || 0) - damage);
    enqueueFloatingText(run, {
      x: enemy.x,
      y: enemy.y,
      value: `-${damage}`,
      color: "#fca5a5",
      durationMs: 620,
      scale: 1.05,
      startMs: null,
    });
    parts.push(`получает ${damage} урона`);
  }
  const stunTurns = Math.max(0, trapConfig?.stunTurns || 0);
  if (stunTurns > 0) {
    status.stunTurns = Math.max(status.stunTurns || 0, stunTurns);
    parts.push(`оглушен на ${stunTurns} ход`);
  }
  const poisonTurns = Math.max(0, trapConfig?.poisonTurns || 0);
  const poisonDamage = Math.max(0, trapConfig?.poisonDamage || 0);
  if (poisonTurns > 0 && poisonDamage > 0) {
    status.poisonTurns = Math.max(status.poisonTurns || 0, poisonTurns);
    status.poisonDamage = Math.max(status.poisonDamage || 0, poisonDamage);
    parts.push(`отравлен (${poisonDamage} x ${poisonTurns})`);
  }
  return parts.join(", ");
}

export function applyTrapEffectToPlayer(run, playerSheet, trapConfig) {
  const parts = [];
  const damage = Math.max(0, trapConfig?.damage || 0);
  if (damage > 0) {
    const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
    const nextHp = floorHp(hpNow - damage);
    syncPlayerHp(playerSheet, nextHp);
    enqueueFloatingText(run, {
      x: run.player.x,
      y: run.player.y,
      value: `-${damage}`,
      color: "#fda4af",
      durationMs: 620,
      scale: 1.05,
      startMs: null,
    });
    parts.push(`получает ${damage} урона`);
  }
  const poisonTurns = Math.max(0, trapConfig?.poisonTurns || 0);
  const poisonDamage = Math.max(0, trapConfig?.poisonDamage || 0);
  if (poisonTurns > 0 && poisonDamage > 0) {
    const effects = [...(run.overTimeEffects || [])];
    const idx = effects.findIndex((e) => e.type === "poison_player");
    if (idx >= 0) {
      const cur = effects[idx];
      effects[idx] = {
        type: "poison_player",
        turnsLeft: Math.max(cur.turnsLeft || 0, poisonTurns),
        poisonDamage: Math.max(cur.poisonDamage || 0, poisonDamage),
      };
    } else {
      effects.push({
        type: "poison_player",
        turnsLeft: poisonTurns,
        poisonDamage,
      });
    }
    run.overTimeEffects = effects;
    parts.push(`отравлен (${poisonDamage} x ${poisonTurns})`);
  }
  const stunTurns = Math.max(0, trapConfig?.stunTurns || 0);
  if (stunTurns > 0) {
    const playerStatus = ensurePlayerStatus(run);
    playerStatus.stunTurns = Math.max(playerStatus.stunTurns || 0, stunTurns);
    parts.push(`оглушен на ${stunTurns} ход`);
  }
  return parts.join(", ");
}

export function spawnPoisonCloudObjects(run, centerX, centerY, sourceName, trapConfig) {
  const durationTurns = Math.max(1, trapConfig?.cloudDurationTurns || 2);
  const cloudDamage = Math.max(0, trapConfig?.cloudDamage || 0);
  const cells = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (!inBounds(x, y, run) || isWall(x, y, run)) {
        continue;
      }
      cells.push({ x, y });
    }
  }
  for (const cell of cells) {
    run.objects.push(createWorldObject({
      id: `poison_cloud_${Date.now()}_${cell.x}_${cell.y}_${randomInt(0, 9999, run?.rng || null)}`,
      name: "Ядовитый туман",
      description:
        "Ядовитый туман. В конце хода окружения наносит урон всем, кто стоит на этой клетке.",
      type: "poison_cloud",
      purpose: "poison_cloud",
      icon: "☠",
      oneTime: false,
      blocksMovement: false,
      blocksEnemyMovement: false,
      turnTick: { effect: "affect_cooccupants_with_trap" },
      x: cell.x,
      y: cell.y,
      data: {
        sourceName,
        durationTurns,
        // Только мгновенный урон при со-жительстве на конце хода окружения; без активации при входе и без отложенного яда.
        trapConfig: {
          damage: cloudDamage,
        },
      },
    }));
  }
}

export function tickTemporaryObjects(run) {
  const objects = run.objects || [];
  const alive = [];
  for (const object of objects) {
    if (object.type !== "poison_cloud") {
      alive.push(object);
      continue;
    }
    const turnsLeft = Math.max(0, (object.data?.durationTurns || 0) - 1);
    if (turnsLeft > 0) {
      object.data.durationTurns = turnsLeft;
      alive.push(object);
    } else {
      const nowMs = typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
      enqueueObjectDissolve(run, object, nowMs);
    }
  }
  run.objects = alive;
}
