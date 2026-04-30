import { buildDerivedStats } from "./rules.js?v=0.0.10-pre-alpha";

export const EQUIP_TYPES = ["weapon", "armor", "amulet"];
export const DEFAULT_STARTER_LOADOUT_BY_CLASS = {
  warrior: ["common_pan_lid", "cheese_ration"],
  mage: ["lucky_charm", "apprentice_staff"],
};

export const STARTER_ITEMS = [
  {
    id: "oak_wand",
    name: "Дубовая палочка",
    type: "weapon",
    effectText: "+3 INT, +1 LUK",
    classRestriction: ["mage"],
    isConsumable: false,
    statBonuses: { INT: 3, LUK: 1 },
  },
  {
    id: "apprentice_staff",
    name: "Посох ученика",
    type: "weapon",
    effectText: "+2 INT, +1 HP_MAX",
    classRestriction: ["mage"],
    isConsumable: false,
    statBonuses: { INT: 2, HP_MAX: 1 },
  },
  {
    id: "rusty_sword",
    name: "Ржавый меч",
    type: "weapon",
    effectText: "+3 STR",
    classRestriction: ["warrior"],
    isConsumable: false,
    statBonuses: { STR: 3 },
  },
  {
    id: "heavy_club",
    name: "Тяжелая дубинка",
    type: "weapon",
    effectText: "+2 STR, +1 HP_MAX",
    classRestriction: ["warrior"],
    isConsumable: false,
    statBonuses: { STR: 2, HP_MAX: 1 },
  },
  {
    id: "cloth_robe",
    name: "Тканевая мантия",
    type: "armor",
    effectText: "+4 HP_MAX",
    classRestriction: ["mage"],
    isConsumable: false,
    statBonuses: { HP_MAX: 4 },
  },
  {
    id: "leather_vest",
    name: "Кожаный жилет",
    type: "armor",
    effectText: "+2 HP_MAX, +1 AGI",
    classRestriction: ["warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 2, AGI: 1 },
  },
  {
    id: "lucky_charm",
    name: "Амулет удачи",
    type: "amulet",
    effectText: "+2 LUK",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { LUK: 2 },
  },
  {
    id: "mouse_boots",
    name: "Мышиные ботинки",
    type: "amulet",
    effectText: "+2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { AGI: 2 },
  },
  {
    id: "cheese_ration",
    name: "Сырный паек",
    type: "consumable",
    effectText: "Одноразовое лечение 10 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "hard_cheese",
    name: "Твердый сыр",
    type: "consumable",
    effectText: "+5 HP_MAX до конца забега",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "pepper_bomb",
    name: "Перцовая бомбочка",
    type: "consumable",
    effectText: "Наносит ближайшему коту 8 урона / оглушает на 1 ход",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "thread_bracelet",
    name: "Нитяной браслет",
    type: "amulet",
    effectText: "+1 STR, +1 INT",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 1, INT: 1 },
  },
];

export const LOOT_COMMON_ITEMS = [
  {
    id: "common_bone_dagger",
    name: "Костяной кинжал",
    type: "weapon",
    icon: "🗡",
    effectText: "+2 STR, +1 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 2, AGI: 1 },
  },
  {
    id: "common_splinter_wand",
    name: "Щепочная палочка",
    type: "weapon",
    icon: "🪄",
    effectText: "+3 INT",
    classRestriction: ["mage"],
    isConsumable: false,
    statBonuses: { INT: 3 },
  },
  {
    id: "common_pan_lid",
    name: "Крышка от сковороды",
    type: "armor",
    icon: "🛡",
    effectText: "+2 HP_MAX",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 2 },
  },
  {
    id: "common_kitchen_twine",
    name: "Кухонная бечевка",
    type: "amulet",
    icon: "🧵",
    effectText: "+2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { AGI: 2 },
  },
  {
    id: "common_cheese_slice",
    name: "Ломтик сыра",
    type: "consumable",
    icon: "🧀",
    effectText: "Лечит 10 HP",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_cracker",
    name: "Сухарик",
    type: "consumable",
    icon: "🥨",
    effectText: "+4 HP_MAX до конца забега",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
];

export const LOOT_RARE_ITEMS = [
  {
    id: "rare_moon_rapier",
    name: "Лунная рапира",
    type: "weapon",
    icon: "⚔",
    effectText: "+4 STR, +2 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 4, AGI: 2 },
  },
  {
    id: "rare_arcane_staff",
    name: "Тайный посох",
    type: "weapon",
    icon: "✨",
    effectText: "+5 INT, +1 LUK",
    classRestriction: ["mage"],
    isConsumable: false,
    statBonuses: { INT: 5, LUK: 1 },
  },
  {
    id: "rare_guard_harness",
    name: "Упряжь стража",
    type: "armor",
    icon: "🦺",
    effectText: "+12 HP_MAX",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { HP_MAX: 12 },
  },
  {
    id: "rare_whisker_charm",
    name: "Оберег усов",
    type: "amulet",
    icon: "🔮",
    effectText: "+3 LUK, +1 AGI",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { LUK: 3, AGI: 1 },
  },
  {
    id: "rare_royal_cheese",
    name: "Королевский сыр",
    type: "consumable",
    icon: "🧀",
    effectText: "Лечит 20 HP и +1 HP_MAX до конца забега",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_spice_vial",
    name: "Колба специй",
    type: "consumable",
    icon: "🧪",
    effectText: "Следующий удар мышки x2",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
];

const ALL_ITEMS = [...STARTER_ITEMS, ...LOOT_COMMON_ITEMS, ...LOOT_RARE_ITEMS];
let bagInstanceSeq = 0;

export function getStarterItemsForClass(classId) {
  return STARTER_ITEMS.filter((item) => item.classRestriction.includes(classId));
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
  const hpDeltaFromMaxChange = hpCap - previousHpMax;
  const desiredHpFromBase = baseStats.HP ?? previousHp;
  const hasExplicitHpUpdate = desiredHpFromBase !== previousHp;
  const nextHp = hasExplicitHpUpdate
    ? desiredHpFromBase
    : previousHp + hpDeltaFromMaxChange;
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
  const source = poolName === "rare" ? LOOT_RARE_ITEMS : LOOT_COMMON_ITEMS;
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
