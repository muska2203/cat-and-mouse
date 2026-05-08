import { getLootPool } from "../loadout.js?v=0.5.0-pre-alpha";
import { randomInt, weightedPick } from "./rng.js?v=0.5.0-pre-alpha";

const LOOT_KIND_WEIGHTS = [
  { value: "restorative_consumable", weight: 30 },
  { value: "other_consumable", weight: 30 },
  { value: "gear", weight: 40 },
];

function getChestSpawnWeights(level) {
  const levelShift = Math.max(0, level - 1);
  const unique = Math.min(0.35, 0.1 + levelShift * 0.015);
  const rare = Math.max(0.15, 0.3 - levelShift * 0.0075);
  const common = Math.max(0.05, 1 - unique - rare);
  return { common, rare, unique };
}

export function getChestCountsForLevel(level, rng = null) {
  const totalChests = randomInt(5, 8, rng);
  const weights = getChestSpawnWeights(level);
  const counts = { chest_common: 0, chest_rare: 0, chest_unique: 0 };
  for (let i = 0; i < totalChests; i += 1) {
    const picked = weightedPick([
      { value: "chest_common", weight: weights.common },
      { value: "chest_rare", weight: weights.rare },
      { value: "chest_unique", weight: weights.unique },
    ], rng);
    counts[picked] += 1;
  }
  return counts;
}

function rollLootPoolByChestRarity(chestRarity, luck = 0, rng = null) {
  const tables = {
    common: [
      { value: "common", weight: 90 },
      { value: "rare", weight: 9 },
      { value: "unique", weight: 1 },
    ],
    rare: [
      { value: "common", weight: 80 },
      { value: "rare", weight: 18 },
      { value: "unique", weight: 2 },
    ],
    unique: [
      { value: "common", weight: 50 },
      { value: "rare", weight: 30 },
      { value: "unique", weight: 20 },
    ],
  };
  const baseTable = tables[chestRarity] || tables.common;
  const luckMult = Math.min(1.6, 1 + Math.max(0, luck) * 0.03);
  const adjustedTable = baseTable.map((entry) => {
    if (entry.value === "rare" || entry.value === "unique") {
      return { ...entry, weight: entry.weight * luckMult };
    }
    return { ...entry };
  });
  return weightedPick(adjustedTable, rng);
}

function getLootCountFromChest(chestRarity, rng = null) {
  const tables = {
    common: [
      { value: 1, weight: 80 },
      { value: 2, weight: 20 },
    ],
    rare: [
      { value: 1, weight: 50 },
      { value: 2, weight: 30 },
      { value: 3, weight: 20 },
    ],
    unique: [
      { value: 1, weight: 10 },
      { value: 2, weight: 20 },
      { value: 3, weight: 50 },
      { value: 4, weight: 20 },
    ],
  };
  const table = tables[chestRarity] || tables.common;
  return weightedPick(table, rng);
}

function getLootKind(rng = null) {
  return weightedPick(LOOT_KIND_WEIGHTS, rng);
}

function pickRandomFromPool(poolName, predicate, rng = null) {
  const pool = getLootPool(poolName).filter(predicate);
  if (pool.length === 0) return null;
  return weightedPick(pool.map((item) => ({ value: item, weight: 1 })), rng);
}

function isRestorativeConsumable(item) {
  if (!item?.isConsumable || item?.isTrapItem) return false;
  const subtype = String(item?.subtype || "");
  return subtype === "heal_hp" || subtype === "heal_mana" || subtype === "heal_hybrid";
}

function getLootFromChestByKind(chestRarity, luck, lootKind, rng = null) {
  if (lootKind === "restorative_consumable") {
    const pool = [
      ...getLootPool("common"),
      ...getLootPool("rare"),
      ...getLootPool("unique"),
    ].filter(isRestorativeConsumable);
    if (pool.length === 0) return null;
    return weightedPick(pool.map((item) => ({ value: item, weight: 1 })), rng);
  }

  const rolledPool = rollLootPoolByChestRarity(chestRarity, luck, rng);
  const fallbackPools = {
    common: ["common", "rare", "unique"],
    rare: ["rare", "common", "unique"],
    unique: ["unique", "rare", "common"],
  };
  const poolOrder = [rolledPool, ...(fallbackPools[chestRarity] || fallbackPools.common)]
    .filter((poolName, index, list) => list.indexOf(poolName) === index);

  const isOtherConsumable = lootKind === "other_consumable";
  for (const poolName of poolOrder) {
    const item = pickRandomFromPool(
      poolName,
      (candidate) => isOtherConsumable
        ? Boolean(candidate?.isConsumable && !isRestorativeConsumable(candidate))
        : Boolean(!candidate?.isConsumable),
      rng,
    );
    if (item) return item;
  }
  return null;
}

export function rollChestLootItems(chestRarity, luck = 0, rng = null) {
  const lootCount = getLootCountFromChest(chestRarity, rng);
  const picks = [];
  for (let i = 0; i < lootCount; i += 1) {
    const lootKind = getLootKind(rng);
    const item = getLootFromChestByKind(chestRarity, luck, lootKind, rng);
    if (!item) continue;
    picks.push(item);
  }
  return picks;
}
