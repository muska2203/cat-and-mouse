export function buildActiveEffectsViewModel(run, sheet) {
  const effects = [];
  if ((run?.nextHitMultiplier || 1) > 1) {
    effects.push({ icon: "🧪", name: "Колба специй", desc: `Следующий удар x${run.nextHitMultiplier}.`, turns: "1 х." });
  }
  const bandage = (run?.overTimeEffects || []).find((effect) => effect.type === "bandage_regen");
  if (bandage?.turnsLeft > 0) {
    effects.push({ icon: "🩹", name: "Перевязан", desc: "Восстановление HP каждый ход.", turns: `${bandage.turnsLeft} х.` });
  }
  const stackEffects = sheet?.effectStacks || {};
  if ((stackEffects.hp_max_plus_5 || 0) > 0) {
    effects.push({ icon: "🧀", name: "Твердый сыр", desc: "Постоянный бонус HP.", turns: "∞" });
  }
  if ((stackEffects.hp_max_plus_4 || 0) > 0) {
    effects.push({ icon: "🥨", name: "Сухарик", desc: "Постоянный бонус HP.", turns: "∞" });
  }
  if ((stackEffects.hp_max_plus_1 || 0) > 0) {
    effects.push({ icon: "👑", name: "Королевский сыр", desc: "Постоянный бонус HP.", turns: "∞" });
  }
  return effects;
}
