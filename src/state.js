import { buildDerivedStats } from "./rules.js?v=0.1.0-pre-alpha";

export const PROGRESSION_CONFIG = {
  baseXpToNext: 25,
  xpGrowthFactor: 1.25,
  pointsPerLevel: 1,
};

export const CLASS_CONFIG = {
  mage: {
    id: "mage",
    label: "Маг",
    description: "Хитрый тактик с акцентом на эффекты и контроль.",
    baseStats: {
      STR: 3,
      INT: 9,
      AGI: 6,
      LUK: 5,
      VISION: 2,
      baseHP: 24,
      HP_MAX: 24,
      HP: 24,
    },
  },
  warrior: {
    id: "warrior",
    label: "Воин",
    description: "Надежный боец для прямых столкновений.",
    baseStats: {
      STR: 8,
      INT: 2,
      AGI: 4,
      LUK: 4,
      VISION: 2,
      baseHP: 34,
      HP_MAX: 34,
      HP: 34,
    },
  },
};

export function createInitialState() {
  const defaultClassId = Object.keys(CLASS_CONFIG)[0] || null;
  return {
    screen: "welcome",
    selectedClassId: defaultClassId,
    playerSheet: null,
    starterLoadout: [],
    run: null,
    uiHud: {
      hpVisual: null,
      upgradePreviewStat: null,
      equipPreviewBagInstanceId: null,
      lastBagActionInstanceId: null,
      lastBagActionAtMs: 0,
    },
  };
}

export function createPlayerSheet(classId) {
  const classData = CLASS_CONFIG[classId];
  if (!classData) {
    return null;
  }

  const stats = { ...classData.baseStats };
  const derived = buildDerivedStats(stats);

  return {
    classId: classData.id,
    classLabel: classData.label,
    baseStats: { ...classData.baseStats },
    stats,
    derived,
    loadout: [],
    inventory: [],
    level: 1,
    xp: 0,
    xpToNext: PROGRESSION_CONFIG.baseXpToNext,
    unspentPoints: 0,
  };
}
