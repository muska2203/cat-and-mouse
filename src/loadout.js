import { buildDerivedStats } from "./rules.js?v=0.4.1-pre-alpha";

export const EQUIP_TYPES = ["weapon", "armor", "amulet"];
export const DEFAULT_STARTER_LOADOUT_BY_CLASS = {
  warrior: [],
  mage: [],
};

export const LOOT_COMMON_ITEMS = [
  {
    id: "common_splinter_blade",
    name: "Щепочный меч",
    type: "weapon",
    subtype: "sword",
    icon: "🗡",
    effectText: "+2 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 2 },
  },
  {
    id: "common_school_wand",
    name: "Посох клопа",
    type: "weapon",
    subtype: "staff",
    icon: "🪄",
    effectText: "+2 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 2 },
  },
  {
    id: "common_tin_plate",
    name: "Соломенная броня",
    type: "armor",
    subtype: "armor",
    icon: "🥋",
    effectText: "+2 HP_MAX, +1 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 2, STR: 1 },
  },
  {
    id: "common_patch_cloak",
    name: "Плащ из фольги",
    type: "armor",
    subtype: "cloak",
    icon: "👘",
    effectText: "+2 HP_MAX, +1 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 2, INT: 1 },
  },
  {
    id: "common_knotted_fang",
    name: "Зуб таракана",
    type: "amulet",
    subtype: "tooth",
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
    subtype: "bead",
    icon: "🧿",
    effectText: "+1 INT, +1 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 1, LUK: 1 },
  },
  {
    id: "common_crumb_ration",
    name: "Ломтик сыра",
    type: "consumable",
    subtype: "heal_hp",
    icon: "🧀",
    effectText: "Восстанавливает 10 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_mint_drop",
    name: "Капля мяты",
    type: "consumable",
    subtype: "heal_mana",
    icon: "💧",
    effectText: "Восстанавливает 10 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_warm_milk",
    name: "Капля молока",
    type: "consumable",
    subtype: "heal_hybrid",
    icon: "🧴",
    effectText: "Восстанавливает 6 HP и 6 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_sharp_pepper",
    name: "Острая перчинка",
    type: "consumable",
    subtype: "buff",
    icon: "🌶",
    effectText: "Следующая атака x1.5",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_mousetrap",
    name: "Мышеловка",
    type: "consumable",
    subtype: "trap",
    icon: "🪤",
    effectText: "Ставит ловушку: 8 урона и оглушение на 1 ход",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    isTrapItem: true,
    trapConfig: { trapType: "mousetrap", rarity: "common", damage: 8, stunTurns: 1 },
    statBonuses: {},
  },
  {
    id: "common_glue_trap",
    name: "Клейкая растяжка",
    type: "consumable",
    subtype: "trap",
    icon: "🕸",
    effectText: "Ставит ловушку: оглушение на 2 хода",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    isTrapItem: true,
    trapConfig: { trapType: "glue", rarity: "common", stunTurns: 2 },
    statBonuses: {},
  },
];

