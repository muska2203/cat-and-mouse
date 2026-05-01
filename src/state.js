import { buildDerivedStats } from "./rules.js?v=0.3.3-pre-alpha";
import { CLASS_START_MANA } from "./skills.js?v=0.3.3-pre-alpha";
import { getSkillsForClass } from "./skills.js?v=0.3.3-pre-alpha";

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
      STR: 2,
      INT: 7,
      AGI: 4,
      LUK: 3,
      VISION: 6,
      baseHP: 56,
      HP_MAX: 56,
      HP: 56,
    },
  },
  warrior: {
    id: "warrior",
    label: "Воин",
    description: "Надежный боец для прямых столкновений.",
    baseStats: {
      STR: 7,
      INT: 2,
      AGI: 4,
      LUK: 3,
      VISION: 6,
      baseHP: 56,
      HP_MAX: 56,
      HP: 56,
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
      manaVisual: null,
      upgradePreviewStat: null,
      equipPreviewBagInstanceId: null,
      lastBagActionInstanceId: null,
      lastBagActionAtMs: 0,
      quickbarSlots: Array.from({ length: 9 }, () => null),
      quickbarPulseSlot: null,
      dragPayload: null,
      skillTargeting: null,
      skillsPanelOpen: false,
      helpOpen: false,
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
  const startMana = CLASS_START_MANA[classData.id] || 0;
  const classSkills = getSkillsForClass(classData.id);
  const skills = {};
  for (const skill of classSkills) {
    skills[skill.id] = { learned: false, level: 0 };
  }

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
    mana: startMana,
    manaMax: startMana,
    skillPoints: 0,
    skills,
    effectStacks: {
      hard_cheese: 0,
      common_cracker: 0,
      rare_royal_cheese: 0,
    },
  };
}
