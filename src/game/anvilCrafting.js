import {
  getAllLootItems,
  getItemById,
} from "../loadout.js?v=0.5.0-pre-alpha";
import { normalizeSkillInstanceData } from "../skillsRuntime.js?v=0.5.0-pre-alpha";

const EQUIP_TYPES = new Set(["weapon", "armor", "amulet"]);

function toRandomFn(rng) {
  if (rng && typeof rng.nextFloat === "function") {
    return () => rng.nextFloat();
  }
  return () => Math.random();
}

export function getItemRarity(item) {
  const id = String(item?.id || "");
  if (id.startsWith("unique_")) return "unique";
  if (id.startsWith("rare_")) return "rare";
  return "common";
}

export function isEquipableItem(item) {
  return !!item && EQUIP_TYPES.has(String(item.type || ""));
}

function rarityScore(rarity) {
  if (rarity === "unique") return 3;
  if (rarity === "rare") return 2;
  return 1;
}

function getRecycleWeightByRarity(rarity) {
  if (rarity === "unique") return 60;
  if (rarity === "rare") return 30;
  return 10;
}

function pickRandom(list, randomFn) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const index = Math.floor(Math.max(0, Math.min(0.999999, randomFn())) * list.length);
  return list[index] || null;
}

function rollRarityByProbabilities(probabilities, randomFn) {
  const roll = randomFn() * 100;
  if (roll < probabilities.uniqueChance) return "unique";
  if (roll < probabilities.uniqueChance + probabilities.rareChance) return "rare";
  return "common";
}

function getEquipableByRarity(rarity) {
  return getAllLootItems().filter((item) => isEquipableItem(item) && getItemRarity(item) === rarity);
}

function getSkillInstanceForItem(item, rng) {
  const randomFn = toRandomFn(rng);
  return normalizeSkillInstanceData(item, null, randomFn);
}

export function getRecyclePreview(slots) {
  const usedSlots = (slots || []).filter(Boolean);
  const totalWeight = usedSlots.reduce((sum, slot) => {
    const item = getItemById(slot.itemId);
    return sum + getRecycleWeightByRarity(getItemRarity(item));
  }, 0);
  const uniqueChance = Math.max(0, Math.min(100, totalWeight - 100));
  const rareChance = Math.max(0, Math.min(100, totalWeight - uniqueChance));
  const commonChance = Math.max(0, 100 - rareChance - uniqueChance);
  return {
    totalWeight,
    commonChance,
    rareChance,
    uniqueChance,
  };
}

export function canCraftRecycle(slots) {
  const usedSlots = (slots || []).filter(Boolean);
  if (usedSlots.length !== 3) return false;
  return usedSlots.every((slot) => isEquipableItem(getItemById(slot.itemId)));
}

export function buildRecycleResult(slots, rng) {
  if (!canCraftRecycle(slots)) return null;
  const randomFn = toRandomFn(rng);
  const probabilities = getRecyclePreview(slots);
  const rarity = rollRarityByProbabilities(probabilities, randomFn);
  const candidates = getEquipableByRarity(rarity);
  const rolled = pickRandom(candidates, randomFn);
  if (!rolled) return null;
  return {
    itemId: rolled.id,
    item: rolled,
    rarity,
    skill: getSkillInstanceForItem(rolled, rng),
    probabilities,
  };
}

export function canCraftImprove(slots) {
  const usedSlots = (slots || []).filter(Boolean);
  if (usedSlots.length !== 3) return false;
  const first = getItemById(usedSlots[0].itemId);
  if (!isEquipableItem(first)) return false;
  const rarity = getItemRarity(first);
  if (rarity === "unique") return false;
  return usedSlots.every((slot) => {
    const item = getItemById(slot.itemId);
    return item?.id === first.id;
  });
}

export function buildImproveResult(slots, rng) {
  if (!canCraftImprove(slots)) return null;
  const randomFn = toRandomFn(rng);
  const source = getItemById((slots || []).filter(Boolean)[0].itemId);
  if (!source) return null;
  const sourceRarity = getItemRarity(source);
  const targetRarity = sourceRarity === "common" ? "rare" : "unique";
  const candidates = getEquipableByRarity(targetRarity)
    .filter((item) => item.type === source.type && item.subtype === source.subtype);
  const rolled = pickRandom(candidates, randomFn);
  if (!rolled) return null;
  return {
    itemId: rolled.id,
    item: rolled,
    rarity: targetRarity,
    skill: getSkillInstanceForItem(rolled, rng),
  };
}

export function getReforgeRarity(slots) {
  const usedSlots = (slots || []).filter(Boolean);
  if (usedSlots.length !== 3) return null;
  const first = getItemById(usedSlots[0].itemId);
  if (!isEquipableItem(first)) return null;
  const firstRarity = getItemRarity(first);
  const same = usedSlots.every((slot) => {
    const item = getItemById(slot.itemId);
    return isEquipableItem(item) && getItemRarity(item) === firstRarity;
  });
  if (!same) return null;
  return firstRarity;
}

export function getReforgeCandidates(slots) {
  const rarity = getReforgeRarity(slots);
  if (!rarity) return [];
  return getEquipableByRarity(rarity)
    .sort((a, b) => {
      const byType = String(a.type || "").localeCompare(String(b.type || ""));
      if (byType !== 0) return byType;
      const bySubtype = String(a.subtype || "").localeCompare(String(b.subtype || ""));
      if (bySubtype !== 0) return bySubtype;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

export function canCraftReforge(slots, targetItemId) {
  if (!targetItemId) return false;
  const rarity = getReforgeRarity(slots);
  if (!rarity) return false;
  const target = getItemById(targetItemId);
  return isEquipableItem(target) && getItemRarity(target) === rarity;
}

export function buildReforgeResult(slots, targetItemId, rng) {
  if (!canCraftReforge(slots, targetItemId)) return null;
  const item = getItemById(targetItemId);
  if (!item) return null;
  return {
    itemId: item.id,
    item,
    rarity: getItemRarity(item),
    skill: getSkillInstanceForItem(item, rng),
  };
}

export function describeAnvilMode(mode) {
  if (mode === "recycle") return "Сложи 3 экипируемых предмета. На выходе будет случайный предмет по сумме шансов.";
  if (mode === "improve") return "Сложи 3 одинаковых предмета. На выходе — такой же тип и подтип, но редкость выше.";
  if (mode === "reforge") return "Сложи 3 предмета одной редкости и выбери любой предмет той же редкости.";
  return "";
}

export function getRarityBadgeClass(rarity) {
  const score = rarityScore(rarity);
  if (score >= 3) return "item-rarity-unique";
  if (score === 2) return "item-rarity-rare";
  return "item-rarity-common";
}