export const LOOT_RARE_ITEMS = [
  {
    id: "rare_fang_saber",
    name: "Клыкастый меч",
    type: "weapon",
    subtype: "sword",
    icon: "🗡",
    effectText: "+4 STR, +1 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 4, AGI: 1 },
  },
  {
    id: "rare_ember_orb",
    name: "Угольный посох",
    type: "weapon",
    subtype: "staff",
    icon: "🪄",
    effectText: "+4 INT, +1 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 4, LUK: 1 },
  },
  {
    id: "rare_bastion_shell",
    name: "Пластилиновая броня",
    type: "armor",
    subtype: "armor",
    icon: "🥋",
    effectText: "+5 HP_MAX, +2 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 5, STR: 2 },
  },
  {
    id: "rare_sage_coat",
    name: "Плащ ученика",
    type: "armor",
    subtype: "cloak",
    icon: "👘",
    effectText: "+5 HP_MAX, +2 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 5, INT: 2 },
  },
  {
    id: "rare_predator_totem",
    name: "Клык хомяка",
    type: "amulet",
    subtype: "tooth",
    icon: "🦷",
    effectText: "+2 STR, +2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 2, AGI: 2 },
  },
  {
    id: "rare_astrolabe_charm",
    name: "Кристальная бусина",
    type: "amulet",
    subtype: "bead",
    icon: "🧿",
    effectText: "+2 INT, +2 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 2, LUK: 2 },
  },
  {
    id: "rare_hearty_stew",
    name: "Кусок сыра",
    type: "consumable",
    subtype: "heal_hp",
    icon: "🧀",
    effectText: "Восстанавливает 18 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_focus_tonic",
    name: "Настойка мяты",
    type: "consumable",
    subtype: "heal_mana",
    icon: "💧",
    effectText: "Восстанавливает 16 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_dual_elixir",
    name: "Крышка молока",
    type: "consumable",
    subtype: "heal_hybrid",
    icon: "🧴",
    effectText: "Восстанавливает 12 HP и 12 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_battle_pepper",
    name: "Боевой перец",
    type: "consumable",
    subtype: "buff",
    icon: "🌶",
    effectText: "Следующая атака x2",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_venom_trap",
    name: "Ядовитая мина",
    type: "consumable",
    subtype: "trap",
    icon: "☣",
    effectText: "Ставит мину: 4 урона + ядовитый туман 3x3",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    isTrapItem: true,
    trapConfig: {
      trapType: "venom_mine",
      rarity: "rare",
      damage: 4,
      spawnPoisonCloud: true,
      cloudDurationTurns: 3,
      cloudDamage: 2,
      cloudPoisonTurns: 2,
      cloudPoisonDamage: 2,
    },
    statBonuses: {},
  },
];

export const LOOT_UNIQUE_ITEMS = [
  {
    id: "unique_kingbreaker",
    name: "Королевский меч",
    type: "weapon",
    subtype: "sword",
    icon: "🗡",
    effectText: "+6 STR, +2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 6, AGI: 2 },
  },
  {
    id: "unique_star_scepter",
    name: "Звездный посох",
    type: "weapon",
    subtype: "staff",
    icon: "🪄",
    effectText: "+6 INT, +2 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 6, LUK: 2 },
  },
  {
    id: "unique_titan_carapace",
    name: "Броня из костей",
    type: "armor",
    subtype: "armor",
    icon: "🥋",
    effectText: "+8 HP_MAX, +3 STR",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 8, STR: 3 },
  },
  {
    id: "unique_oracle_robe",
    name: "Плащ мудреца",
    type: "armor",
    subtype: "cloak",
    icon: "👘",
    effectText: "+8 HP_MAX, +3 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 8, INT: 3 },
  },
  {
    id: "unique_war_sigil",
    name: "Коренной зуб белки",
    type: "amulet",
    subtype: "tooth",
    icon: "🦷",
    effectText: "+3 STR, +2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 3, AGI: 2 },
  },
  {
    id: "unique_mind_sigil",
    name: "Жемчужная бусина",
    type: "amulet",
    subtype: "bead",
    icon: "🧿",
    effectText: "+3 INT, +2 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 3, LUK: 2 },
  },
  {
    id: "unique_phoenix_broth",
    name: "Головка сыра",
    type: "consumable",
    subtype: "heal_hp",
    icon: "🧀",
    effectText: "Восстанавливает 28 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "unique_aether_draught",
    name: "Эликсир мяты",
    type: "consumable",
    subtype: "heal_mana",
    icon: "💧",
    effectText: "Восстанавливает 24 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "unique_twilight_mix",
    name: "Бурдюк молока",
    type: "consumable",
    subtype: "heal_hybrid",
    icon: "🧴",
    effectText: "Восстанавливает 20 HP и 20 маны",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "unique_storm_pepper",
    name: "Грозовой перец",
    type: "consumable",
    subtype: "buff",
    icon: "🌶",
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

export function getAllItemsForClass(classId) {
  if (classId === "admin") {
    return [...ALL_ITEMS];
  }
  return ALL_ITEMS.filter((item) => {
    if (!classId) {
      return true;
    }
    return Array.isArray(item.classRestriction) && item.classRestriction.includes(classId);
  });
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
