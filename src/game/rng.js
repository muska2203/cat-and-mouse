export function createRunRng(seed = Date.now()) {
  // Детерминированный генератор (mulberry32) для воспроизводимых забегов.
  let state = (Number(seed) >>> 0) || 1;
  return {
    seed: state,
    nextFloat() {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randomFloat(rng = null) {
  if (rng && typeof rng.nextFloat === "function") {
    return rng.nextFloat();
  }
  return Math.random();
}

export function randomInt(min, max, rng = null) {
  return Math.floor(randomFloat(rng) * (max - min + 1)) + min;
}

export function randomPick(list, rng = null) {
  return list[Math.floor(randomFloat(rng) * list.length)];
}

export function weightedPick(weightedEntries, rng = null) {
  const total = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return weightedEntries[0]?.value ?? null;
  }
  const roll = randomFloat(rng) * total;
  let acc = 0;
  for (const entry of weightedEntries) {
    acc += entry.weight;
    if (roll <= acc) {
      return entry.value;
    }
  }
  return weightedEntries[weightedEntries.length - 1]?.value ?? null;
}
