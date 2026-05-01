import { buildDerivedStats } from "./rules.js?v=0.3.1-pre-alpha";

export const EQUIP_TYPES = ["weapon", "armor", "amulet"];
export const DEFAULT_STARTER_LOADOUT_BY_CLASS = {
  warrior: [],
  mage: [],
};

export const LOOT_COMMON_ITEMS = [
  {
    id: "common_splinter_blade",
    name: "Щепочный клинок",
    type: "weapon",
    icon: "🗡",
    effectText: "+2 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 2 },
  },
  {
    id: "common_school_wand",
    name: "Школьная палочка",
    type: "weapon",
    icon: "🪄",
    effectText: "+2 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 2 },
  },
  {
    id: "common_tin_plate",
    name: "Жестяная пластина",
    type: "armor",
    icon: "🛡",
    effectText: "+2 HP_MAX, +1 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 2, STR: 1 },
  },
  {
    id: "common_patch_cloak",
    name: "Лоскутный плащ",
    type: "armor",
    icon: "🧥",
    effectText: "+2 HP_MAX, +1 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 2, INT: 1 },
  },
  {
    id: "common_knotted_fang",
    name: "Узелок с клыком",
    type: "amulet",
    icon: "🦷",
    effectText: "+1 STR, +1 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 1, AGI: 1 },
  },
  {
    id: "common_glass_bead",
    name: "Стеклянная бусина",
    type: "amulet",
    icon: "🔹",
    effectText: "+1 INT, +1 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 1, LUK: 1 },
  },
  {
    id: "common_crumb_ration",
    name: "Крошечный паек",
    type: "consumable",
    icon: "🍞",
    effectText: "Восстанавливает 10 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_mint_drop",
    name: "Мятная капля",
    type: "consumable",
    icon: "🧊",
    effectText: "Восстанавливает 10 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_warm_milk",
    name: "Теплое молоко",
    type: "consumable",
    icon: "🥛",
    effectText: "Восстанавливает 6 HP и 6 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_sharp_pepper",
    name: "Острая перчинка",
    type: "consumable",
    icon: "🌶",
    effectText: "Следующая атака x1.5",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
];

export const LOOT_RARE_ITEMS = [
  {
    id: "rare_fang_saber",
    name: "Сабля клыка",
    type: "weapon",
    icon: "⚔",
    effectText: "+4 STR, +1 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 4, AGI: 1 },
  },
  {
    id: "rare_ember_orb",
    name: "Угольный фокус",
    type: "weapon",
    icon: "🔮",
    effectText: "+4 INT, +1 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 4, LUK: 1 },
  },
  {
    id: "rare_bastion_shell",
    name: "Панцирь бастиона",
    type: "armor",
    icon: "🦺",
    effectText: "+5 HP_MAX, +2 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 5, STR: 2 },
  },
  {
    id: "rare_sage_coat",
    name: "Одеяние мудреца",
    type: "armor",
    icon: "🥋",
    effectText: "+5 HP_MAX, +2 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 5, INT: 2 },
  },
  {
    id: "rare_predator_totem",
    name: "Тотем хищника",
    type: "amulet",
    icon: "🧿",
    effectText: "+2 STR, +2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 2, AGI: 2 },
  },
  {
    id: "rare_astrolabe_charm",
    name: "Астролябия",
    type: "amulet",
    icon: "✨",
    effectText: "+2 INT, +2 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 2, LUK: 2 },
  },
  {
    id: "rare_hearty_stew",
    name: "Сытное рагу",
    type: "consumable",
    icon: "🍲",
    effectText: "Восстанавливает 18 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_focus_tonic",
    name: "Тоник концентрации",
    type: "consumable",
    icon: "🧴",
    effectText: "Восстанавливает 16 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_dual_elixir",
    name: "Двойной эликсир",
    type: "consumable",
    icon: "🥤",
    effectText: "Восстанавливает 12 HP и 12 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_battle_pepper",
    name: "Боевой перец",
    type: "consumable",
    icon: "🌶",
    effectText: "Следующая атака x2",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
];

export const LOOT_UNIQUE_ITEMS = [
  {
    id: "unique_kingbreaker",
    name: "Королелом",
    type: "weapon",
    icon: "🗡",
    effectText: "+6 STR, +2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 6, AGI: 2 },
  },
  {
    id: "unique_star_scepter",
    name: "Звездный скипетр",
    type: "weapon",
    icon: "🌟",
    effectText: "+6 INT, +2 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 6, LUK: 2 },
  },
  {
    id: "unique_titan_carapace",
    name: "Панцирь титана",
    type: "armor",
    icon: "🛡",
    effectText: "+8 HP_MAX, +3 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 8, STR: 3 },
  },
  {
    id: "unique_oracle_robe",
    name: "Риза оракула",
    type: "armor",
    icon: "🧥",
    effectText: "+8 HP_MAX, +3 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 8, INT: 3 },
  },
  {
    id: "unique_war_sigil",
    name: "Печать битвы",
    type: "amulet",
    icon: "🔺",
    effectText: "+3 STR, +2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 3, AGI: 2 },
  },
  {
    id: "unique_mind_sigil",
    name: "Печать разума",
    type: "amulet",
    icon: "🔷",
    effectText: "+3 INT, +2 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 3, LUK: 2 },
  },
  {
    id: "unique_phoenix_broth",
    name: "Отвар феникса",
    type: "consumable",
    icon: "🔥",
    effectText: "Восстанавливает 28 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "unique_aether_draught",
    name: "Эфирный настой",
    type: "consumable",
    icon: "💧",
    effectText: "Восстанавливает 24 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "unique_twilight_mix",
    name: "Сумеречный микс",
    type: "consumable",
    icon: "🍷",
    effectText: "Восстанавливает 20 HP и 20 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "unique_storm_pepper",
    name: "Грозовой перец",
    type: "consumable",
    icon: "🌩",
    effectText: "Следующая атака x2.5",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
];

const ALL_ITEMS = [...LOOT_COMMON_ITEMS, ...LOOT_RARE_ITEMS, ...LOOT_UNIQUE_ITEMS];
let bagInstanceSeq = 0;

export function getStarterItemsForClass(classId) {
  return LOOT_COMMON_ITEMS.filter((item) => item.classRestriction.includes(classId));
}

export function getDefaultStarterLoadout(classId) {
  return [...(DEFAULT_STARTER_LOADOUT_BY_CLASS[classId] || [])];
}

export function getItemById(itemId) {
  return ALL_ITEMS.find((item) => item.id === itemId) || null;
}

export function chooseLoadoutItem(currentLoadoutIds, itemToToggleId, classId) {
  const allowedItems = getStarterItemsForClass(classId);
  const selected = new Set(
    currentLoadoutIds.filter((id) => allowedItems.some((item) => item.id === id))
  );

  if (selected.has(itemToToggleId)) {
    selected.delete(itemToToggleId);
    return Array.from(selected);
  }

  const nextItem = allowedItems.find((item) => item.id === itemToToggleId);
  if (!nextItem) {
    return Array.from(selected);
  }

  for (const pickedId of Array.from(selected)) {
    const picked = allowedItems.find((item) => item.id === pickedId);
    if (picked && picked.type === nextItem.type) {
      selected.delete(pickedId);
    }
  }

  selected.add(itemToToggleId);
  return Array.from(selected);
}

export function applyLoadoutToSheet(playerSheet, selectedItemIds) {
  const selectedItems = ALL_ITEMS.filter((item) => selectedItemIds.includes(item.id));
  const equippedByType = buildEquippedMap(selectedItems.filter((item) => !item.isConsumable));
  const selectedConsumables = selectedItems
    .filter((item) => item.isConsumable)
    .map((item) => createBagEntry(item.id));
  return recalculateSheetFromInventory(playerSheet, equippedByType, selectedConsumables);
}

export function recalculateSheetFromInventory(playerSheet, equippedByType, bag) {
  const baseStats = { ...playerSheet.baseStats };
  const previousHp = playerSheet?.stats?.HP ?? baseStats.HP ?? 0;
  const previousHpMax = playerSheet?.stats?.HP_MAX ?? baseStats.HP_MAX;
  const equippedIds = Object.values(equippedByType).filter(Boolean);
  const equipped = equippedIds.map((id) => getItemById(id)).filter(Boolean);

  for (const item of equipped) {
    if (item.isConsumable) {
      continue;
    }

    for (const [statName, bonus] of Object.entries(item.statBonuses)) {
      baseStats[statName] = (baseStats[statName] || 0) + bonus;
    }
  }

  const hpCap = baseStats.HP_MAX;
  const desiredHpFromBase = baseStats.HP ?? previousHp;
  const hasExplicitHpUpdate = desiredHpFromBase !== previousHp;
  const previousHpRatio = previousHpMax > 0 ? previousHp / previousHpMax : 0;
  const scaledHp = Math.round(previousHpRatio * hpCap);
  const nextHp = hasExplicitHpUpdate ? desiredHpFromBase : scaledHp;
  baseStats.HP = Math.max(0, Math.min(nextHp, hpCap));

  return {
    ...playerSheet,
    stats: baseStats,
    derived: buildDerivedStats(baseStats),
    loadout: equipped,
    equippedByType: buildEquippedMap(equipped),
    inventory: equipped.filter((item) => item.isConsumable),
    bag: normalizeBagEntries(bag),
  };
}

export function initializeInventoryForRun(playerSheet) {
  const equippedMap = { ...playerSheet.equippedByType };

  return {
    ...playerSheet,
    bag: normalizeBagEntries(playerSheet.bag || []),
    equippedByType: equippedMap,
  };
}

export function swapItemFromBag(playerSheet, bagInstanceId, bagIndex = null) {
  const bag = playerSheet?.bag || [];
  const indexFromInstance = bag.findIndex((entry) => entry.instanceId === bagInstanceId);
  const resolvedIndex =
    indexFromInstance !== -1
      ? indexFromInstance
      : Number.isInteger(bagIndex) && bagIndex >= 0 && bagIndex < bag.length
        ? bagIndex
        : -1;
  const resolvedItemId = resolvedIndex !== -1 ? bag[resolvedIndex]?.itemId : null;
  const item = getItemById(resolvedItemId);
  if (!item || item.isConsumable || resolvedIndex === -1) {
    return playerSheet;
  }

  const equippedByType = { ...playerSheet.equippedByType };
  const currentEquippedId = equippedByType[item.type] || null;
  equippedByType[item.type] = item.id;

  const nextBag = [...bag];
  nextBag.splice(resolvedIndex, 1);
  if (currentEquippedId) {
    nextBag.push(createBagEntry(currentEquippedId));
  }

  const equippedIds = Object.values(equippedByType).filter(Boolean);
  const recalculated = recalculateSheetFromInventory(playerSheet, equippedByType, nextBag);

  return {
    ...recalculated,
  };
}

export function addLootItemToPlayer(playerSheet, itemId) {
  const item = getItemById(itemId);
  if (!item || !item.classRestriction.includes(playerSheet.classId)) {
    return { playerSheet, addedTo: "none" };
  }

  const equippedByType = { ...playerSheet.equippedByType };
  const bag = normalizeBagEntries(playerSheet.bag || []);
  if (item.isConsumable) {
    bag.push(createBagEntry(item.id));
    return {
      playerSheet: recalculateSheetFromInventory(playerSheet, equippedByType, bag),
      addedTo: "bag",
    };
  }

  const slotFree = !equippedByType[item.type];

  if (slotFree) {
    equippedByType[item.type] = item.id;
    return {
      playerSheet: recalculateSheetFromInventory(playerSheet, equippedByType, bag),
      addedTo: "equip",
    };
  }

  bag.push(createBagEntry(item.id));
  return {
    playerSheet: recalculateSheetFromInventory(playerSheet, equippedByType, bag),
    addedTo: "bag",
  };
}

export function spendLevelUpPoint(playerSheet, statKey) {
  if (!playerSheet || (playerSheet.unspentPoints || 0) <= 0) {
    return playerSheet;
  }

  const allowedStats = new Set(["STR", "INT", "AGI", "LUK", "HP_MAX"]);
  if (!allowedStats.has(statKey)) {
    return playerSheet;
  }

  const nextSheet = {
    ...playerSheet,
    baseStats: { ...playerSheet.baseStats },
    unspentPoints: Math.max(0, (playerSheet.unspentPoints || 0) - 1),
  };

  if (statKey === "HP_MAX") {
    nextSheet.baseStats.HP_MAX = (nextSheet.baseStats.HP_MAX || 0) + 3;
    nextSheet.baseStats.HP = (nextSheet.baseStats.HP || 0) + 3;
  } else {
    nextSheet.baseStats[statKey] = (nextSheet.baseStats[statKey] || 0) + 1;
  }

  return recalculateSheetFromInventory(
    nextSheet,
    nextSheet.equippedByType || {},
    nextSheet.bag || []
  );
}

export function getLootPool(poolName, classId) {
  const source =
    poolName === "unique"
      ? LOOT_UNIQUE_ITEMS
      : poolName === "rare"
        ? LOOT_RARE_ITEMS
        : LOOT_COMMON_ITEMS;
  return source.filter((item) => item.classRestriction.includes(classId));
}

function buildEquippedMap(items) {
  const map = {};
  for (const item of items) {
    if (item.isConsumable) {
      continue;
    }
    map[item.type] = item.id;
  }
  for (const type of EQUIP_TYPES) {
    if (!map[type]) {
      map[type] = null;
    }
  }
  return map;
}

function createBagEntry(itemId) {
  bagInstanceSeq += 1;
  return {
    instanceId: `bag_${bagInstanceSeq}`,
    itemId,
  };
}

function normalizeBagEntries(bag) {
  return (bag || []).map((entry) => {
    if (typeof entry === "string") {
      return createBagEntry(entry);
    }
    if (!entry || typeof entry !== "object") {
      return null;
    }
    if (!entry.instanceId) {
      return createBagEntry(entry.itemId);
    }
    return {
      instanceId: entry.instanceId,
      itemId: entry.itemId,
    };
  }).filter(Boolean);
}
