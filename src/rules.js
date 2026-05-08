import { randomFloat } from "./game/rng.js?v=0.5.4-pre-alpha";

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

/** Округление расчётных значений характеристик до 2 знаков после запятой */
export function roundStat(value) {
  return Math.round(Number(value) * 100) / 100;
}

/** Текущее HP: целое вниз, не ниже 0. */
export function floorHp(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

/** HP_MAX из формул: целое вниз, минимум 1. */
export function floorHpMax(value) {
  return Math.max(1, Math.floor(Number(value) || 0));
}

export function getDefaultUnarmedWeaponProfile() {
  return {
    weaponDamage: roundStat(0),
    weaponCritChance: roundStat(5),
    weaponCritMult: roundStat(1.5),
  };
}

export function getWeaponCombatProfile(weaponItem) {
  if (!weaponItem || weaponItem.type !== "weapon") {
    return getDefaultUnarmedWeaponProfile();
  }
  const fallback = getDefaultUnarmedWeaponProfile();
  return {
    weaponDamage: roundStat(weaponItem.weaponDamage ?? fallback.weaponDamage),
    weaponCritChance: roundStat(weaponItem.weaponCritChance ?? fallback.weaponCritChance),
    weaponCritMult: roundStat(weaponItem.weaponCritMult ?? fallback.weaponCritMult),
  };
}

export function buildDerivedStats(stats, weaponItem) {
  const profile = getWeaponCombatProfile(weaponItem);

  const str = stats.STR || 0;
  const intStat = stats.INT || 0;
  const agi = stats.AGI || 0;
  const luk = stats.LUK || 0;

  const atkPhys = roundStat(str * 1.5 + agi * 0.4);
  const atkMagic = roundStat(intStat * 1.5 + luk * 0.4);

  const critChance = roundStat(
    clamp(profile.weaponCritChance + agi * 0.8 + luk * 0.4, 0, 75),
  );
  const critMult = roundStat(profile.weaponCritMult + agi * 0.02 + str * 0.03);

  const computedHpMax = stats.HP_MAX;

  return {
    HP_MAX_COMPUTED: computedHpMax,
    ATK_PHYS: atkPhys,
    ATK_MAGIC: atkMagic,
    CRIT_CHANCE: critChance,
    CRIT_MULT: critMult,
    WEAPON_DAMAGE: roundStat(profile.weaponDamage),
  };
}

const WEAPON_DAMAGE_CALCULATORS = {
  sword: (baseDamage, stats) => {
    const str = stats?.STR ?? 0;
    const agi = stats?.AGI ?? 0;
    return baseDamage * (1 + str / 20) + (agi * 0.3);
  },
  staff: (baseDamage, stats) => {
    const str = stats?.STR ?? 0;
    const intStat = stats?.INT ?? 0;
    return baseDamage * (1 + (str / 20) * 0.7) + (intStat * 0.35);
  },
  unarmed: (baseDamage, stats) => {
    const str = stats?.STR ?? 0;
    return baseDamage + str / 3;
  }
};

export function getWeaponDamageFormulaText(weaponItem) {
  const subtype = weaponItem?.subtype || "unarmed";
  if (subtype === "sword") {
    return "База × (1 + СИЛ / 20) + ЛВК × 0.3";
  }
  if (subtype === "staff") {
    return "База × (1 + СИЛ / 20 × 0.7) + ИНТ × 0.35";
  }
  return "База + СИЛ / 3";
}

export function calculateWeaponDamage(weaponItem, stats) {
  const subtype = weaponItem?.subtype || "unarmed";
  const baseDamage = weaponItem?.weaponDamage ?? getDefaultUnarmedWeaponProfile().weaponDamage;
  
  const calculator = WEAPON_DAMAGE_CALCULATORS[subtype] || WEAPON_DAMAGE_CALCULATORS.unarmed;
  
  return Math.max(1, Math.floor(roundStat(calculator(baseDamage, stats))));
}

export function computeBasicMeleeDamage(playerSheet, runNextHitMult = 1, rng = null) {
  const weaponItem = playerSheet?.loadout?.find(item => item.type === "weapon");
  const stats = playerSheet?.stats || {};
  
  const base = calculateWeaponDamage(weaponItem, stats);

  const critChance = clamp(playerSheet?.derived?.CRIT_CHANCE ?? 0, 0, 100);
  const critMult = Math.max(1, roundStat(playerSheet?.derived?.CRIT_MULT ?? 1));
  const isCrit = randomFloat(rng) * 100 < critChance;
  const totalMultiplier = (runNextHitMult || 1) * (isCrit ? critMult : 1);
  const damage = Math.max(1, Math.floor(base * totalMultiplier));
  return { damage, isCrit, baseBeforeCrit: base };
}
