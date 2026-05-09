import { floorHp, floorHpMax } from "../rules.js?v=0.5.5-pre-alpha";
import { syncPlayerHp } from "./syncHp.js?v=0.5.5-pre-alpha";
import { enqueueFloatingText } from "../runtime/runFxState.js?v=0.5.5-pre-alpha";

export function processTurnEffects(run, playerSheet) {
  if (!run || !playerSheet) {
    return;
  }
  const effects = Array.isArray(run.overTimeEffects) ? run.overTimeEffects : [];
  if (effects.length === 0) {
    return;
  }
  const alive = [];
  for (const effect of effects) {
    if (effect.type === "bandage_regen") {
      const healPerTurn = Math.max(1, effect.healPerTurn || 0);
      const hpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1);
      const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const nextHp = floorHp(Math.min(hpMax, hpNow + healPerTurn));
      syncPlayerHp(playerSheet, nextHp);
      enqueueFloatingText(run, {
        x: run.player.x,
        y: run.player.y,
        value: `+${Math.max(0, nextHp - hpNow)}`,
        color: "#86efac",
        durationMs: 620,
        scale: 1.05,
        startMs: null,
      });
    } else if (effect.type === "poison_player") {
      const poisonDamage = Math.max(1, effect.poisonDamage || 1);
      const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const nextHp = floorHp(hpNow - poisonDamage);
      syncPlayerHp(playerSheet, nextHp);
      enqueueFloatingText(run, {
        x: run.player.x,
        y: run.player.y,
        value: `-${poisonDamage}`,
        color: "#86efac",
        durationMs: 620,
        scale: 1.0,
        startMs: null,
      });
    } else if (effect.type === "burning_player") {
      const burnPercent = Math.max(0, Number(effect.burnPercent || 0.1));
      const hpMax = floorHpMax(playerSheet.stats?.HP_MAX ?? playerSheet.baseStats?.HP_MAX ?? 1);
      const burnDamage = Math.max(2, floorHp(hpMax * burnPercent));
      const hpNow = floorHp(playerSheet.stats?.HP ?? playerSheet.baseStats?.HP ?? 0);
      const nextHp = floorHp(hpNow - burnDamage);
      syncPlayerHp(playerSheet, nextHp);
      enqueueFloatingText(run, {
        x: run.player.x,
        y: run.player.y,
        value: `-${burnDamage}`,
        color: "#fb923c",
        durationMs: 620,
        scale: 1.0,
        startMs: null,
      });
    }
    effect.turnsLeft = Math.max(0, (effect.turnsLeft || 0) - 1);
    if (effect.turnsLeft > 0) {
      alive.push(effect);
    }
  }
  run.overTimeEffects = alive;
}
