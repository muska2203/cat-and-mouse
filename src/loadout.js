import { buildDerivedStats, floorHp, floorHpMax, roundStat } from "./rules.js?v=0.5.5-pre-alpha";
import { normalizeSkillInstanceData } from "./skillsRuntime.js?v=0.5.5-pre-alpha";

export const EQUIP_TYPES = ["weapon", "armor", "amulet"];
export const STARTER_LOADOUT_MAX = 3;

export const LOOT_COMMON_ITEMS = [
  {
    id: "common_splinter_blade",
    name: "Щепочный меч",
    type: "weapon",
    subtype: "sword",
    icon: "🗡",
    effectText: "Базовый урон и крит — на карточке",
    description: "Щепки летят, враг удивляется.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: {},
    weaponDamage: 4,
    weaponCritChance: 10,
    weaponCritMult: 1.5,
  },
  {
    id: "common_school_wand",
    name: "Посох клопа",
    type: "weapon",
    subtype: "staff",
    icon: "🪄",
    effectText: "Базовый урон и крит — на карточке",
    description: "Колдует на троечку, но старается.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: {},
    weaponDamage: 2,
    weaponCritChance: 1,
    weaponCritMult: 1.1,
  },
  {
    id: "common_tin_plate",
    name: "Соломенная броня",
    type: "armor",
    subtype: "armor",
    icon: "🥋",
    effectText: "+1 СИЛ",
    description: "Солома внутри, уверенность снаружи.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 1 },
  },
  {
    id: "common_patch_cloak",
    name: "Плащ из фольги",
    type: "armor",
    subtype: "cloak",
    icon: "👘",
    effectText: "+1 ИНТ",
    description: "Шуршит как пакет, думает как мудрец.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 1 },
  },
  {
    id: "common_knotted_fang",
    name: "Зуб таракана",
    type: "amulet",
    subtype: "tooth",
    icon: "🦷",
    effectText: "+1 STR, +1 AGI",
    description: "Носи зуб — кусай судьбу первым.",
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
    description: "Бусина знает, где лежит удача.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 1, LUK: 1 },
  },
  {
    id: "common_hp_recover_10",
    name: "Ломтик сыра",
    type: "consumable",
    subtype: "heal_hp",
    icon: "🧀",
    effectText: "Восстанавливает 50% HP МАКС",
    description: "Маленький сыр, большое утешение.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_mana_recover_10",
    name: "Капля мяты",
    type: "consumable",
    subtype: "heal_mana",
    icon: "💧",
    effectText: "Восстанавливает 50% маны МАКС",
    description: "Глоток мяты и мысли снова бегут.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_hp_mana_recover_6",
    name: "Капля молока",
    type: "consumable",
    subtype: "heal_hybrid",
    icon: "🧴",
    effectText: "Восстанавливает 30% HP МАКС и 30% маны МАКС",
    description: "Молоко: и телу, и магии по чуть-чуть.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_next_hit_mult_1_5",
    name: "Острая перчинка",
    type: "consumable",
    subtype: "buff",
    icon: "🌶",
    effectText: "Следующая атака x1.5",
    description: "Щепотка перца, тонна самоуверенности.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "common_trap_damage_8_stun_1",
    name: "Мышеловка",
    type: "consumable",
    subtype: "trap",
    icon: "🪤",
    effectText: "Ставит ловушку: 4 урона и оглушение на 2 хода",
    description: "Классика: щелк — и тишина.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    isTrapItem: true,
    trapConfig: { trapType: "mousetrap", rarity: "common", damage: 4, stunTurns: 2 },
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
    effectText: "Базовый урон и крит — на карточке",
    description: "Клык острый, характер еще острее.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: {},
    weaponDamage: 7,
    weaponCritChance: 10,
    weaponCritMult: 1.5,
  },
  {
    id: "rare_ember_orb",
    name: "Угольный посох",
    type: "weapon",
    subtype: "staff",
    icon: "🪄",
    effectText: "Базовый урон и крит — на карточке",
    description: "Посох дымит, враги не возражают.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: {},
    weaponDamage: 3,
    weaponCritChance: 1,
    weaponCritMult: 1.1,
  },
  {
    id: "rare_bastion_shell",
    name: "Пластилиновая броня",
    type: "armor",
    subtype: "armor",
    icon: "🥋",
    effectText: "+2 СИЛ",
    description: "Пластилин мягкий, а ты почему-то крепче.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 2 },
  },
  {
    id: "rare_sage_coat",
    name: "Плащ ученика",
    type: "armor",
    subtype: "cloak",
    icon: "👘",
    effectText: "+2 ИНТ",
    description: "В этом плаще даже ошибки звучат умно.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 2 },
  },
  {
    id: "rare_predator_totem",
    name: "Клык хомяка",
    type: "amulet",
    subtype: "tooth",
    icon: "🦷",
    effectText: "+2 STR, +2 AGI",
    description: "Тотем хомяка: беги быстро, кусай больно.",
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
    description: "Кристалл блестит, план работает.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 2, LUK: 2 },
  },
  {
    id: "rare_next_hit_mult_2",
    name: "Боевой перец",
    type: "consumable",
    subtype: "buff",
    icon: "🌶",
    effectText: "Следующая атака x2",
    description: "Остро настолько, что даже крит краснеет.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
  {
    id: "rare_trap_poison_cloud",
    name: "Ядовитая мышеловка",
    type: "consumable",
    subtype: "trap",
    icon: "☣️",
    effectText:
      "Ставит ловушку: 4 урона, оглушение на 2 хода и ядовитый туман 3x3 (урон в тумане только пока стоишь на клетке в конце хода окружения)",
    description: "Небольшой хлопок и очень плохой воздух.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    isTrapItem: true,
    trapConfig: {
      trapType: "venom_mine",
      rarity: "rare",
      damage: 4,
      stunTurns: 2,
      spawnPoisonCloud: true,
      cloudDurationTurns: 3,
      cloudDamage: 2,
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
    effectText: "Базовый урон и крит — на карточке",
    description: "Меч для тех, кто спорит последним.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: {},
    weaponDamage: 10,
    weaponCritChance: 10,
    weaponCritMult: 1.5,
  },
  {
    id: "unique_star_scepter",
    name: "Звездный посох",
    type: "weapon",
    subtype: "staff",
    icon: "🪄",
    effectText: "Базовый урон и крит — на карточке",
    description: "Звезды шепчут: бей красиво.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: {},
    weaponDamage: 4,
    weaponCritChance: 1,
    weaponCritMult: 1.1,
  },
  {
    id: "unique_titan_carapace",
    name: "Броня из костей",
    type: "armor",
    subtype: "armor",
    icon: "🥋",
    effectText: "+3 СИЛ",
    description: "Кости снаружи, сталь в походке.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { STR: 3 },
  },
  {
    id: "unique_oracle_robe",
    name: "Плащ мудреца",
    type: "armor",
    subtype: "cloak",
    icon: "👘",
    effectText: "+3 ИНТ",
    description: "Плащ мудреца: плюс к мозгу, минус к сомнениям.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 3 },
  },
  {
    id: "unique_war_sigil",
    name: "Коренной зуб белки",
    type: "amulet",
    subtype: "tooth",
    icon: "🦷",
    effectText: "+3 STR, +2 AGI",
    description: "Белка одобряет твой боевой оскал.",
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
    description: "Жемчуг сияет, решения попадают в цель.",
    classRestriction: ["mage", "warrior"],
    isConsumable: false,
    statBonuses: { INT: 3, LUK: 2 },
  },
  {
    id: "unique_next_hit_mult_2_5",
    name: "Грозовой перец",
    type: "consumable",
    subtype: "buff",
    icon: "🌶",
    effectText: "Следующая атака x2.5",
    description: "Перец уровня 'не повторять дома'.",
    classRestriction: ["mage", "warrior"],
    isConsumable: true,
    statBonuses: {},
  },
];

const ALL_ITEMS = [...LOOT_COMMON_ITEMS, ...LOOT_RARE_ITEMS, ...LOOT_UNIQUE_ITEMS];
let bagInstanceSeq = 0;

export function getStarterCommonItems() {
  return [...LOOT_COMMON_ITEMS];
}

export function getItemById(itemId) {
  return ALL_ITEMS.find((item) => item.id === itemId) || null;
}

export function getAllLootItems() {
  return [...ALL_ITEMS];
}

export function chooseStarterLoadoutItem(currentLoadoutIds, itemToToggleId) {
  const allowedItems = getStarterCommonItems();
  const selected = new Set(
    currentLoadoutIds.filter((id) => allowedItems.some((item) => item.id === id)),
  );

  if (selected.has(itemToToggleId)) {
    // Повторный клик по уже выбранному предмету ничего не меняет:
    // на старте всегда должен оставаться выбранный предмет в слоте.
    return Array.from(selected);
  }

  const nextItem = allowedItems.find((item) => item.id === itemToToggleId);
  if (!nextItem) {
    return Array.from(selected);
  }

  let replacedSameType = false;
  const equipSlots = new Set(["weapon", "armor", "amulet"]);
  if (equipSlots.has(nextItem.type)) {
    for (const pickedId of Array.from(selected)) {
      const picked = allowedItems.find((item) => item.id === pickedId);
      if (picked && picked.type === nextItem.type) {
        selected.delete(pickedId);
        replacedSameType = true;
      }
    }
  }

  // Лимит проверяем только если это не замена существующего слота тем же типом.
  if (!replacedSameType && selected.size >= STARTER_LOADOUT_MAX) {
    return Array.from(selected);
  }

  selected.add(itemToToggleId);
  return Array.from(selected);
}

export function applyLoadoutToSheet(playerSheet, selectedItemIds) {
  const selectedItems = ALL_ITEMS.filter((item) => selectedItemIds.includes(item.id));
  const equippedByType = buildEquippedMap(selectedItems.filter((item) => !item.isConsumable));
  const equippedInstanceByType = buildEquippedInstanceMap(equippedByType, {});
  const itemInstances = normalizeItemInstances(
    playerSheet?.itemInstances || {},
    equippedByType,
    equippedInstanceByType,
    [],
  );
  const selectedConsumables = selectedItems
    .filter((item) => item.isConsumable)
    .map((item) => createBagEntry(item.id, itemInstances));
  return recalculateSheetFromInventory(
    { ...playerSheet, itemInstances },
    equippedByType,
    selectedConsumables,
    equippedInstanceByType,
  );
}

export function recalculateSheetFromInventory(playerSheet, equippedByType, bag, equippedInstanceByType = null) {
  const baseStats = { ...playerSheet.baseStats };
  const previousHp = floorHp(playerSheet?.stats?.HP ?? baseStats.HP ?? 0);
  const previousHpMax = floorHpMax(playerSheet?.stats?.HP_MAX ?? baseStats.HP_MAX ?? 1);
  const previousHpMissing = Math.max(0, previousHpMax - previousHp);
  const previousMana = Math.max(0, Math.round(Number(playerSheet?.mana ?? playerSheet?.manaMax ?? 0)));
  const previousManaMax = Math.max(1, Math.round(Number(playerSheet?.manaMax ?? 1)));
  const previousManaMissing = Math.max(0, previousManaMax - previousMana);
  const equippedIds = Object.values(equippedByType).filter(Boolean);
  const equipped = equippedIds.map((id) => getItemById(id)).filter(Boolean);

  for (const item of equipped) {
    if (item.isConsumable) {
      continue;
    }
    if (item.type === "weapon") {
      continue;
    }

    for (const [statName, bonus] of Object.entries(item.statBonuses || {})) {
      if (statName === "HP_MAX") {
        continue;
      }
      baseStats[statName] = (baseStats[statName] || 0) + bonus;
    }
  }

  const strTotal = baseStats.STR || 0;
  const intTotal = baseStats.INT || 0;
  const bonusHpMaxFromEffects = playerSheet.bonusHpMaxFromEffects || 0;
  baseStats.HP_MAX = floorHpMax(100 + strTotal * 8 * 0.7 + bonusHpMaxFromEffects);

  const hpCap = baseStats.HP_MAX;
  // При смене экипировки сохраняем "дефицит HP", чтобы избежать накопительной
  // потери из-за округления при повторных пересчётах туда-сюда.
  baseStats.HP = floorHp(Math.max(0, Math.min(hpCap, hpCap - previousHpMissing)));

  const weaponItem = equipped.find((item) => item.type === "weapon") || null;
  const derived = buildDerivedStats(baseStats, weaponItem);

  const manaMax = roundStat(30 + intTotal * 3);
  const manaCap = Math.max(1, Math.round(Number(manaMax || 1)));
  const nextMana = Math.max(0, Math.min(manaCap, manaCap - previousManaMissing));
  const normalizedEquippedInstances = buildEquippedInstanceMap(
    equippedByType,
    equippedInstanceByType || playerSheet.equippedInstanceByType || {},
  );
  const normalizedBag = normalizeBagEntries(bag, playerSheet?.itemInstances || {});
  const normalizedItemInstances = normalizeItemInstances(
    playerSheet?.itemInstances || {},
    equippedByType,
    normalizedEquippedInstances,
    normalizedBag,
  );

  return {
    ...playerSheet,
    stats: baseStats,
    derived,
    manaMax: manaCap,
    mana: nextMana,
    loadout: equipped,
    equippedByType: buildEquippedMap(equipped),
    equippedInstanceByType: normalizedEquippedInstances,
    itemInstances: normalizedItemInstances,
    inventory: equipped.filter((item) => item.isConsumable),
    bag: normalizedBag,
  };
}

export function initializeInventoryForRun(playerSheet) {
  const equippedMap = { ...playerSheet.equippedByType };
  const normalizedEquippedInstances = buildEquippedInstanceMap(
    equippedMap,
    playerSheet.equippedInstanceByType || {},
  );
  const normalizedBag = normalizeBagEntries(playerSheet.bag || [], playerSheet?.itemInstances || {});
  const normalizedItemInstances = normalizeItemInstances(
    playerSheet?.itemInstances || {},
    equippedMap,
    normalizedEquippedInstances,
    normalizedBag,
  );

  return {
    ...playerSheet,
    bag: normalizedBag,
    equippedByType: equippedMap,
    equippedInstanceByType: normalizedEquippedInstances,
    itemInstances: normalizedItemInstances,
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
  const equippedInstanceByType = {
    ...(playerSheet.equippedInstanceByType || {}),
  };
  const pickedBagEntry = bag[resolvedIndex] || null;
  const pickedInstanceId = pickedBagEntry?.instanceId || createItemInstanceId();
  const currentEquippedId = equippedByType[item.type] || null;
  const currentEquippedInstanceId = equippedInstanceByType[item.type] || null;
  equippedByType[item.type] = item.id;
  equippedInstanceByType[item.type] = pickedInstanceId;

  const nextBag = [...bag];
  nextBag.splice(resolvedIndex, 1);
  if (currentEquippedId) {
    nextBag.push({
      instanceId: currentEquippedInstanceId || createItemInstanceId(),
      itemId: currentEquippedId,
    });
  }

  const recalculated = recalculateSheetFromInventory(
    playerSheet,
    equippedByType,
    nextBag,
    equippedInstanceByType,
  );

  return {
    ...recalculated,
  };
}

export function addLootItemToPlayer(playerSheet, itemId) {
  const item = getItemById(itemId);
  if (!item) {
    return { playerSheet, addedTo: "none" };
  }

  const equippedByType = { ...playerSheet.equippedByType };
  const equippedInstanceByType = {
    ...(playerSheet.equippedInstanceByType || {}),
  };
  const itemInstances = { ...(playerSheet?.itemInstances || {}) };
  const bag = normalizeBagEntries(playerSheet.bag || [], itemInstances);
  if (item.isConsumable) {
    bag.push(createBagEntry(item.id, itemInstances));
    return {
      playerSheet: recalculateSheetFromInventory(
        { ...playerSheet, itemInstances },
        equippedByType,
        bag,
        equippedInstanceByType,
      ),
      addedTo: "bag",
    };
  }

  const slotFree = !equippedByType[item.type];

  if (slotFree) {
    equippedByType[item.type] = item.id;
    equippedInstanceByType[item.type] = createItemInstanceId();
    return {
      playerSheet: recalculateSheetFromInventory(
        playerSheet,
        equippedByType,
        bag,
        equippedInstanceByType,
      ),
      addedTo: "equip",
    };
  }

    bag.push(createBagEntry(item.id, itemInstances));
  return {
    playerSheet: recalculateSheetFromInventory(
        { ...playerSheet, itemInstances },
      equippedByType,
      bag,
      equippedInstanceByType,
    ),
    addedTo: "bag",
  };
}

export function createRuntimeItemInstance(playerSheet, itemId, preferredInstanceId = null, skillData = null) {
  const instanceId = preferredInstanceId || createItemInstanceId();
  const nextInstances = { ...(playerSheet?.itemInstances || {}) };
  const baseInstance = buildNormalizedItemInstance(
    skillData ? { skill: skillData } : null,
    instanceId,
    itemId,
  );
  if (skillData && baseInstance && typeof baseInstance === "object") {
    baseInstance.skill = skillData;
  }
  nextInstances[instanceId] = baseInstance;
  return {
    instanceId,
    itemInstances: nextInstances,
  };
}

export function restoreItemInstanceToBag(playerSheet, slotEntry) {
  if (!slotEntry?.instanceId || !slotEntry?.itemId) return playerSheet;
  const nextItemInstances = { ...(playerSheet?.itemInstances || {}) };
  nextItemInstances[slotEntry.instanceId] = slotEntry.instanceEntry
    ? { ...slotEntry.instanceEntry, instanceId: slotEntry.instanceId, itemId: slotEntry.itemId }
    : buildNormalizedItemInstance(null, slotEntry.instanceId, slotEntry.itemId);
  const nextBag = [...(playerSheet?.bag || [])];
  const nextEquippedByType = { ...(playerSheet?.equippedByType || {}) };
  const nextEquippedInstances = { ...(playerSheet?.equippedInstanceByType || {}) };
  const originType = String(slotEntry.originType || "");
  const canRestoreToEquip = (
    slotEntry.source === "equipped"
    && EQUIP_TYPES.includes(originType)
    && !nextEquippedByType[originType]
  );
  if (canRestoreToEquip) {
    nextEquippedByType[originType] = slotEntry.itemId;
    nextEquippedInstances[originType] = slotEntry.instanceId;
  } else {
    nextBag.push({ instanceId: slotEntry.instanceId, itemId: slotEntry.itemId });
  }
  return recalculateSheetFromInventory(
    { ...playerSheet, itemInstances: nextItemInstances },
    nextEquippedByType,
    nextBag,
    nextEquippedInstances,
  );
}

export function spendLevelUpPoint(playerSheet, statKey) {
  if (!playerSheet || (playerSheet.unspentPoints || 0) <= 0) {
    return playerSheet;
  }

  const allowedStats = new Set(["STR", "INT", "AGI", "LUK"]);
  if (!allowedStats.has(statKey)) {
    return playerSheet;
  }

  const nextSheet = {
    ...playerSheet,
    baseStats: { ...playerSheet.baseStats },
    unspentPoints: Math.max(0, (playerSheet.unspentPoints || 0) - 1),
  };

  nextSheet.baseStats[statKey] = (nextSheet.baseStats[statKey] || 0) + 1;

  return recalculateSheetFromInventory(
    nextSheet,
    nextSheet.equippedByType || {},
    nextSheet.bag || [],
  );
}

export function getLootPool(poolName) {
  const source =
    poolName === "unique"
      ? LOOT_UNIQUE_ITEMS
      : poolName === "rare"
        ? LOOT_RARE_ITEMS
        : LOOT_COMMON_ITEMS;
  return [...source];
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

function createBagEntry(itemId, itemInstances = {}) {
  const instanceId = createItemInstanceId();
  ensureItemInstanceData(itemInstances, instanceId, itemId);
  return {
    instanceId,
    itemId,
  };
}

function createItemInstanceId() {
  bagInstanceSeq += 1;
  return `item_${bagInstanceSeq}`;
}

function buildEquippedInstanceMap(equippedByType, sourceMap) {
  const map = {};
  for (const type of EQUIP_TYPES) {
    const equippedItemId = equippedByType?.[type] || null;
    if (!equippedItemId) {
      map[type] = null;
      continue;
    }
    const existingInstanceId = sourceMap?.[type] || null;
    map[type] = existingInstanceId || createItemInstanceId();
  }
  return map;
}

function normalizeBagEntries(bag, itemInstances = {}) {
  return (bag || []).map((entry) => {
    if (typeof entry === "string") {
      return createBagEntry(entry, itemInstances);
    }
    if (!entry || typeof entry !== "object") {
      return null;
    }
    if (!entry.instanceId) {
      return createBagEntry(entry.itemId, itemInstances);
    }
    ensureItemInstanceData(itemInstances, entry.instanceId, entry.itemId);
    return {
      instanceId: entry.instanceId,
      itemId: entry.itemId,
    };
  }).filter(Boolean);
}

function normalizeItemInstances(sourceInstances, equippedByType, equippedInstanceByType, bagEntries) {
  const next = {};
  for (const type of EQUIP_TYPES) {
    const itemId = equippedByType?.[type] || null;
    const instanceId = equippedInstanceByType?.[type] || null;
    if (!itemId || !instanceId) continue;
    const existing = sourceInstances?.[instanceId] || null;
    next[instanceId] = buildNormalizedItemInstance(existing, instanceId, itemId);
  }
  for (const entry of bagEntries || []) {
    const itemId = entry?.itemId || null;
    const instanceId = entry?.instanceId || null;
    if (!itemId || !instanceId) continue;
    const existing = sourceInstances?.[instanceId] || next[instanceId] || null;
    next[instanceId] = buildNormalizedItemInstance(existing, instanceId, itemId);
  }
  return next;
}

function ensureItemInstanceData(itemInstances, instanceId, itemId) {
  if (!instanceId || !itemId) return;
  if (itemInstances[instanceId]) return;
  itemInstances[instanceId] = buildNormalizedItemInstance(null, instanceId, itemId);
}

function buildNormalizedItemInstance(source, instanceId, itemId) {
  const item = getItemById(itemId);
  const base = source && typeof source === "object" ? source : {};
  const entry = {
    instanceId,
    itemId,
  };
  if (item?.type === "weapon" || item?.type === "armor" || item?.type === "amulet") {
    entry.skill = normalizeSkillInstanceData(item, base.skill || null);
  }
  return entry;
}
