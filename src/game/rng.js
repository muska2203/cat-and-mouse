export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function weightedPick(weightedEntries) {
  const total = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return weightedEntries[0]?.value ?? null;
  }
  const roll = Math.random() * total;
  let acc = 0;
  for (const entry of weightedEntries) {
    acc += entry.weight;
    if (roll <= acc) {
      return entry.value;
    }
  }
  return weightedEntries[weightedEntries.length - 1]?.value ?? null;
}
