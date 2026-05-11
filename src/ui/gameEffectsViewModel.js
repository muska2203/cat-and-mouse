export function buildActiveEffectsViewModel(run, sheet) {
  const effects = [];
  function toTurnsLabel(turnsLeft) {
    if (turnsLeft === Infinity) {
      return "∞";
    }
    const normalized = Math.max(0, Math.floor(Number(turnsLeft || 0)));
    return `${normalized} х.`;
  }
  if ((run?.nextHitMultiplier || 1) > 1) {
    effects.push({
      icon: "🧪",
      name: "Колба специй",
      desc: `Следующий удар x${run.nextHitMultiplier}.`,
      turnsLeft: 1,
      turns: toTurnsLabel(1),
    });
  }
  const bandage = (run?.overTimeEffects || []).find((effect) => effect.type === "bandage_regen");
  if (bandage?.turnsLeft > 0) {
    effects.push({
      icon: "🩹",
      name: "Перевязан",
      desc: "Восстановление HP каждый ход.",
      turnsLeft: Number(bandage.turnsLeft),
      turns: toTurnsLabel(bandage.turnsLeft),
    });
  }
  const burning = (run?.overTimeEffects || []).find((effect) => effect.type === "burning_player");
  if (burning?.turnsLeft > 0) {
    effects.push({
      icon: "🔥",
      name: "Горение",
      desc: "Каждый ход теряет 10% от МАКС HP (минимум 2).",
      turnsLeft: Number(burning.turnsLeft),
      turns: toTurnsLabel(burning.turnsLeft),
    });
  }
  const steel = run?.steelStanceBuff;
  if (steel && Number(steel.turnsLeft || 0) > 0) {
    const lvl = Math.max(1, Number(steel.level || 1));
    const chancePct = lvl >= 3 ? 80 : lvl >= 2 ? 60 : 40;
    effects.push({
      icon: "🛡",
      name: "Стальная стойка",
      desc: `При ударе кота в ближнем бою шанс ответить тем же уроном, что обычный удар мечом: ${chancePct}%.`,
      turnsLeft: Number(steel.turnsLeft),
      turns: toTurnsLabel(steel.turnsLeft),
    });
  }
  const stackEffects = sheet?.effectStacks || {};
  if ((stackEffects.hp_max_plus_5 || 0) > 0) {
    effects.push({ icon: "🧀", name: "Твердый сыр", desc: "Постоянный бонус HP.", turnsLeft: Infinity, turns: toTurnsLabel(Infinity) });
  }
  if ((stackEffects.hp_max_plus_4 || 0) > 0) {
    effects.push({ icon: "🥨", name: "Сухарик", desc: "Постоянный бонус HP.", turnsLeft: Infinity, turns: toTurnsLabel(Infinity) });
  }
  if ((stackEffects.hp_max_plus_1 || 0) > 0) {
    effects.push({ icon: "👑", name: "Королевский сыр", desc: "Постоянный бонус HP.", turnsLeft: Infinity, turns: toTurnsLabel(Infinity) });
  }
  effects.sort((left, right) => {
    const l = Number.isFinite(left.turnsLeft) ? Number(left.turnsLeft) : Infinity;
    const r = Number.isFinite(right.turnsLeft) ? Number(right.turnsLeft) : Infinity;
    return r - l;
  });
  return effects;
}
