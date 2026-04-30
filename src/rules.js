function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function buildDerivedStats(stats) {
  const atkPhys = stats.STR * 2 + Math.floor(stats.AGI * 0.5);
  const atkMagic = stats.INT * 2 + Math.floor(stats.LUK * 0.5);
  const critChance = clamp(5 + stats.AGI + Math.floor(stats.LUK * 0.5), 5, 30);
  const critMultiplier = 1.5;
  const computedHpMax = stats.HP_MAX;

  return {
    HP_MAX_COMPUTED: computedHpMax,
    ATK_PHYS: atkPhys,
    ATK_MAGIC: atkMagic,
    CRIT_CHANCE: critChance,
    CRIT_MULT: critMultiplier,
  };
}
