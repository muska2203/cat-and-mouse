import { getLootPool } from "../loadout.js?v=0.4.12-pre-alpha";
import { randomInt, weightedPick } from "./rng.js?v=0.4.12-pre-alpha";

const CONSUMABLE_WEIGHT_MULTIPLIER = 0.8;

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

function getLootFromChest(chestRarity, excludedItemIds = new Set(), luck = 0, rng = null) {
  const rolledPool = rollLootPoolByChestRarity(chestRarity, luck, rng);
  const fallbackPools = {
    common: ["common", "rare", "unique"],
    rare: ["rare", "common", "unique"],
    unique: ["unique", "rare", "common"],
  };
  const poolOrder = [rolledPool, ...(fallbackPools[chestRarity] || fallbackPools.common)]
    .filter((poolName, index, list) => list.indexOf(poolName) === index);
  for (const poolName of poolOrder) {
    const pool = getLootPool(poolName).filter((item) => !excludedItemIds.has(item.id));
    if (pool.length > 0) {
      return weightedPick(
        pool.map((item) => ({
          value: item,
          weight: item?.isConsumable ? CONSUMABLE_WEIGHT_MULTIPLIER : 1,
        })),
        rng,
      );
    }
  }
  return null;
}

export function rollChestLootItems(chestRarity, luck = 0, rng = null) {
  const lootCount = getLootCountFromChest(chestRarity, rng);
  const picks = [];
  const excluded = new Set();
  for (let i = 0; i < lootCount; i += 1) {
    const item = getLootFromChest(chestRarity, excluded, luck, rng);
    if (!item) continue;
    picks.push(item);
    excluded.add(item.id);
  }
  return picks;
}
