import { buildDerivedStats, roundStat } from "./rules.js?v=0.4.4-pre-alpha";
import { getCoreSkillDefs } from "./skills.js?v=0.4.4-pre-alpha";

export const PROGRESSION_CONFIG = {
  baseXpToNext: 25,
  xpGrowthFactor: 1.25,
  pointsPerLevel: 1,
};

export const PRE_GAME_STAT_POINTS = 10;

export function createInitialPreGameStats() {
  return { STR: 0, INT: 0, AGI: 0, LUK: 0 };
}

export function createInitialState() {
  return {
    screen: "welcome",
    preGameStats: createInitialPreGameStats(),
    preGamePointsRemaining: PRE_GAME_STAT_POINTS,
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
      trapTargeting: null,
      pathHoverCell: null,
      pathPreviewCells: [],
      pathLockedCells: [],
      pathLockedTarget: null,
      autoMoveActive: false,
      autoMoveLastHp: null,
      skillsPanelOpen: false,
      helpOpen: false,
      levelUpPulseUntil: 0,
    },
  };
}

export function createPlayerSheet(preGameStats) {
  const alloc = preGameStats || createInitialPreGameStats();
  const stats = {
    STR: alloc.STR,
    INT: alloc.INT,
    AGI: alloc.AGI,
    LUK: alloc.LUK,
    VISION: 6,
    HP: 1,
  };

  const derived = buildDerivedStats(stats, null);
  const coreSkills = getCoreSkillDefs();
  const skills = {};
  for (const skill of coreSkills) {
    skills[skill.id] = { learned: false, level: 0 };
  }

  const manaMax = roundStat(30 + (stats.INT || 0) * 6);

  return {
    baseStats: { ...stats },
    stats: { ...stats },
    derived,
    bonusHpMaxFromEffects: 0,
    loadout: [],
    inventory: [],
    level: 1,
    xp: 0,
    xpToNext: PROGRESSION_CONFIG.baseXpToNext,
    unspentPoints: 0,
    mana: manaMax,
    manaMax,
    skillPoints: 0,
    skills,
    effectStacks: {
      hp_max_plus_5: 0,
      hp_max_plus_4: 0,
      hp_max_plus_1: 0,
    },
  };
}
