import { createInitialState, createPlayerSheet } from "../../src/state.js";
import {
  STARTER_LOADOUT_MAX,
  applyLoadoutToSheet,
  chooseStarterLoadoutItem,
  getStarterCommonItems,
  getItemById,
  initializeInventoryForRun,
  swapItemFromBag,
  spendLevelUpPoint,
  recalculateSheetFromInventory,
} from "../../src/loadout.js";
import { createRunState, createNextLevelRun, tryStep, beginEnvironmentTurn, stepEnvironmentTurn, buildPathToDiscoveredCell } from "../../src/game.js";
import { drawRunToCanvas } from "../../src/render.js";
import { resolveMoveDirectionFromEvent } from "../../src/input/moveKeys.js";
import { resolveQuickbarSlotIndexFromKeyboardEvent } from "../../src/input/gameControls.js";
import { screenPointToGrid, isValidPathTargetCell } from "../../src/runtime/canvasGrid.js";
import { createCanvasRunHandlers } from "../../src/runtime/canvasRunHandlers.js";
import { startAnimationLoop } from "../../src/runtime/gameLoop.js";
import { normalizeFinishedAnimationsForRun, isBlockingMotionActive } from "../../src/runtime/motionTiming.js";
import { getEnemyById } from "../../src/game/enemies.js";
import { getCoreSkillDefs } from "../../src/skills.js";
import { useConsumable } from "../../src/game/consumables.js";
import { placeTrap } from "../../src/game/consumables.js";
import { getTrapPlacementCells } from "../../src/game/trapPlacement.js";
import { useSkillAtCell, getSkillTargetCells } from "../../src/game/runSkills.js";
import { applyXpGain } from "../../src/game/xp.js";
import { STRINGS_RU } from "../../src/strings/ru.js";
import { DEVLOG_ENTRIES } from "../../src/devlog.js";
import { createInventoryItemPopoverController } from "../../src/ui/inventoryPopover.js";
import { initAnalytics, trackEvent, createRunAnalyticsId } from "../../src/analytics.js";
import { APP_VERSION, GA4_MEASUREMENT_ID } from "../../src/app-config.js";
import { buildDerivedStats } from "../../src/rules.js";

const root = document.getElementById("app");

const PORTRAITS = [
  { id: "portrait_1", name: "Серый бродяга", fill: "%235c4834", desc: "Обычная полевая мышь. Никаких ярко выраженных преимуществ, но и никаких слабостей. Готов к любым испытаниям." },
  { id: "portrait_2", name: "Рыжий пройдоха", fill: "%23a45c30", desc: "Шустрый исследователь с азартом и любовью к риску." },
  { id: "portrait_3", name: "Белый аристократ", fill: "%23e8e8e8", desc: "Сдержанный стратег, полагается на точность и расчет." },
  { id: "portrait_4", name: "Черный ниндзя", fill: "%231a1a1a", desc: "Тихий охотник, привыкший действовать из тени." },
  { id: "portrait_5", name: "Мышь-ученый", fill: "%234a5c68", desc: "Любит эксперименты и нестандартные решения в бою." },
  { id: "portrait_6", name: "Толстяк", fill: "%238a7c64", desc: "Выносливый и упрямый: идет вперед, даже когда тяжело." },
];

const state = createInitialState();
state.selectedPortraitId = "portrait_1";
state.uiNewModal = null;
state.uiSkillChoice = null;
state.uiNewStartMessage = "";
state.screen = "welcome";
state.uiNewRunStartedAtMs = null;
state.uiNewLastCanvasClickAtMs = 0;
let uiNewResizeTimer = null;
let lastPointerClientX = null;
let lastPointerClientY = null;

initAnalytics({ measurementId: GA4_MEASUREMENT_ID, version: APP_VERSION });

const DIR_BY_DELTA = {
  "0:-1": "up",
  "0:1": "down",
  "-1:0": "left",
  "1:0": "right",
  "-1:-1": "up_left",
  "1:-1": "up_right",
  "-1:1": "down_left",
  "1:1": "down_right",
};

const SUBTYPE_SORT_ORDER_BY_TYPE = {
  weapon: ["sword", "staff"],
  armor: ["armor", "cloak"],
  amulet: ["tooth", "bead"],
  consumable: ["heal_hp", "heal_mana", "heal_hybrid", "buff", "trap"],
};

function getItemRarity(item) {
  const id = String(item?.id || "");
  if (id.startsWith("unique_")) return "unique";
  if (id.startsWith("rare_")) return "rare";
  return "common";
}

function getRaritySortWeight(item) {
  const rarity = getItemRarity(item);
  if (rarity === "unique") return 3;
  if (rarity === "rare") return 2;
  return 1;
}

function getSubtypeSortWeight(item) {
  const type = String(item?.type || "");
  const subtype = String(item?.subtype || "");
  const orderedSubtypes = SUBTYPE_SORT_ORDER_BY_TYPE[type];
  if (!Array.isArray(orderedSubtypes) || orderedSubtypes.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  const index = orderedSubtypes.indexOf(subtype);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function compareItemsByRarityThenId(a, b) {
  const bySubtype = getSubtypeSortWeight(a) - getSubtypeSortWeight(b);
  if (bySubtype !== 0) return bySubtype;
  const byRarity = getRaritySortWeight(b) - getRaritySortWeight(a);
  if (byRarity !== 0) return byRarity;
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

function toRuStatName(statName) {
  if (statName === "STR") return "СИЛ";
  if (statName === "INT") return "ИНТ";
  if (statName === "AGI") return "ЛВК";
  if (statName === "LUK") return "УДЧ";
  if (statName === "HP_MAX") return "HP МАКС";
  if (statName === "CRIT_CHANCE") return "ШАНС КРИТА";
  if (statName === "CRIT_MULT") return "МНОЖИТЕЛЬ КРИТА";
  return statName;
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatItemStatBonusesDetailSection(item) {
  const entries = Object.entries(item.statBonuses || {});
  if (entries.length === 0) return "";
  const lis = entries
    .map(([statName, value]) => {
      const label = toRuStatName(statName);
      const sign = value > 0 ? "+" : "";
      return `<li>${sign}${escapeHtml(String(value))} ${escapeHtml(label)}</li>`;
    })
    .join("");
  const id = STRINGS_RU.itemDetail;
  return `<div class="item-detail-section"><h4 class="item-detail-section-title">${id.bonusesTitle}</h4><ul class="item-detail-list">${lis}</ul></div>`;
}

function formatWeaponCombatDetailSection(item) {
  if (item.type !== "weapon") return "";
  const wd = item.weaponDamage != null ? Number(item.weaponDamage) : "—";
  const cc = item.weaponCritChance != null ? Number(item.weaponCritChance) : "—";
  const cm = item.weaponCritMult != null ? Number(item.weaponCritMult) : "—";
  const id = STRINGS_RU.itemDetail;
  return `<div class="item-detail-section"><h4 class="item-detail-section-title">${id.combatTitle}</h4><ul class="item-detail-list item-detail-list-plain"><li>${id.baseDamage} <strong>${escapeHtml(String(wd))}</strong></li><li>${id.critChanceBase} <strong>${escapeHtml(String(cc))}%</strong></li><li>${id.critMultBase} <strong>×${escapeHtml(String(cm))}</strong></li></ul></div>`;
}

function formatItemDetailDescriptionSection(item, stackCount) {
  const id = STRINGS_RU.itemDetail;
  const rawDescription = String(item?.description || "").trim();
  if (rawDescription) {
    return `<div class="item-detail-section"><h4 class="item-detail-section-title">${id.descriptionTitle}</h4><p class="item-detail-desc">${escapeHtml(rawDescription).replace(/\n/g, "<br>")}</p></div>`;
  }
  return "";
}

function buildInventoryItemDetailHtml(item, options = {}) {
  if (!item) return "";
  const stackCount = options.stackCount;
  const rarity = getItemRarity(item);
  const id = STRINGS_RU.itemDetail;
  const rarityRu = rarity === "unique" ? id.rarityUnique : rarity === "rare" ? id.rarityRare : id.rarityCommon;
  const typeRu = toRuType(item.type);
  const icon = item.icon || "•";
  const stackPill = item.isConsumable && stackCount != null && stackCount > 1
    ? `<span class="item-detail-stack-pill" aria-hidden="true">×${stackCount}</span>`
    : "";
  const sections = [
    formatItemStatBonusesDetailSection(item),
    formatWeaponCombatDetailSection(item),
    formatItemDetailDescriptionSection(item, stackCount),
  ].filter(Boolean).join("");
  const emptyHint = sections === "" ? `<p class="item-detail-muted item-detail-empty">${STRINGS_RU.itemDetail.emptyHint}</p>` : "";
  return `<div class="item-detail-card item-detail-rarity-${escapeHtml(rarity)}"><header class="item-detail-head"><span class="item-detail-rarity">${escapeHtml(rarityRu)}</span><span class="item-detail-type">${escapeHtml(typeRu)}</span>${stackPill}</header><div class="item-detail-title-row"><span class="item-detail-icon" aria-hidden="true">${escapeHtml(icon)}</span><span class="item-detail-name">${escapeHtml(item.name)}</span></div>${sections}${emptyHint}</div>`;
}

const inventoryPopover = createInventoryItemPopoverController({
  root,
  getScreen: () => state.screen,
  getItemById,
  buildInventoryItemDetailHtml,
});
let inventoryHoverShowTimer = null;
let skillHoverShowTimer = null;

function buildSkillDetailHtml(skill, skillState) {
  if (!skill) return "";
  const manaCost = Math.max(1, Number(skill.manaCost || 1));
  const level = Math.max(1, Number(skillState?.level || 1));
  const rawDescription = String(skill.description || "").trim();
  const description = rawDescription
    .replace(/^Выбери клетку персонажа\.\s*/i, "")
    .replace(/^Цель:\s*своя клетка\.\s*/i, "")
    .trim() || "—";
  let formula = String(skill.property || "").trim() || "Формула не указана.";
  let targets = "По правилам скилла";
  if (skill.id === "skill_support_regen") {
    const healPerTurn = 5 + level;
    formula = `Лечение за ход = 5 + уровень скилла = ${healPerTurn}. Длительность: 3 хода.`;
    targets = "Своя клетка";
  } else if (skill.id === "skill_support_heal") {
    const heal = 40 + Math.max(0, (level - 1) * 10);
    formula = `Лечение = 40 + 10 x (уровень - 1) = ${heal}.`;
    targets = "Своя клетка";
  } else if (rawDescription.toLowerCase().includes("клетку персонажа")) {
    targets = "Своя клетка";
  }
  return `<div class="item-detail-card item-detail-rarity-rare"><div class="skill-detail-topline"><span class="item-detail-icon" aria-hidden="true">${esc(skill.icon || "✨")}</span><span class="item-detail-name">${esc(skill.name)}</span><span class="cm-skill-choice-card__mana-badge">Мана: ${manaCost}</span></div><div class="item-detail-section"><h4 class="item-detail-section-title">Описание</h4><p class="item-detail-desc">${esc(description).replace(/\n/g, "<br>")}</p></div><div class="item-detail-section"><h4 class="item-detail-section-title">Формула</h4><p class="item-detail-desc">${esc(formula).replace(/\n/g, "<br>")}</p></div><div class="item-detail-section"><h4 class="item-detail-section-title">Доступные цели</h4><p class="item-detail-desc">${esc(targets)}</p></div></div>`;
}

function createSkillPopoverController() {
  let popoverEl = null;
  let popoverKey = null;
  let hideTimer = null;

  function ensureEl() {
    if (popoverEl) return popoverEl;
    popoverEl = document.createElement("div");
    popoverEl.className = "inventory-item-detail-popover";
    popoverEl.setAttribute("role", "tooltip");
    popoverEl.hidden = true;
    popoverEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(popoverEl);
    return popoverEl;
  }

  function hide() {
    clearTimeout(hideTimer);
    hideTimer = null;
    popoverKey = null;
    if (!popoverEl) return;
    popoverEl.hidden = true;
    popoverEl.setAttribute("aria-hidden", "true");
    popoverEl.innerHTML = "";
    popoverEl.style.visibility = "";
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hide(), 120);
  }

  function position(clientX, clientY) {
    if (!popoverEl || popoverEl.hidden) return;
    const pad = 14;
    popoverEl.style.visibility = "hidden";
    const w = popoverEl.offsetWidth;
    const h = popoverEl.offsetHeight;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + w > window.innerWidth - 10) x = Math.max(10, clientX - w - pad);
    if (y + h > window.innerHeight - 10) y = Math.max(10, clientY - h - pad);
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    popoverEl.style.left = `${x}px`;
    popoverEl.style.top = `${y}px`;
    popoverEl.style.visibility = "visible";
  }

  function updateFromEvent(event) {
    if (state.screen !== "game") {
      scheduleHide();
      return;
    }
    const trigger = event.target.closest("[data-skill-detail-id]");
    if (!trigger || !root.contains(trigger)) {
      scheduleHide();
      return;
    }
    clearTimeout(hideTimer);
    hideTimer = null;
    const skillId = trigger.dataset.skillDetailId;
    const skill = getCoreSkillDefs().find((s) => s.id === skillId) || null;
    if (!skill) {
      hide();
      return;
    }
    const skillState = state.playerSheet?.skills?.[skill.id] || { learned: true, level: 1 };
    const key = `${skill.id}:${Number(skillState?.level || 1)}`;
    const pop = ensureEl();
    if (popoverKey !== key) {
      pop.innerHTML = buildSkillDetailHtml(skill, skillState);
      popoverKey = key;
    }
    pop.hidden = false;
    pop.setAttribute("aria-hidden", "false");
    position(event.clientX, event.clientY);
  }

  return { hide, scheduleHide, updateFromEvent };
}

const skillPopover = createSkillPopoverController();

function queueInventoryPopoverUpdate(event) {
  const trigger = event.target.closest("[data-inventory-detail-item-id]");
  if (!trigger || !root.contains(trigger)) {
    if (inventoryHoverShowTimer) {
      clearTimeout(inventoryHoverShowTimer);
      inventoryHoverShowTimer = null;
    }
    inventoryPopover.scheduleHide();
    return;
  }
  if (inventoryHoverShowTimer) {
    clearTimeout(inventoryHoverShowTimer);
  }
  const clientX = Number(event.clientX || 0) + 6;
  const clientY = Number(event.clientY || 0) + 6;
  inventoryHoverShowTimer = setTimeout(() => {
    inventoryPopover.updateFromEvent({
      target: trigger,
      clientX,
      clientY,
    });
    inventoryHoverShowTimer = null;
  }, 90);
}

function queueSkillPopoverUpdate(event) {
  const trigger = event.target.closest("[data-skill-detail-id]");
  if (!trigger || !root.contains(trigger)) {
    if (skillHoverShowTimer) {
      clearTimeout(skillHoverShowTimer);
      skillHoverShowTimer = null;
    }
    skillPopover.scheduleHide();
    return;
  }
  if (skillHoverShowTimer) {
    clearTimeout(skillHoverShowTimer);
  }
  const clientX = Number(event.clientX || 0) + 6;
  const clientY = Number(event.clientY || 0) + 6;
  skillHoverShowTimer = setTimeout(() => {
    skillPopover.updateFromEvent({
      target: trigger,
      clientX,
      clientY,
    });
    skillHoverShowTimer = null;
  }, 90);
}

function clearSkillTargeting() {
  state.uiHud.skillTargeting = null;
  state.uiHud.trapTargeting = null;
}

function clearPathingState() {
  state.uiHud.pathHoverCell = null;
  state.uiHud.pathHoverEnemy = false;
  state.uiHud.pathPreviewCells = [];
  state.uiHud.pathLockedCells = [];
  state.uiHud.pathLockedTarget = null;
  state.uiHud.pathLockedEnemyId = null;
  state.uiHud.autoMoveActive = false;
  state.uiHud.autoMoveLastHp = null;
}

function snapshotProgress() {
  return { skillPoints: state.playerSheet?.skillPoints || 0 };
}

function maybeOpenSkillsOnNewPoint() {}
function maybeTriggerLevelUpPulse() {}
function pulseQuickbarSlot() {}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] || null;
}

function getSkillLevelLabel(skillDef, skillState) {
  const currentLevel = Math.max(0, Number(skillState?.level || 0));
  const nextLevel = Math.min(currentLevel + 1, Number(skillDef?.maxLevel || 1));
  return `${currentLevel} -> ${nextLevel}`;
}

function buildSkillChoiceOptions(playerSheet) {
  const skillDefs = getCoreSkillDefs(); // Core skill pool only; weapon skills are separate.
  const unknown = [];
  const upgradable = [];
  for (const def of skillDefs) {
    const stateRef = playerSheet?.skills?.[def.id] || { learned: false, level: 0 };
    const level = Math.max(0, Number(stateRef.level || 0));
    const maxLevel = Math.max(1, Number(def.maxLevel || 1));
    if (!stateRef.learned) {
      unknown.push(def);
    } else if (level < maxLevel) {
      upgradable.push(def);
    }
  }

  const options = [];
  const left = upgradable.length > 0 ? pickRandom(upgradable) : pickRandom(unknown);
  if (left) options.push(left);

  if (upgradable.length > 0) {
    const right = pickRandom(unknown);
    if (right && !options.some((s) => s.id === right.id)) options.push(right);
  } else {
    const restUnknown = unknown.filter((s) => !options.some((o) => o.id === s.id));
    const right = pickRandom(restUnknown);
    if (right) options.push(right);
  }

  return options;
}

function shouldAutoOpenSkillChoiceModal() {
  if (state.screen !== "game" || !state.playerSheet) return false;
  if (state.uiNewModal === "skills") return false;
  if ((state.playerSheet.skillPoints || 0) <= 0) return false;
  const level = Number(state.playerSheet.level || 1);
  if (level < 2 || level % 2 !== 0) return false;

  const coreDefs = getCoreSkillDefs(); // Core skills only.
  const maxedCount = coreDefs.filter((def) => {
    const s = state.playerSheet.skills?.[def.id];
    return Boolean(s?.learned) && Number(s.level || 0) >= Math.max(1, Number(def.maxLevel || 1));
  }).length;
  if (maxedCount >= 3) return false;

  const options = buildSkillChoiceOptions(state.playerSheet);
  if (options.length === 0) return false;
  const marker = `${level}:${options.map((s) => s.id).join("|")}`;
  if (state.uiSkillChoice?.marker === marker) return false;

  state.uiSkillChoice = {
    marker,
    optionIds: options.map((s) => s.id),
    selectedSkillId: options.length === 1 ? options[0].id : null,
  };
  state.uiNewModal = "skills";
  return true;
}
function trackSkillUse(skillId = null) {
  if (!state.run) return;
  trackEvent("skill_use", {
    run_id: state.run.analyticsRunId || null,
    class_id: null,
    skill_id: skillId || null,
    source: "ui-new",
  });
}

function inferDefeatReason(run) {
  const log = String(run?.lastLog || "").toLowerCase();
  if (log.includes("атакует")) return "enemy_attack";
  return "hp_zero";
}

function maybeTrackRunEnd() {
  if (!state.run || !state.playerSheet) return;
  if (state.run.analyticsRunEndTracked) return;
  if (state.run.status !== "victory" && state.run.status !== "defeat") return;
  const commonPayload = {
    run_id: state.run.analyticsRunId || null,
    class_id: null,
    result: state.run.status,
  };
  trackEvent("run_end", commonPayload);
  if (state.run.status === "defeat") {
    trackEvent("defeat_reason", {
      ...commonPayload,
      level: state.run.level || 1,
      reason: inferDefeatReason(state.run),
    });
  }
  state.run.analyticsRunEndTracked = true;
}

function isPlayerInputBlocked(nowMs) {
  if (!state.run) return true;
  normalizeFinishedAnimationsForRun(state.run, nowMs);
  return Boolean(
    isBlockingMotionActive(state.run.motion, nowMs)
    || isBlockingMotionActive(state.run.environmentMotion, nowMs),
  );
}

function getPortraitById(id) {
  return PORTRAITS.find((p) => p.id === id) || PORTRAITS[0];
}

function buildPortraitDataUri(fillHexEscaped) {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3CradialGradient id='g' cx='40%25' cy='35%25' r='70%25'%3E%3Cstop offset='0%25' stop-color='${fillHexEscaped}'/%3E%3Cstop offset='100%25' stop-color='%231a120e'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='48' fill='url(%23g)'/%3E%3Ccircle cx='38' cy='42' r='5' fill='%23e8d4a8'/%3E%3Ccircle cx='62' cy='42' r='5' fill='%23e8d4a8'/%3E%3Cellipse cx='50' cy='58' rx='10' ry='6' fill='%233d2c22'/%3E%3Cpath d='M30 55 Q50 72 70 55' stroke='%23c4a35a' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3Cpath d='M22 48 L10 40 M78 48 L90 40' stroke='%23a89870' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E`;
}

function esc(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toRuType(type) {
  if (type === "weapon") return "Оружие";
  if (type === "armor") return "Броня";
  if (type === "amulet") return "Амулет";
  return type;
}

function getUiStatIcon(key) {
  const map = { STR: "💪", INT: "✨", AGI: "🐾", LUK: "🍀", CRIT_CHANCE: "🎯", CRIT_MULT: "💥", HP_MAX: "❤", WEAPON_DM: "⚔" };
  return map[key] || "•";
}

function getUiStatName(key) {
  const map = { STR: "Сила", INT: "Интеллект", AGI: "Ловкость", LUK: "Удача", CRIT_CHANCE: "Крит шанс", CRIT_MULT: "Крит x", HP_MAX: "HP макс", WEAPON_DM: "Урон оруж" };
  return map[key] || key;
}

function getStatValueForUi(sheet, key) {
  if (key === "CRIT_CHANCE") return `${Number(sheet?.derived?.CRIT_CHANCE || 0)}%`;
  if (key === "CRIT_MULT") return `${Number(sheet?.derived?.CRIT_MULT || 1)}x`;
  if (key === "WEAPON_DM") return Number(sheet?.derived?.WEAPON_DAMAGE || 0);
  if (key === "HP_MAX") return Number(sheet?.stats?.HP_MAX || 0);
  return Number(sheet?.stats?.[key] || 0);
}

function getSelectedSheet() {
  return applyLoadoutToSheet(createPlayerSheet(state.preGameStats), state.starterLoadout);
}

function getValueDeltaClass(baseValue, previewValue) {
  const base = Number.parseFloat(String(baseValue).replace(",", "."));
  const next = Number.parseFloat(String(previewValue).replace(",", "."));
  if (Number.isFinite(next) && Number.isFinite(base) && next > base) return "cm-stat-value--up";
  if (Number.isFinite(next) && Number.isFinite(base) && next < base) return "cm-stat-value--down";
  return "";
}

function getHoveredStatPreview() {
  const hover = state.uiHud?.statHoverPreview || null;
  if (!hover || !hover.stat || !Number.isFinite(Number(hover.delta))) {
    return null;
  }
  return {
    screen: hover.screen,
    stat: String(hover.stat),
    delta: Number(hover.delta),
  };
}

function getHoveredItemPreview() {
  const hover = state.uiHud?.itemHoverPreview || null;
  if (!hover || !hover.screen || !hover.itemId) {
    return null;
  }
  return {
    screen: String(hover.screen),
    itemId: String(hover.itemId),
    bagInstanceId: hover.bagInstanceId ? String(hover.bagInstanceId) : null,
  };
}

function buildPreGamePreviewStats(hoverPreview) {
  const current = {
    STR: Number(state.preGameStats.STR || 0),
    INT: Number(state.preGameStats.INT || 0),
    AGI: Number(state.preGameStats.AGI || 0),
    LUK: Number(state.preGameStats.LUK || 0),
  };
  if (!hoverPreview || hoverPreview.screen !== "welcome") {
    return null;
  }
  const { stat, delta } = hoverPreview;
  if (!["STR", "INT", "AGI", "LUK"].includes(stat)) return null;
  if (delta > 0 && state.preGamePointsRemaining <= 0) return null;
  if (delta < 0 && current[stat] <= 0) return null;
  const nextValue = Math.max(0, current[stat] + delta);
  return { ...current, [stat]: nextValue };
}

function renderAllocStatRow(key, baseValue, previewValue) {
  const value = Number(baseValue || 0);
  const nextValue = Number(previewValue ?? baseValue ?? 0);
  const minusDisabled = value <= 0;
  const plusDisabled = state.preGamePointsRemaining <= 0;
  const valueDeltaClass = getValueDeltaClass(value, nextValue);
  return `
    <li class="cm-stat-row cm-stat-row--alloc">
      <span class="cm-stat-icon" aria-hidden="true">${getUiStatIcon(key)}</span>
      <span class="cm-stat-name">${getUiStatName(key)}</span>
      <button type="button" class="cm-stat-btn" data-action="pregame-stat-minus" data-stat="${key}" data-preview-screen="welcome" data-preview-stat="${key}" data-preview-delta="-1" ${minusDisabled ? "disabled" : ""}>-</button>
      <span class="cm-stat-value ${valueDeltaClass}">${nextValue}</span>
      <button type="button" class="cm-stat-btn" data-action="pregame-stat-plus" data-stat="${key}" data-preview-screen="welcome" data-preview-stat="${key}" data-preview-delta="1" ${plusDisabled ? "disabled" : ""}>+</button>
    </li>
  `;
}

function renderReadOnlyStatRow(sheet, key, previewSheet = null) {
  const baseValue = getStatValueForUi(sheet, key);
  const nextValue = previewSheet ? getStatValueForUi(previewSheet, key) : baseValue;
  const valueDeltaClass = getValueDeltaClass(baseValue, nextValue);
  return `
    <li class="cm-stat-row cm-stat-row--readonly">
      <span class="cm-stat-icon" aria-hidden="true">${getUiStatIcon(key)}</span>
      <span class="cm-stat-name">${getUiStatName(key)}</span>
      <span class="cm-stat-value ${valueDeltaClass}">${nextValue}</span>
    </li>
  `;
}

function renderStarterGroup(type, options, baseActorStats = null, previewActorStats = null) {
  const selected = options.find((item) => state.starterLoadout.includes(item.id)) || null;
  return `
    <div class="cm-welcome-equip-slot">
      <div class="cm-welcome-equip-header">
        <span class="cm-welcome-equip-label">${toRuType(type)}</span>
        <span class="cm-welcome-equip-desc">${selected ? esc(selected.name) : "Выбрано: 0"}</span>
      </div>
      <div class="cm-welcome-options">
        ${options.map((item) => {
          const active = state.starterLoadout.includes(item.id);
          return `
            <button
              class="cm-welcome-item item-rarity-${getItemRarity(item)} ${active ? "active" : ""}"
              type="button"
              data-action="toggle-starter-item"
              data-item-id="${item.id}"
              data-preview-item-screen="welcome"
              data-preview-item-id="${item.id}"
              data-inventory-detail-item-id="${item.id}"
              aria-label="${esc(item.name)}"
              title="${esc(item.name)}"
            >${item.icon || "•"}${item.type === "weapon" ? `<span class="cm-item-weapon-damage ${getValueDeltaClass(getWeaponDamageForActorStats(baseActorStats || state.preGameStats, item), getWeaponDamageForActorStats(previewActorStats || baseActorStats || state.preGameStats, item))}">${getWeaponDamageForActorStats(previewActorStats || baseActorStats || state.preGameStats, item)}</span>` : ""}</button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function formatSkillDeltaHtml(fromValue, toValue) {
  return `<span class="cm-skill-choice-card__delta"><s>${fromValue}</s><strong>${toValue}</strong></span>`;
}

function getSkillChoiceCardContent(skillDef, skillState) {
  const isLearned = Boolean(skillState?.learned);
  const currentLevel = Math.max(0, Number(skillState?.level || 0));
  const nextLevel = Math.min(currentLevel + 1, Math.max(1, Number(skillDef?.maxLevel || 1)));
  if (skillDef?.id === "skill_support_regen") {
    const currentPerTurn = 5 + Math.max(1, currentLevel);
    const nextPerTurn = 5 + nextLevel;
    return {
      lines: isLearned
        ? [
            `Лечение за ход: ${formatSkillDeltaHtml(currentPerTurn, nextPerTurn)} HP`,
            `Суммарно за 3 хода: ${formatSkillDeltaHtml(currentPerTurn * 3, nextPerTurn * 3)} HP`,
          ]
        : [
            `Лечение за ход: ${nextPerTurn} HP`,
            `Суммарно за 3 хода: ${nextPerTurn * 3} HP`,
          ],
    };
  }
  if (skillDef?.id === "skill_support_heal") {
    const currentValue = 40 + Math.max(0, (Math.max(1, currentLevel) - 1) * 10);
    const nextValue = 40 + Math.max(0, (nextLevel - 1) * 10);
    return {
      lines: isLearned
        ? [`Мгновенное лечение: ${formatSkillDeltaHtml(currentValue, nextValue)} HP`]
        : [`Мгновенное лечение: ${nextValue} HP`],
    };
  }
  return {
    lines: [esc(skillDef?.property || "Эффект зависит от уровня скилла.")],
  };
}

function getWeaponDamageForActorStats(actorStats, item) {
  if (!item || item.type !== "weapon") return null;
  const safeStats = {
    STR: Number(actorStats?.STR || 0),
    INT: Number(actorStats?.INT || 0),
    AGI: Number(actorStats?.AGI || 0),
    LUK: Number(actorStats?.LUK || 0),
    HP_MAX: Number(actorStats?.HP_MAX || 1),
  };
  const derived = buildDerivedStats(safeStats, item);
  const str = Number(safeStats.STR || 0);
  const weaponDamage = Number(derived?.WEAPON_DAMAGE || item.weaponDamage || 0);
  return Math.max(1, Math.floor(weaponDamage + str));
}

function getWeaponDamageForSheet(sheet, item) {
  if (!item || item.type !== "weapon") return null;
  const actorStats = sheet?.stats || sheet?.baseStats || null;
  return getWeaponDamageForActorStats(actorStats, item);
}

function getWeaponDamageForPreGameStats(preGameStats, item) {
  return getWeaponDamageForActorStats(preGameStats, item);
}

function buildWelcomePreviewSheetFromItem(itemPreview) {
  if (!itemPreview || itemPreview.screen !== "welcome") return null;
  const item = getItemById(itemPreview.itemId);
  if (!item || !["weapon", "armor", "amulet"].includes(item.type)) return null;
  const nextLoadout = [...state.starterLoadout];
  for (let i = nextLoadout.length - 1; i >= 0; i -= 1) {
    const loaded = getItemById(nextLoadout[i]);
    if (loaded?.type === item.type) {
      nextLoadout.splice(i, 1);
    }
  }
  nextLoadout.push(item.id);
  return applyLoadoutToSheet(createPlayerSheet(state.preGameStats), nextLoadout);
}

function renderModal() {
  if (!state.uiNewModal) return "";
  const isDevlog = state.uiNewModal === "devlog";
  const isSkills = state.uiNewModal === "skills";
  const title = isDevlog ? "Devlog" : (isSkills ? "Прокачка скиллов" : STRINGS_RU.helpModal.title);
  const content = isDevlog
    ? `
      <div class="cm-modal-devlog">
        ${DEVLOG_ENTRIES.slice(0, 5).map((entry) => `
          <article class="cm-modal-devlog__entry">
            <h4>v${esc(entry.version)}</h4>
            <ul>
              ${(entry.changes || []).map((row) => `<li>${esc(row)}</li>`).join("")}
            </ul>
          </article>
        `).join("")}
      </div>
    `
    : isSkills
      ? (() => {
        const allDefs = getCoreSkillDefs();
        const optionIds = state.uiSkillChoice?.optionIds || buildSkillChoiceOptions(state.playerSheet).map((s) => s.id);
        const options = optionIds
          .map((id) => allDefs.find((def) => def.id === id))
          .filter(Boolean);
        const selectedSkillId = state.uiSkillChoice?.selectedSkillId
          || (options.length === 1 ? options[0].id : null);
        const selectedSkill = options.find((skill) => skill.id === selectedSkillId) || null;
        const selectedState = selectedSkill ? (state.playerSheet?.skills?.[selectedSkill.id] || { learned: false, level: 0 }) : null;
        const selectedActionLabel = selectedState?.learned ? "Прокачать" : "Изучить";
        const canConfirm = Boolean(selectedSkill) && Number(state.playerSheet?.skillPoints || 0) > 0;
        const cards = options.map((skill) => {
          const skillState = state.playerSheet?.skills?.[skill.id] || { learned: false, level: 0 };
          const isSelected = selectedSkillId === skill.id;
          const levelLabel = getSkillLevelLabel(skill, skillState);
          const manaCost = Math.max(1, Number(skill.manaCost || 1));
          const cardContent = getSkillChoiceCardContent(skill, skillState);
          return `
            <button class="cm-skill-choice-card ${isSelected ? "is-selected" : ""}" type="button" data-action="select-skill-choice" data-skill-id="${skill.id}" data-skill-detail-id="${skill.id}">
              <div class="cm-skill-choice-card__head">
                <div class="cm-skill-choice-card__head-main">
                  <h4>${esc(skill.icon || "✨")} ${esc(skill.name)}</h4>
                  <span class="cm-skill-choice-card__lvl">ур. ${esc(levelLabel)}</span>
                </div>
                <div class="cm-skill-choice-card__mana-badge">Мана: ${manaCost}</div>
              </div>
              <div class="cm-skill-choice-card__copy">
                ${cardContent.lines.map((line) => `<p>${line}</p>`).join("")}
              </div>
            </button>
          `;
        }).join("");
        return `
          <div class="cm-skill-choice">
            <div class="cm-skill-choice__grid ${options.length === 1 ? "is-single" : ""}">
              ${cards}
            </div>
            <div class="cm-modal__actions">
              <button class="cm-btn cm-btn--secondary" type="button" data-action="confirm-skill-choice" ${canConfirm ? "" : "disabled"}>${selectedActionLabel}</button>
            </div>
          </div>
        `;
      })()
      : `
      <div class="cm-modal-help">
        <p><strong>${esc(STRINGS_RU.helpModal.move)}</strong> ${esc(STRINGS_RU.helpModal.moveBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.mouse)}</strong> ${esc(STRINGS_RU.helpModal.mouseBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.auto)}</strong> ${esc(STRINGS_RU.helpModal.autoBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.skills)}</strong> ${esc(STRINGS_RU.helpModal.skillsBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.turns)}</strong> ${esc(STRINGS_RU.helpModal.turnsBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.hints)}</strong> ${esc(STRINGS_RU.helpModal.hintsBody)}</p>
      </div>
    `;
  return `
    <div class="cm-modal-backdrop is-open" data-action="close-modal">
      <section class="cm-panel cm-modal ${isSkills ? "cm-modal--skills" : ""}" role="dialog" aria-modal="true" aria-label="${title}">
        <h2 class="cm-panel__title">${isSkills ? "Выбери Скилл" : title}</h2>
        <div class="cm-panel__body">
          ${content}
          ${isSkills ? "" : `<div class="cm-modal__actions"><button class="cm-btn cm-btn--secondary" type="button" data-action="close-modal">${STRINGS_RU.helpModal.close}</button></div>`}
        </div>
      </section>
    </div>
  `;
}

function render() {
  if (state.screen === "ending") {
    renderEndingScreen();
    return;
  }
  if (state.screen === "game") {
    renderGameScreen();
    return;
  }

  const portrait = getPortraitById(state.selectedPortraitId);
  const sheet = getSelectedSheet();
  const hoverPreview = getHoveredStatPreview();
  const itemPreview = getHoveredItemPreview();
  const previewStats = buildPreGamePreviewStats(hoverPreview);
  const previewSheetFromStats = previewStats ? applyLoadoutToSheet(createPlayerSheet(previewStats), state.starterLoadout) : null;
  const previewSheetFromItem = !previewStats ? buildWelcomePreviewSheetFromItem(itemPreview) : null;
  const previewSheet = previewSheetFromStats || previewSheetFromItem;
  const starterItems = getStarterCommonItems().filter((item) => ["weapon", "armor", "amulet"].includes(item.type));
  const grouped = {
    weapon: starterItems.filter((item) => item.type === "weapon"),
    armor: starterItems.filter((item) => item.type === "armor"),
    amulet: starterItems.filter((item) => item.type === "amulet"),
  };
  const hasAllTypes = ["weapon", "armor", "amulet"].every((type) =>
    state.starterLoadout.some((id) => getItemById(id)?.type === type),
  );
  const canStart = state.preGamePointsRemaining === 0 && hasAllTypes;

  root.innerHTML = `
    <div class="cm-app">
      <div class="cm-main">
        <aside class="cm-col cm-col--left">
          <section class="cm-panel cm-panel--fill" aria-labelledby="hero-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="hero-title">Герой</h2>
            <div class="cm-panel__body">
              <div class="cm-hero-portrait">
                <div class="cm-portrait-ring">
                  <div class="cm-portrait-inner">
                    <img src="${buildPortraitDataUri(portrait.fill)}" width="112" height="112" alt="${esc(portrait.name)}" />
                  </div>
                </div>
                <div class="cm-level-badge" aria-label="Уровень 1" title="Уровень 1">1</div>
              </div>

              <div class="cm-bar cm-bar--hp">
                <div class="cm-bar__row">
                  <span class="cm-bar__icon-wrap" aria-hidden="true"><img class="cm-bar__icon" src="../design/impl/icons/icon-hp.svg" width="22" height="22" alt="" /></span>
                  <div class="cm-bar__content">
                    <div class="cm-bar__label"><span>HP</span><span>${sheet.stats.HP} / ${sheet.stats.HP_MAX}</span></div>
                    <div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round((sheet.stats.HP / Math.max(1, sheet.stats.HP_MAX)) * 100)))}%"></div></div>
                  </div>
                </div>
              </div>
              <div class="cm-bar cm-bar--mana">
                <div class="cm-bar__row">
                  <span class="cm-bar__icon-wrap" aria-hidden="true"><img class="cm-bar__icon" src="../design/impl/icons/icon-mana.svg" width="22" height="22" alt="" /></span>
                  <div class="cm-bar__content">
                    <div class="cm-bar__label"><span>Мана</span><span>${sheet.mana} / ${sheet.manaMax}</span></div>
                    <div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round((sheet.mana / Math.max(1, sheet.manaMax)) * 100)))}%"></div></div>
                  </div>
                </div>
              </div>

              <div class="cm-welcome-section-title">Распределение очков</div>
              <div class="cm-welcome-points">Свободно очков: <span class="cm-welcome-points-val">${state.preGamePointsRemaining}</span></div>
              <ul class="cm-stats cm-stats--alloc">
                ${renderAllocStatRow("STR", Number(sheet?.stats?.STR || 0), Number(previewSheet?.stats?.STR || sheet?.stats?.STR || 0))}
                ${renderAllocStatRow("INT", Number(sheet?.stats?.INT || 0), Number(previewSheet?.stats?.INT || sheet?.stats?.INT || 0))}
                ${renderAllocStatRow("AGI", Number(sheet?.stats?.AGI || 0), Number(previewSheet?.stats?.AGI || sheet?.stats?.AGI || 0))}
                ${renderAllocStatRow("LUK", Number(sheet?.stats?.LUK || 0), Number(previewSheet?.stats?.LUK || sheet?.stats?.LUK || 0))}
                ${renderReadOnlyStatRow(sheet, "CRIT_CHANCE", previewSheet)}
                ${renderReadOnlyStatRow(sheet, "CRIT_MULT", previewSheet)}
              </ul>
            </div>
          </section>
        </aside>

        <main class="cm-col cm-col--center">
          <section class="cm-panel cm-panel--fill" aria-labelledby="portrait-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="portrait-title">Выбор внешности</h2>
            <div class="cm-panel__body cm-welcome-center">
              <div class="cm-welcome-preview">
                <div class="cm-welcome-preview-img-wrap"><img src="${buildPortraitDataUri(portrait.fill)}" alt="Предпросмотр" /></div>
                <h3 class="cm-welcome-preview-name">${esc(portrait.name)}</h3>
                <p class="cm-welcome-preview-desc">${esc(portrait.desc)}</p>
              </div>

              <div class="cm-welcome-gallery-wrap cm-scroll-wood">
                <div class="cm-welcome-gallery">
                  ${PORTRAITS.map((item) => `
                    <button
                      class="cm-welcome-gallery-item ${item.id === state.selectedPortraitId ? "active" : ""}"
                      type="button"
                      data-action="select-portrait"
                      data-portrait-id="${item.id}"
                      aria-label="${esc(item.name)}"
                      title="${esc(item.name)}"
                    >
                      <img src="${buildPortraitDataUri(item.fill)}" alt="" />
                    </button>
                  `).join("")}
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside class="cm-col cm-col--right">
          <section class="cm-panel cm-panel--welcome-equip" aria-labelledby="equip-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="equip-title">Стартовая экипировка</h2>
            <div class="cm-panel__body">
              ${renderStarterGroup("weapon", grouped.weapon, sheet?.stats || state.preGameStats, previewSheet?.stats || sheet?.stats || state.preGameStats)}
              ${renderStarterGroup("armor", grouped.armor, sheet?.stats || state.preGameStats, previewSheet?.stats || sheet?.stats || state.preGameStats)}
              ${renderStarterGroup("amulet", grouped.amulet, sheet?.stats || state.preGameStats, previewSheet?.stats || sheet?.stats || state.preGameStats)}
            </div>
          </section>

          <section class="cm-panel" aria-labelledby="info-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="info-title">Информация</h2>
            <div class="cm-panel__body cm-welcome-info-body">
              <button class="cm-btn cm-btn--secondary" type="button" data-action="open-help">Подсказки по игре</button>
              <button class="cm-btn cm-btn--secondary" type="button" data-action="open-devlog">Devlog</button>
            </div>
          </section>
          <div class="cm-welcome-start-wrap">
            <button class="cm-btn cm-btn--primary cm-welcome-start" type="button" data-action="start-game" ${canStart ? "" : "disabled"}>Начать забег</button>
            ${state.uiNewStartMessage ? `<p class="cm-start-placeholder">${esc(state.uiNewStartMessage)}</p>` : ""}
          </div>
        </aside>
      </div>
    </div>
    ${renderModal()}
  `;
}

function renderGameScreen() {
  shouldAutoOpenSkillChoiceModal();
  const portrait = getPortraitById(state.selectedPortraitId);
  const run = state.run;
  const sheet = state.playerSheet;
  const hoverPreview = getHoveredStatPreview();
  const itemPreview = getHoveredItemPreview();
  const previewSheetFromStats = hoverPreview && hoverPreview.screen === "game" && hoverPreview.delta > 0
    ? spendLevelUpPoint(sheet, hoverPreview.stat)
    : null;
  const previewSheetFromItem = !previewSheetFromStats && itemPreview?.screen === "game" && itemPreview?.bagInstanceId
    ? swapItemFromBag(sheet, itemPreview.bagInstanceId, -1)
    : null;
  const previewSheet = previewSheetFromStats || previewSheetFromItem;
  const equipped = sheet?.equippedByType || {};
  const bag = sheet?.bag || [];
  const equipTypes = ["weapon", "armor", "amulet"];
  const equipRows = equipTypes.map((type) => {
    const item = getItemById(equipped[type]);
    if (item) {
      return `
      <div class="cm-equip-slot">
        <span class="cm-equip-slot__label">${toRuType(type)}</span>
        <button class="cm-equip-slot__box item-rarity-${getItemRarity(item)}" type="button" data-action="equip-slot-action" data-equip-type="${type}" data-drag-kind="equipped-item" data-drag-equip-type="${type}" data-inventory-detail-item-id="${item.id}" draggable="true" title="${esc(item.name)}">
          <span class="cm-equip-slot__icon">${item.icon || "—"}</span>
          ${type === "weapon" ? `<span class="cm-item-weapon-damage ${getValueDeltaClass(getWeaponDamageForSheet(sheet, item), getWeaponDamageForSheet(previewSheet || sheet, item))}">${getWeaponDamageForSheet(previewSheet || sheet, item)}</span>` : ""}
        </button>
      </div>
    `;
    }
    return `
      <div class="cm-equip-slot">
        <span class="cm-equip-slot__label">${toRuType(type)}</span>
        <div class="cm-equip-slot__box" data-equip-type="${type}">
          <span class="cm-equip-slot__icon">${item?.icon || "—"}</span>
          <span class="cm-equip-slot__bonus">${item ? "+1" : ""}</span>
        </div>
      </div>
    `;
  }).join("");

  const equipables = bag
    .map((entry, index) => {
      const item = getItemById(entry.itemId);
      if (!item || !["weapon", "armor", "amulet"].includes(item.type)) return null;
      return { entry, item, bagIndex: index };
    })
    .filter(Boolean)
    .sort((a, b) => compareItemsByRarityThenId(a.item, b.item));
  const consumablesById = new Map();
  for (const entry of bag) {
    const item = getItemById(entry.itemId);
    if (!item || item.type !== "consumable") continue;
    const cur = consumablesById.get(item.id) || { item, count: 0 };
    cur.count += 1;
    consumablesById.set(item.id, cur);
  }
  const consumables = Array.from(consumablesById.values())
    .sort((a, b) => compareItemsByRarityThenId(a.item, b.item));
  const learnedSkills = getCoreSkillDefs().filter((skill) => {
    const skillState = sheet?.skills?.[skill.id];
    return Boolean(skillState?.learned);
  });

  const effects = [];
  if ((run?.nextHitMultiplier || 1) > 1) {
    effects.push({ icon: "🧪", name: "Колба специй", desc: `Следующий удар x${run.nextHitMultiplier}.`, turns: "1 х." });
  }
  const bandage = (run?.overTimeEffects || []).find((effect) => effect.type === "bandage_regen");
  if (bandage?.turnsLeft > 0) {
    effects.push({ icon: "🩹", name: "Перевязан", desc: "Восстановление HP каждый ход.", turns: `${bandage.turnsLeft} х.` });
  }
  const stackEffects = sheet?.effectStacks || {};
  if ((stackEffects.hp_max_plus_5 || 0) > 0) {
    effects.push({ icon: "🧀", name: "Твердый сыр", desc: "Постоянный бонус HP.", turns: "∞" });
  }
  if ((stackEffects.hp_max_plus_4 || 0) > 0) {
    effects.push({ icon: "🥨", name: "Сухарик", desc: "Постоянный бонус HP.", turns: "∞" });
  }
  if ((stackEffects.hp_max_plus_1 || 0) > 0) {
    effects.push({ icon: "👑", name: "Королевский сыр", desc: "Постоянный бонус HP.", turns: "∞" });
  }

  const quickSlots = Array.isArray(state.uiHud?.quickbarSlots) ? state.uiHud.quickbarSlots : [];
  const inventoryCellsHtml = (equipables.length
    ? equipables.map((entry) => `<button class="cm-inv-cell item-rarity-${getItemRarity(entry.item)}" type="button" title="${esc(entry.item.name)}" data-action="bag-item-action" data-item-id="${entry.item.id}" data-bag-instance-id="${entry.entry.instanceId}" data-bag-index="${entry.bagIndex}" data-drag-kind="bag-equip" data-drag-bag-instance-id="${entry.entry.instanceId}" data-drag-item-type="${entry.item.type}" data-preview-item-screen="game" data-preview-item-id="${entry.item.id}" data-preview-item-bag-instance-id="${entry.entry.instanceId}" data-inventory-detail-item-id="${entry.item.id}" draggable="true">${entry.item.icon || "•"}${entry.item.type === "weapon" ? `<span class="cm-item-weapon-damage ${getValueDeltaClass(getWeaponDamageForSheet(sheet, entry.item), getWeaponDamageForSheet(previewSheet || sheet, entry.item))}">${getWeaponDamageForSheet(previewSheet || sheet, entry.item)}</span>` : ""}</button>`)
    : [`<div class="cm-inv-cell cm-inv-cell--empty"></div>`])
    .join("");
  const consumableCellsHtml = (consumables.length
    ? consumables.map((entry) => `<button class="cm-inv-cell item-rarity-${getItemRarity(entry.item)}" type="button" data-action="use-consumable" data-item-id="${entry.item.id}" data-drag-kind="consumable" data-drag-item-id="${entry.item.id}" data-inventory-detail-item-id="${entry.item.id}" data-inventory-detail-stack="${entry.count}" draggable="true" title="${esc(entry.item.name)}">${entry.item.icon || "•"}<span class="cm-inv-cell__qty">${entry.count}</span></button>`)
    : [`<div class="cm-inv-cell cm-inv-cell--empty"></div>`])
    .join("");
  const skillsHtml = learnedSkills.length
    ? learnedSkills
      .map((skill) => `<li class="cm-skill"><button class="cm-skill__btn" type="button" data-action="left-skill-use" data-skill-id="${skill.id}" data-skill-detail-id="${skill.id}" data-drag-kind="skill" data-drag-skill-id="${skill.id}" draggable="true"><span class="cm-skill__icon">${skill.icon || "✨"}</span><span class="cm-skill__name">${esc(skill.name)}</span><span class="cm-skill__mana">${Math.max(1, skill.manaCost)}</span></button></li>`)
      .join("")
    : `<li class="cm-skill"><span class="cm-skill__icon">—</span><span class="cm-skill__name">Нет изученных скиллов</span><span class="cm-skill__mana"></span></li>`;

  root.innerHTML = `
    <div class="cm-app cm-app--game">
      <div class="cm-main">
        <aside class="cm-col cm-col--left">
          <section class="cm-panel cm-panel--hero" aria-labelledby="hero-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span><span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span><span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span><span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="hero-title">Герой</h2>
            <div class="cm-panel__body">
              <div class="cm-hero-portrait"><div class="cm-portrait-ring"><div class="cm-portrait-inner"><img src="${buildPortraitDataUri(portrait.fill)}" width="112" height="112" alt="${esc(portrait.name)}" /></div></div><button class="cm-level-badge" type="button" data-action="secret-level-up" aria-label="Скрытое повышение уровня">${sheet?.level || 1}</button></div>
              <div class="cm-bar cm-bar--hp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="../design/impl/icons/icon-hp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>HP</span><span>${sheet?.stats?.HP || 0} / ${sheet?.stats?.HP_MAX || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.stats?.HP || 0) / Math.max(1, sheet?.stats?.HP_MAX || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--mana"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="../design/impl/icons/icon-mana.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Мана</span><span>${sheet?.mana || 0} / ${sheet?.manaMax || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.mana || 0) / Math.max(1, sheet?.manaMax || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--xp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="../design/impl/icons/icon-xp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Опыт</span><span>${sheet?.xp || 0} / ${sheet?.xpToNext || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.xp || 0) / Math.max(1, sheet?.xpToNext || 1)) * 100)))}%"></div></div></div></div></div>
            </div>
          </section>

          <section class="cm-panel"><span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Характеристики</h2>
            <div class="cm-panel__body">
              <ul class="cm-stats">
                ${["STR", "INT", "AGI", "LUK"].map((k) => `
                  <li class="cm-stat-row">
                    <span class="cm-stat-icon">${getUiStatIcon(k)}</span><span class="cm-stat-name">${getUiStatName(k)}</span><span class="cm-stat-value ${getValueDeltaClass(Number(sheet?.stats?.[k] || 0), Number(previewSheet?.stats?.[k] || sheet?.stats?.[k] || 0))}">${Number(previewSheet?.stats?.[k] || sheet?.stats?.[k] || 0)}</span>
                    <button type="button" class="cm-stat-plus" data-action="upgrade-stat" data-stat="${k}" data-preview-screen="game" data-preview-stat="${k}" data-preview-delta="1" ${Number(sheet?.unspentPoints || 0) > 0 ? "" : "disabled"}>+</button>
                  </li>`).join("")}
                <li class="cm-stat-row"><span class="cm-stat-icon">🎯</span><span class="cm-stat-name">Крит шанс</span><span class="cm-stat-value ${getValueDeltaClass(Number(sheet?.derived?.CRIT_CHANCE || 0), Number(previewSheet?.derived?.CRIT_CHANCE || sheet?.derived?.CRIT_CHANCE || 0))}">${Number(previewSheet?.derived?.CRIT_CHANCE || sheet?.derived?.CRIT_CHANCE || 0)}%</span><span class="cm-stat-plus-spacer"></span></li>
                <li class="cm-stat-row"><span class="cm-stat-icon">💥</span><span class="cm-stat-name">Крит x</span><span class="cm-stat-value ${getValueDeltaClass(Number(sheet?.derived?.CRIT_MULT || 1), Number(previewSheet?.derived?.CRIT_MULT || sheet?.derived?.CRIT_MULT || 1))}">${Number(previewSheet?.derived?.CRIT_MULT || sheet?.derived?.CRIT_MULT || 1)}x</span><span class="cm-stat-plus-spacer"></span></li>
              </ul>
            </div>
          </section>

          <section class="cm-panel"><span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Активные эффекты</h2>
            <div class="cm-panel__body">
              <div class="cm-effects-viewport cm-scroll-wood">
                <div class="cm-effects">
                  ${effects.length
                    ? effects.map((effect) => `
                        <div class="cm-effect">
                          <div class="cm-effect__icon">${effect.icon}</div>
                          <div class="cm-effect__main">
                            <div class="cm-effect__name">${esc(effect.name)}</div>
                            <div class="cm-effect__desc">${esc(effect.desc)}</div>
                          </div>
                          <div class="cm-effect__turns">${esc(effect.turns)}</div>
                        </div>
                      `).join("")
                    : `<div class="cm-effect"><div class="cm-effect__icon">—</div><div class="cm-effect__main"><div class="cm-effect__name">Эффекты</div><div class="cm-effect__desc">Нет активных эффектов.</div></div><div class="cm-effect__turns">0</div></div>`}
                </div>
              </div>
            </div>
          </section>

          <section class="cm-panel"><span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Журнал</h2>
            <div class="cm-panel__body"><div class="cm-log"><p class="cm-log__line cm-log__line--with-icon"><img class="cm-log__mark" src="../design/impl/icons/icon-log.svg" width="16" height="16" alt="" /><span class="cm-log__text">${esc(run?.lastLog || "—")}</span></p></div></div>
          </section>
        </aside>

        <main class="cm-col cm-col--center">
          <div class="cm-center-stack">
            <div class="cm-panel cm-panel--fill cm-center-panel"><span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
              <h2 class="cm-panel__title">Поле</h2>
              <div class="cm-panel__body">
                <div class="cm-field" role="img" aria-label="Игровое поле">
                  <div class="cm-phase cm-phase--field">${run?.turnPhase === "environment" ? "Ход окружения" : "Ход игрока"}</div>
                  <div class="cm-field__main"><canvas id="newGameCanvas" width="800" height="500" style="width:100%;height:100%;"></canvas></div>
                  <footer class="cm-hotbar-wrap cm-panel cm-hotbar-wrap--in-field cm-hotbar-wrap--recessed"><span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span><div class="cm-hotbar">${Array.from({ length: 9 }).map((_, i) => {
                    const slot = quickSlots[i] || null;
                    if (!slot) {
                      return `<button class="cm-hot-slot cm-hot-slot--empty" type="button" data-action="quickbar-use" data-slot-index="${i}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="false"><span class="cm-hot-slot__key">${i + 1}</span></button>`;
                    }
                    if (slot.kind === "consumable") {
                      const item = getItemById(slot.itemId);
                      const count = (sheet?.bag || []).filter((entry) => entry.itemId === slot.itemId).length;
                      return `<button class="cm-hot-slot" type="button" data-action="quickbar-use" data-slot-index="${i}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" data-inventory-detail-item-id="${item?.id || ""}" data-inventory-detail-stack="${count}" draggable="true" title="${esc(item?.name || "Расходник")}"><span class="cm-hot-slot__key">${i + 1}</span>${item?.icon || "•"}<span class="cm-hot-slot__qty">${count}</span></button>`;
                    }
                    if (slot.kind === "skill") {
                      const skill = getCoreSkillDefs().find((s) => s.id === slot.skillId);
                      const manaCost = Math.max(1, Number(skill?.manaCost || 1));
                      return `<button class="cm-hot-slot" type="button" data-action="quickbar-use" data-slot-index="${i}" data-skill-detail-id="${skill?.id || ""}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="true" title="${esc(skill?.name || "Скилл")}"><span class="cm-hot-slot__key">${i + 1}</span>${skill?.icon || "✨"}<span class="cm-hot-slot__mana">${manaCost}</span></button>`;
                    }
                    return `<button class="cm-hot-slot cm-hot-slot--empty" type="button" data-action="quickbar-use" data-slot-index="${i}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="false"><span class="cm-hot-slot__key">${i + 1}</span></button>`;
                  }).join("")}</div></footer>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside class="cm-col cm-col--right">
          <section class="cm-panel">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Экипировка</h2>
            <div class="cm-panel__body"><div class="cm-equip-slots">${equipRows}</div></div>
          </section>
          <section class="cm-panel cm-panel--inventory">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Инвентарь</h2>
            <div class="cm-panel__body"><div class="cm-inv-wrap cm-scroll-wood"><div class="cm-inv-grid" data-bag-dropzone="true">${inventoryCellsHtml}</div></div></div>
          </section>
          <section class="cm-panel cm-panel--consumables">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Расходники</h2>
            <div class="cm-panel__body"><div class="cm-cons-wrap cm-scroll-wood"><div class="cm-cons-row">${consumableCellsHtml}</div></div></div>
          </section>
          <section class="cm-panel cm-panel--skills">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Скиллы</h2>
            <div class="cm-panel__body cm-panel__body--flex-grow"><div class="cm-skills-viewport cm-scroll-wood"><ul class="cm-skills">${skillsHtml}</ul></div></div>
          </section>
        </aside>
      </div>
    </div>
    ${renderModal()}
  `;

  run.hoverCell = state.uiHud.pathHoverCell || null;
  run.hoverCellEnemy = Boolean(state.uiHud.pathHoverEnemy);
  run.previewPathCells = state.uiHud.pathPreviewCells || [];
  run.lockedPathCells = state.uiHud.pathLockedCells || [];
  run.lockedPathTarget = state.uiHud.pathLockedTarget || null;
  run.lockedPathEnemyId = state.uiHud.pathLockedEnemyId || null;
  run.skillTargetCells = state.uiHud.skillTargeting?.targets || state.uiHud.trapTargeting?.targets || [];

  drawRunToCanvas(document.getElementById("newGameCanvas"), run, sheet, performance.now(), 1);
}

function renderEndingScreen() {
  const portrait = getPortraitById(state.selectedPortraitId);
  const run = state.run;
  const sheet = state.playerSheet;
  const isVictory = run?.status === "victory";
  const title = isVictory ? "Победа" : "Поражение";
  const subtitle = isVictory
    ? "Мышь добралась до норы и выбралась с добычей."
    : "HP опустилось до нуля, забег завершен.";
  const durationSec = Math.max(0, Math.floor((Date.now() - Number(state.uiNewRunStartedAtMs || Date.now())) / 1000));
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationLabel = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const equipTypes = ["weapon", "armor", "amulet"];
  const equipRows = equipTypes.map((type) => {
    const item = getItemById(sheet?.equippedByType?.[type]);
    return `
      <div class="cm-equip-slot">
        <span class="cm-equip-slot__label">${toRuType(type)}</span>
        <div class="cm-equip-slot__box ${item ? `item-rarity-${getItemRarity(item)}` : ""}" ${item ? `data-inventory-detail-item-id="${item.id}"` : ""}>
          <span class="cm-equip-slot__icon">${item?.icon || "—"}</span>
          ${type === "weapon" && item ? `<span class="cm-item-weapon-damage">${getWeaponDamageForSheet(sheet, item)}</span>` : ""}
        </div>
      </div>
    `;
  }).join("");

  root.innerHTML = `
    <div class="cm-app cm-ending-app">
      <div class="cm-main cm-ending-main">
        <aside class="cm-col cm-col--left">
          <section class="cm-panel cm-panel--fill">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Карточка героя</h2>
            <div class="cm-panel__body">
              <div class="cm-hero-portrait"><div class="cm-portrait-ring"><div class="cm-portrait-inner"><img src="${buildPortraitDataUri(portrait.fill)}" width="112" height="112" alt="${esc(portrait.name)}" /></div></div><div class="cm-level-badge">${sheet?.level || 1}</div></div>
              <div class="cm-bar cm-bar--hp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="../design/impl/icons/icon-hp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>HP</span><span>${sheet?.stats?.HP || 0} / ${sheet?.stats?.HP_MAX || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.stats?.HP || 0) / Math.max(1, sheet?.stats?.HP_MAX || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--mana"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="../design/impl/icons/icon-mana.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Мана</span><span>${sheet?.mana || 0} / ${sheet?.manaMax || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.mana || 0) / Math.max(1, sheet?.manaMax || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--xp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="../design/impl/icons/icon-xp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Опыт</span><span>${sheet?.xp || 0} / ${sheet?.xpToNext || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.xp || 0) / Math.max(1, sheet?.xpToNext || 1)) * 100)))}%"></div></div></div></div></div>
              <ul class="cm-stats">
                ${["STR", "INT", "AGI", "LUK"].map((k) => `<li class="cm-stat-row"><span class="cm-stat-icon">${getUiStatIcon(k)}</span><span class="cm-stat-name">${getUiStatName(k)}</span><span class="cm-stat-value">${Number(sheet?.stats?.[k] || 0)}</span><span class="cm-stat-plus-spacer"></span></li>`).join("")}
                <li class="cm-stat-row"><span class="cm-stat-icon">🎯</span><span class="cm-stat-name">Крит шанс</span><span class="cm-stat-value">${Number(sheet?.derived?.CRIT_CHANCE || 0)}%</span><span class="cm-stat-plus-spacer"></span></li>
                <li class="cm-stat-row"><span class="cm-stat-icon">💥</span><span class="cm-stat-name">Крит x</span><span class="cm-stat-value">${Number(sheet?.derived?.CRIT_MULT || 1)}x</span><span class="cm-stat-plus-spacer"></span></li>
              </ul>
            </div>
          </section>
        </aside>

        <main class="cm-col cm-col--center">
          <section class="cm-panel cm-panel--fill">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Итоги забега</h2>
            <div class="cm-panel__body cm-ending-summary">
              <div class="cm-ending-status ${isVictory ? "cm-ending-status--victory" : ""}">${title}</div>
              <p class="cm-ending-subtitle">${esc(subtitle)}</p>
              <div class="cm-ending-metrics">
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Длительность</span><span class="cm-ending-metric__value">${durationLabel}</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Ходов</span><span class="cm-ending-metric__value">${Number(run?.turns || 0)}</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Убито противников</span><span class="cm-ending-metric__value">—</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Пройдено уровней</span><span class="cm-ending-metric__value">${Number(run?.level || 1)}</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Открыто сундуков</span><span class="cm-ending-metric__value">—</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Подобрано предметов</span><span class="cm-ending-metric__value">—</span></div>
              </div>
            </div>
          </section>
        </main>

        <aside class="cm-col cm-col--right">
          <section class="cm-panel">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Снаряжение</h2>
            <div class="cm-panel__body"><div class="cm-equip-slots">${equipRows}</div></div>
          </section>
          <section class="cm-panel">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Побежденные боссы</h2>
            <div class="cm-panel__body">
              <ul class="cm-ending-loot">
                <li class="cm-ending-loot__item">🐈 Подвальный охотник</li>
                <li class="cm-ending-loot__item">👁 Слепой сторож</li>
                <li class="cm-ending-loot__item">🦴 Костяной мурчун</li>
                <li class="cm-ending-loot__item">👑 Кот-хозяин кладовки</li>
              </ul>
            </div>
          </section>
          <section class="cm-panel">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Дальше</h2>
            <div class="cm-panel__body cm-ending-actions">
              <button class="cm-btn cm-btn--primary" type="button" data-action="end-to-welcome">Новый забег</button>
              <button class="cm-btn cm-btn--secondary" type="button" data-action="open-devlog">Devlog</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
    ${renderModal()}
  `;
}

function resetToWelcome() {
  const reset = createInitialState();
  state.screen = reset.screen;
  state.preGameStats = reset.preGameStats;
  state.preGamePointsRemaining = reset.preGamePointsRemaining;
  state.playerSheet = null;
  state.starterLoadout = [];
  state.run = null;
  state.selectedPortraitId = "portrait_1";
  state.uiNewModal = null;
  state.uiNewStartMessage = "";
  state.uiNewRunStartedAtMs = null;
  inventoryPopover.hide();
  skillPopover.hide();
}

function performStep(direction) {
  if (state.screen !== "game" || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return false;
  }
  const result = tryStep(state.run, state.playerSheet, direction);
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  if (state.run && result.motion) {
    state.run.motion = result.motion;
  }

  if (state.run.status === "victory" || state.run.status === "defeat") {
    maybeTrackRunEnd();
    state.screen = "ending";
    render();
    return Boolean(result.actionConsumed);
  }

  if (result.actionConsumed) {
    consumeActionAndRunEnvironment();
  }
  render();
  return Boolean(result.actionConsumed);
}

function handleLevelTransition(nowMs) {
  if (!state.run || state.run.status !== "level_complete" || !state.run.levelTransition) {
    return;
  }
  if (state.run.levelTransition.startedMs == null) {
    state.run.levelTransition.startedMs = nowMs;
    return;
  }
  if (nowMs - state.run.levelTransition.startedMs < state.run.levelTransition.durationMs) {
    return;
  }
  state.run = createNextLevelRun(state.run, state.playerSheet);
  clearSkillTargeting();
  clearPathingState();
  render();
}

function consumeActionAndRunEnvironment() {
  if (!state.run || state.run.status !== "running" || state.run.turnPhase !== "player") {
    return;
  }
  clearSkillTargeting();
  beginEnvironmentTurn(state.run);
}

function tryMoveToCanvasCell(canvas, clientX, clientY) {
  if (state.screen !== "game" || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const cell = screenPointToGrid(state.run, localX, localY, rect.width, rect.height, 1);
  if (!cell || !isValidPathTargetCell(state.run, cell)) {
    return;
  }
  const path = buildPathToDiscoveredCell(
    state.run,
    { x: state.run.player.x, y: state.run.player.y },
    { x: cell.x, y: cell.y },
    { allowPlayer: true, allowGoal: true, blockObjects: true },
  );
  if (path.length < 2) {
    return;
  }
  const next = path[1];
  const direction = DIR_BY_DELTA[`${next.x - state.run.player.x}:${next.y - state.run.player.y}`];
  if (!direction) return;
  performStep(direction);
}

const canvasHandlers = createCanvasRunHandlers({
  getState: () => state,
  rerender: render,
  clearPathingState,
  performStep,
  tryStep,
  buildPathToDiscoveredCell,
  isValidPathTargetCell,
  screenPointToGrid,
  isPlayerInputBlocked,
  getItemById,
  getEnemyById,
  placeTrap,
  recalculateSheetFromInventory,
  consumePlayerActionAndStartEnvironment: consumeActionAndRunEnvironment,
  clearSkillTargeting,
  useSkillAtCell,
  snapshotProgress,
  maybeOpenSkillsOnNewPoint,
  maybeTriggerLevelUpPulse,
  pulseQuickbarSlot,
  trackSkillUse,
  normalizeFinishedAnimationsForRun,
  isBlockingMotionActive,
});

function initQuickbarForNewRun() {
  const slots = Array.from({ length: 9 }, () => null);
  const bag = state.playerSheet?.bag || [];
  let slotIndex = 0;

  const consumableIds = [];
  for (const entry of bag) {
    const item = getItemById(entry.itemId);
    if (!item || item.type !== "consumable") continue;
    if (!consumableIds.includes(item.id)) {
      consumableIds.push(item.id);
    }
  }
  for (const itemId of consumableIds) {
    if (slotIndex >= 9) break;
    slots[slotIndex] = { kind: "consumable", itemId };
    slotIndex += 1;
  }

  const learnedSkills = getCoreSkillDefs().filter((skill) => state.playerSheet?.skills?.[skill.id]?.learned);
  for (const skill of learnedSkills) {
    if (slotIndex >= 9) break;
    slots[slotIndex] = { kind: "skill", skillId: skill.id };
    slotIndex += 1;
  }
  state.uiHud.quickbarSlots = slots;
}

function normalizeQuickbarSlot(value) {
  if (!value) return null;
  if (value.kind === "consumable" && value.itemId) return value;
  if (value.kind === "skill" && value.skillId) return value;
  return null;
}

function findNearestEmptyQuickbarSlotIndex() {
  const slots = state.uiHud.quickbarSlots || [];
  for (let index = 0; index < 9; index += 1) {
    if (!slots[index]) return index;
  }
  return -1;
}

function isQuickbarPayloadAssigned(targetPayload) {
  const slots = state.uiHud.quickbarSlots || [];
  for (const slotValue of slots) {
    const slotPayload = normalizeQuickbarSlot(slotValue);
    if (!slotPayload || slotPayload.kind !== targetPayload.kind) continue;
    if (slotPayload.kind === "consumable" && slotPayload.itemId === targetPayload.itemId) return true;
    if (slotPayload.kind === "skill" && slotPayload.skillId === targetPayload.skillId) return true;
  }
  return false;
}

function assignQuickbarSlotIfAvailable(payload) {
  if (!payload || isQuickbarPayloadAssigned(payload)) return false;
  const slotIndex = findNearestEmptyQuickbarSlotIndex();
  if (slotIndex < 0) return false;
  const slots = [...(state.uiHud.quickbarSlots || [])];
  slots[slotIndex] = payload;
  state.uiHud.quickbarSlots = slots;
  return true;
}

function useConsumableById(itemId, bagInstanceId = null, bagIndex = -1) {
  if (!itemId || !state.playerSheet || !state.run || state.run.turnPhase !== "player") {
    return false;
  }
  const item = getItemById(itemId);
  if (!item || !item.isConsumable) {
    return false;
  }
  const nextBag = [...(state.playerSheet.bag || [])];
  let removeIndex = nextBag.findIndex((entry) => entry.itemId === itemId);
  if (removeIndex === -1 && bagInstanceId) {
    removeIndex = nextBag.findIndex((entry) => entry.instanceId === bagInstanceId);
  }
  if (removeIndex === -1 && bagIndex >= 0 && bagIndex < nextBag.length) {
    removeIndex = bagIndex;
  }
  if (removeIndex === -1) {
    return false;
  }

  if (item.isTrapItem) {
    const targets = getTrapPlacementCells(state.run);
    if (targets.length === 0) {
      state.run.lastLog = "Нет свободных соседних клеток для установки ловушки.";
      return false;
    }
    clearSkillTargeting();
    state.uiHud.trapTargeting = { itemId: item.id, bagRemoveIndex: removeIndex, targets };
    return false;
  }

  const result = useConsumable(state.run, state.playerSheet, item);
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  nextBag.splice(removeIndex, 1);
  state.playerSheet = recalculateSheetFromInventory(
    state.playerSheet,
    state.playerSheet.equippedByType,
    nextBag,
  );
  consumeActionAndRunEnvironment();
  return true;
}

function useQuickbarSlot(slotIndex) {
  if (!state.playerSheet || !state.run || state.run.turnPhase !== "player") {
    return;
  }
  const slotValue = state.uiHud.quickbarSlots?.[slotIndex];
  const slotPayload = normalizeQuickbarSlot(slotValue);
  if (!slotPayload) {
    return;
  }
  if (slotPayload.kind === "consumable") {
    clearSkillTargeting();
    useConsumableById(slotPayload.itemId, null, -1);
    return;
  }
  if (slotPayload.kind === "skill") {
    clearPathingState();
    const skillTargets = getSkillTargetCells(state.run, state.playerSheet, slotPayload.skillId);
    if (skillTargets.length === 0) {
      state.run.lastLog = "Нет доступной цели для скилла.";
      return;
    }
    const alreadyActive = state.uiHud.skillTargeting?.slotIndex === slotIndex;
    if (alreadyActive) {
      clearSkillTargeting();
    } else {
      state.uiHud.skillTargeting = {
        slotIndex,
        skillId: slotPayload.skillId,
        previousSkillPoints: state.playerSheet.skillPoints || 0,
        targets: skillTargets,
      };
      trackSkillUse(slotPayload.skillId);
    }
  }
}

function tryCastPreparedSkillOnSelf() {
  const targeting = state.uiHud.skillTargeting;
  if (!targeting?.skillId || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return;
  }
  const result = useSkillAtCell(
    state.run,
    state.playerSheet,
    targeting.skillId,
    state.run.player.x,
    state.run.player.y,
  );
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  clearSkillTargeting();
  if (result.actionConsumed) {
    consumeActionAndRunEnvironment();
  }
}

function onRootClick(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === "pregame-stat-plus" || action === "pregame-stat-minus") {
    state.uiHud.statHoverPreview = null;
    const stat = actionEl.dataset.stat;
    if (!["STR", "INT", "AGI", "LUK"].includes(stat)) return;
    const current = Number(state.preGameStats[stat] || 0);
    if (action === "pregame-stat-plus") {
      if (state.preGamePointsRemaining <= 0) return;
      state.preGameStats[stat] = current + 1;
      state.preGamePointsRemaining -= 1;
    } else {
      if (current <= 0) return;
      state.preGameStats[stat] = current - 1;
      state.preGamePointsRemaining += 1;
    }
    render();
    syncStatHoverPreviewFromPointer();
    return;
  }

  if (action === "toggle-starter-item") {
    const itemId = actionEl.dataset.itemId;
    state.starterLoadout = chooseStarterLoadoutItem(state.starterLoadout, itemId);
    render();
    return;
  }

  if (action === "select-portrait") {
    state.selectedPortraitId = actionEl.dataset.portraitId || state.selectedPortraitId;
    render();
    return;
  }

  if (action === "open-help") {
    state.uiNewModal = "help";
    render();
    return;
  }

  if (action === "open-devlog") {
    state.uiNewModal = "devlog";
    render();
    return;
  }

  if (action === "open-skills-modal" && state.screen === "game") {
    state.uiNewModal = "skills";
    if (!state.uiSkillChoice) {
      const options = buildSkillChoiceOptions(state.playerSheet);
      state.uiSkillChoice = {
        marker: `manual:${Date.now()}`,
        optionIds: options.map((s) => s.id),
        selectedSkillId: options.length === 1 ? options[0]?.id || null : null,
      };
    }
    render();
    return;
  }

  if (action === "close-modal") {
    if (state.uiNewModal === "skills") {
      return;
    }
    state.uiNewModal = null;
    render();
    return;
  }

  if (action === "start-game") {
    const hasAllTypes = ["weapon", "armor", "amulet"].every((type) =>
      state.starterLoadout.some((id) => getItemById(id)?.type === type),
    );
    if (state.preGamePointsRemaining !== 0 || !hasAllTypes) {
      return;
    }
    state.playerSheet = applyLoadoutToSheet(createPlayerSheet(state.preGameStats), state.starterLoadout);
    state.playerSheet = initializeInventoryForRun(state.playerSheet);
    state.run = createRunState(state.playerSheet, 1);
    state.run.analyticsRunId = createRunAnalyticsId();
    state.run.analyticsRunEndTracked = false;
    trackEvent("game_start", {
      class_id: null,
      run_id: state.run.analyticsRunId,
    });
    state.uiNewRunStartedAtMs = Date.now();
    initQuickbarForNewRun();
    state.screen = "game";
    state.uiNewStartMessage = "";
    render();
    return;
  }

  if (action === "use-consumable" && state.screen === "game" && state.run?.turnPhase === "player") {
    const itemId = actionEl.dataset.itemId;
    useConsumableById(itemId, null, -1);
    render();
    return;
  }

  if (action === "bag-item-action" && state.screen === "game" && state.run?.turnPhase === "player") {
    const itemId = actionEl.dataset.itemId;
    const bagInstanceId = actionEl.dataset.bagInstanceId;
    const bagIndexRaw = Number(actionEl.dataset.bagIndex);
    const bagIndex = Number.isInteger(bagIndexRaw) ? bagIndexRaw : -1;
    const item = getItemById(itemId);
    if (!item) return;
    if (item.isConsumable) {
      useConsumableById(item.id, bagInstanceId || null, bagIndex);
    } else {
      const previousSheet = state.playerSheet;
      state.playerSheet = swapItemFromBag(state.playerSheet, bagInstanceId, bagIndex);
      if (state.playerSheet !== previousSheet) {
        consumeActionAndRunEnvironment();
      }
    }
    render();
    return;
  }

  if (action === "equip-slot-action" && state.screen === "game" && state.run?.turnPhase === "player") {
    const equipType = actionEl.dataset.equipType;
    moveEquippedItemToBag(equipType);
    render();
    return;
  }

  if (action === "left-skill-use" && state.screen === "game" && state.run?.turnPhase === "player") {
    const skillId = actionEl.dataset.skillId;
    if (!skillId) return;
    clearPathingState();
    const targets = getSkillTargetCells(state.run, state.playerSheet, skillId);
    if (!targets.length) {
      state.run.lastLog = "Нет доступных клеток для применения.";
      render();
      return;
    }
    state.uiHud.skillTargeting = {
      slotIndex: null,
      skillId,
      previousSkillPoints: state.playerSheet.skillPoints || 0,
      targets,
    };
    trackSkillUse(skillId);
    render();
    return;
  }

  if (action === "quickbar-use" && state.screen === "game" && state.run?.turnPhase === "player") {
    const slotIndex = Number(actionEl.dataset.slotIndex);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) return;
    useQuickbarSlot(slotIndex);
    render();
    return;
  }

  if (action === "select-skill-choice" && state.screen === "game") {
    const skillId = actionEl.dataset.skillId;
    if (!skillId) return;
    if (!state.uiSkillChoice) {
      const options = buildSkillChoiceOptions(state.playerSheet);
      state.uiSkillChoice = {
        marker: `manual:${Date.now()}`,
        optionIds: options.map((s) => s.id),
        selectedSkillId: null,
      };
    }
    state.uiSkillChoice.selectedSkillId = skillId;
    render();
    return;
  }

  if (action === "confirm-skill-choice" && state.screen === "game") {
    const skillId = state.uiSkillChoice?.selectedSkillId;
    const skillDef = getCoreSkillDefs().find((skill) => skill.id === skillId);
    const skillState = state.playerSheet?.skills?.[skillId];
    if (!skillDef || !skillState || (state.playerSheet.skillPoints || 0) <= 0) return;
    if ((skillState.level || 0) >= (skillDef.maxLevel || 1)) return;
    const wasLearned = Boolean(skillState.learned);
    skillState.learned = true;
    skillState.level = Number(skillState.level || 0) + 1;
    state.playerSheet.skillPoints -= 1;
    if (!wasLearned) {
      assignQuickbarSlotIfAvailable({ kind: "skill", skillId });
    }
    state.uiNewModal = null;
    state.uiSkillChoice = null;
    render();
    return;
  }

  if (action === "upgrade-stat" && state.playerSheet && state.screen === "game") {
    state.uiHud.statHoverPreview = null;
    const stat = actionEl.dataset.stat;
    if (["STR", "INT", "AGI", "LUK"].includes(stat)) {
      state.playerSheet = spendLevelUpPoint(state.playerSheet, stat);
      render();
      syncStatHoverPreviewFromPointer();
    }
    return;
  }

  if (action === "secret-level-up" && state.playerSheet && state.screen === "game") {
    const currentXp = Number(state.playerSheet.xp || 0);
    const xpToNext = Math.max(1, Number(state.playerSheet.xpToNext || 1));
    const xpNeededForLevelUp = Math.max(1, xpToNext - currentXp);
    const levelBefore = Number(state.playerSheet.level || 1);
    const result = applyXpGain(state.playerSheet, xpNeededForLevelUp);
    state.playerSheet = result.playerSheet;
    if (Number(state.playerSheet.level || 1) > levelBefore && state.run) {
      state.run.lastLog = `Скрытый бонус: уровень повышен до ${state.playerSheet.level}.`;
    }
    render();
    return;
  }

  if (action === "back-to-welcome" || action === "end-to-welcome") {
    resetToWelcome();
    render();
    return;
  }
}

function updateStatHoverPreviewFromTarget(target) {
  const previewEl = target?.closest?.("[data-preview-stat]");
  if (!previewEl || previewEl.disabled) {
    if (state.uiHud.statHoverPreview) {
      state.uiHud.statHoverPreview = null;
      render();
    }
    return;
  }
  const stat = previewEl.dataset.previewStat;
  const screen = previewEl.dataset.previewScreen;
  const delta = Number(previewEl.dataset.previewDelta);
  if (!stat || !Number.isFinite(delta) || !screen) return;
  const prev = state.uiHud.statHoverPreview || {};
  if (prev.stat === stat && prev.delta === delta && prev.screen === screen) return;
  state.uiHud.statHoverPreview = { stat, delta, screen };
  render();
}

function updateItemHoverPreviewFromTarget(target) {
  const previewEl = target?.closest?.("[data-preview-item-id]");
  if (!previewEl) {
    if (state.uiHud.itemHoverPreview) {
      state.uiHud.itemHoverPreview = null;
      render();
    }
    return;
  }
  const itemId = previewEl.dataset.previewItemId;
  const screen = previewEl.dataset.previewItemScreen;
  const bagInstanceId = previewEl.dataset.previewItemBagInstanceId || null;
  if (!itemId || !screen) return;
  const prev = state.uiHud.itemHoverPreview || {};
  if (prev.itemId === itemId && prev.screen === screen && prev.bagInstanceId === bagInstanceId) {
    return;
  }
  state.uiHud.itemHoverPreview = { itemId, screen, bagInstanceId };
  render();
}

function syncStatHoverPreviewFromPointer() {
  if (!Number.isFinite(lastPointerClientX) || !Number.isFinite(lastPointerClientY)) {
    return;
  }
  const target = document.elementFromPoint(lastPointerClientX, lastPointerClientY);
  updateStatHoverPreviewFromTarget(target);
}

function clearDragUiState() {
  root.querySelectorAll(".cm-equip-slot__box--drop-target").forEach((el) => {
    el.classList.remove("cm-equip-slot__box--drop-target");
  });
}

function applyEquipDropTargetHighlight(payload) {
  if (!payload || payload.kind !== "bag-equip" || !payload.itemType) {
    return;
  }
  root.querySelectorAll(`[data-equip-type="${payload.itemType}"]`).forEach((el) => {
    el.classList.add("cm-equip-slot__box--drop-target");
  });
}

function moveEquippedItemToBag(equipType) {
  if (!state.playerSheet || !state.run || state.run.turnPhase !== "player") {
    return false;
  }
  if (!equipType || !["weapon", "armor", "amulet"].includes(equipType)) {
    return false;
  }
  const equippedId = state.playerSheet.equippedByType?.[equipType];
  if (!equippedId) return false;
  const equippedInstanceByType = { ...(state.playerSheet.equippedInstanceByType || {}) };
  const instanceId = equippedInstanceByType[equipType] || `item_runtime_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const nextEquippedByType = { ...(state.playerSheet.equippedByType || {}) };
  nextEquippedByType[equipType] = null;
  equippedInstanceByType[equipType] = null;
  const nextBag = [...(state.playerSheet.bag || []), { instanceId, itemId: equippedId }];
  state.playerSheet = recalculateSheetFromInventory(
    { ...state.playerSheet, equippedInstanceByType },
    nextEquippedByType,
    nextBag,
    equippedInstanceByType,
  );
  consumeActionAndRunEnvironment();
  return true;
}

function onRootDragStart(event) {
  const quickbarSlot = event.target.closest("[data-drag-kind='quick-slot']");
  if (quickbarSlot) {
    const slotIndex = Number(quickbarSlot.dataset.dragSlotIndex);
    if (!Number.isInteger(slotIndex) || !state.uiHud.quickbarSlots?.[slotIndex]) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "quick-slot", slotIndex };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `quick-slot:${slotIndex}`);
    return;
  }

  const consumable = event.target.closest("[data-drag-kind='consumable']");
  if (consumable) {
    const itemId = consumable.dataset.dragItemId;
    if (!itemId) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "consumable", itemId };
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", `consumable:${itemId}`);
    return;
  }

  const equipItem = event.target.closest("[data-drag-kind='bag-equip']");
  if (equipItem) {
    const bagInstanceId = equipItem.dataset.dragBagInstanceId;
    const itemType = equipItem.dataset.dragItemType;
    if (!bagInstanceId || !itemType) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "bag-equip", bagInstanceId, itemType };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `bag-equip:${bagInstanceId}`);
    clearDragUiState();
    applyEquipDropTargetHighlight(state.uiHud.dragPayload);
    return;
  }

  const equippedItem = event.target.closest("[data-drag-kind='equipped-item']");
  if (equippedItem) {
    const equipType = equippedItem.dataset.dragEquipType;
    if (!equipType) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "equipped-item", equipType };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `equipped-item:${equipType}`);
    return;
  }

  const skill = event.target.closest("[data-drag-kind='skill']");
  if (!skill) return;
  const skillId = skill.dataset.dragSkillId;
  if (!skillId) {
    event.preventDefault();
    return;
  }
  state.uiHud.dragPayload = { kind: "skill", skillId };
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("text/plain", `skill:${skillId}`);
}

function onRootDragOver(event) {
  clearDragUiState();
  const quickbarSlot = event.target.closest("[data-slot-index]");
  const equipSlot = event.target.closest("[data-equip-type]");
  const bagDropzone = event.target.closest("[data-bag-dropzone]");
  const payload = state.uiHud.dragPayload;
  applyEquipDropTargetHighlight(payload);
  if (!payload || (!quickbarSlot && !equipSlot && !bagDropzone)) {
    return;
  }
  if (equipSlot) {
    const equipType = equipSlot.dataset.equipType;
    if (payload.kind !== "bag-equip" || !equipType || payload.itemType !== equipType) {
      return;
    }
    equipSlot.classList.add("cm-equip-slot__box--drop-target");
  }
  if (bagDropzone && payload.kind !== "equipped-item") {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function onRootDrop(event) {
  const bagDropzone = event.target.closest("[data-bag-dropzone]");
  if (bagDropzone && state.uiHud.dragPayload?.kind === "equipped-item") {
    event.preventDefault();
    const moved = moveEquippedItemToBag(state.uiHud.dragPayload.equipType);
    state.uiHud.dragPayload = null;
    clearDragUiState();
    if (moved) {
      render();
    }
    return;
  }

  const equipSlot = event.target.closest("[data-equip-type]");
  if (equipSlot && state.uiHud.dragPayload?.kind === "bag-equip") {
    const equipType = equipSlot.dataset.equipType;
    const payload = state.uiHud.dragPayload;
    if (state.playerSheet && state.run && state.run.turnPhase === "player" && equipType && payload.itemType === equipType && payload.bagInstanceId) {
      event.preventDefault();
      const previousSheet = state.playerSheet;
      state.playerSheet = swapItemFromBag(state.playerSheet, payload.bagInstanceId, -1);
      if (state.playerSheet !== previousSheet) {
        consumeActionAndRunEnvironment();
      }
      state.uiHud.dragPayload = null;
      clearDragUiState();
      render();
      return;
    }
  }

  const quickbarSlot = event.target.closest("[data-slot-index]");
  if (!quickbarSlot || !state.uiHud.dragPayload) return;
  const targetSlot = Number(quickbarSlot.dataset.slotIndex);
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot > 8) {
    state.uiHud.dragPayload = null;
    clearDragUiState();
    return;
  }
  event.preventDefault();
  const slots = [...(state.uiHud.quickbarSlots || [])];
  const payload = state.uiHud.dragPayload;
  if (payload.kind === "consumable" && payload.itemId) slots[targetSlot] = { kind: "consumable", itemId: payload.itemId };
  if (payload.kind === "skill" && payload.skillId) slots[targetSlot] = { kind: "skill", skillId: payload.skillId };
  if (payload.kind === "quick-slot" && Number.isInteger(payload.slotIndex)) {
    const sourceSlot = payload.slotIndex;
    if (sourceSlot !== targetSlot) {
      const tmp = slots[targetSlot] || null;
      slots[targetSlot] = slots[sourceSlot] || null;
      slots[sourceSlot] = tmp;
    }
  }
  state.uiHud.quickbarSlots = slots;
  state.uiHud.dragPayload = null;
  clearDragUiState();
  render();
}

function onRootDragEnd(event) {
  const payload = state.uiHud.dragPayload;
  if (payload?.kind === "quick-slot" && Number.isInteger(payload.slotIndex) && event.dataTransfer?.dropEffect === "none") {
    const slots = [...(state.uiHud.quickbarSlots || [])];
    slots[payload.slotIndex] = null;
    state.uiHud.quickbarSlots = slots;
    state.uiHud.dragPayload = null;
    clearDragUiState();
    render();
    return;
  }
  state.uiHud.dragPayload = null;
  clearDragUiState();
}

root.addEventListener("click", onRootClick);
root.addEventListener("dragstart", onRootDragStart);
root.addEventListener("dragover", onRootDragOver);
root.addEventListener("drop", onRootDrop);
root.addEventListener("dragend", onRootDragEnd);
root.addEventListener("mouseup", (event) => {
  const canvas = event.target.closest("#newGameCanvas");
  if (!canvas) return;
  const nowMs = performance.now();
  if (nowMs - Number(state.uiNewLastCanvasClickAtMs || 0) < 140) {
    return;
  }
  state.uiNewLastCanvasClickAtMs = nowMs;
  if (state.uiHud.autoMoveActive) {
    clearPathingState();
    if (state.run?.status === "running") {
      state.run.lastLog = "Автодвижение отменено.";
    }
    render();
    return;
  }
  canvasHandlers.onCanvasClick(event, canvas);
});
root.addEventListener("mousemove", (event) => {
  lastPointerClientX = Number(event.clientX || 0);
  lastPointerClientY = Number(event.clientY || 0);
  updateItemHoverPreviewFromTarget(event.target);
  updateStatHoverPreviewFromTarget(event.target);
  queueInventoryPopoverUpdate(event);
  queueSkillPopoverUpdate(event);
  const canvas = event.target.closest("#newGameCanvas");
  if (!canvas) return;
  canvasHandlers.onCanvasMouseMove(event, canvas);
});
root.addEventListener("mouseout", (event) => {
  if (event.target.closest("[data-preview-item-id]") && !event.relatedTarget?.closest?.("[data-preview-item-id]")) {
    updateItemHoverPreviewFromTarget(null);
  }
  if (event.target.closest("[data-preview-stat]") && !event.relatedTarget?.closest?.("[data-preview-stat]")) {
    updateStatHoverPreviewFromTarget(null);
  }
  if (inventoryHoverShowTimer) {
    clearTimeout(inventoryHoverShowTimer);
    inventoryHoverShowTimer = null;
  }
  if (skillHoverShowTimer) {
    clearTimeout(skillHoverShowTimer);
    skillHoverShowTimer = null;
  }
  const toTarget = event.relatedTarget;
  const stillInsideDetail = toTarget?.closest?.("[data-inventory-detail-item-id]");
  if (!stillInsideDetail) {
    inventoryPopover.scheduleHide();
  }
  const stillInsideSkillDetail = toTarget?.closest?.("[data-skill-detail-id]");
  if (!stillInsideSkillDetail) {
    skillPopover.scheduleHide();
  }
  if (event.target.closest("#newGameCanvas") && !event.relatedTarget?.closest?.("#newGameCanvas")) {
    canvasHandlers.onCanvasMouseLeave();
  }
});
window.addEventListener("keydown", (event) => {
  if (state.screen !== "game") return;
  if (!state.run || state.run.turnPhase !== "player") return;

  const quickSlot = resolveQuickbarSlotIndexFromKeyboardEvent(event);
  if (quickSlot != null) {
    event.preventDefault();
    useQuickbarSlot(quickSlot);
    render();
    return;
  }

  if (event.code === "Space" || event.key === " ") {
    event.preventDefault();
    if (state.uiHud.trapTargeting?.itemId) {
      state.run.lastLog = "Выбери клетку мышью для установки ловушки.";
      render();
      return;
    }
    if (state.uiHud.skillTargeting?.skillId) {
      tryCastPreparedSkillOnSelf();
      render();
      return;
    }
    state.run.lastLog = "Ход пропущен.";
    consumeActionAndRunEnvironment();
    render();
    return;
  }

  if (state.uiHud.skillTargeting?.skillId || state.uiHud.trapTargeting?.itemId) {
    return;
  }

  const direction = resolveMoveDirectionFromEvent(event);
  if (!direction) return;
  event.preventDefault();
  performStep(direction);
});
window.addEventListener("resize", () => {
  if (uiNewResizeTimer) {
    clearTimeout(uiNewResizeTimer);
  }
  uiNewResizeTimer = setTimeout(() => {
    if (state.screen === "game") {
      render();
    }
  }, 120);
});
startAnimationLoop((nowMs) => {
  if (state.screen === "game") {
    handleLevelTransition(nowMs);
    maybeTrackRunEnd();
    const canvas = document.getElementById("newGameCanvas");
    if (canvas && state.run && state.playerSheet) {
      if (state.run.motion) {
        if (state.run.motion.startMs == null) {
          state.run.motion.startMs = nowMs;
        } else if (nowMs - state.run.motion.startMs >= state.run.motion.durationMs) {
          state.run.motion = null;
        }
      }
      if (state.run.environmentMotion) {
        if (state.run.environmentMotion.startMs == null) {
          state.run.environmentMotion.startMs = nowMs;
        } else if (nowMs - state.run.environmentMotion.startMs >= state.run.environmentMotion.durationMs) {
          state.run.environmentMotion = null;
        }
      }

      if (
        state.run.turnPhase === "environment"
        && state.run.status === "running"
        && !state.run.motion
        && !state.run.environmentMotion
      ) {
        const envResult = stepEnvironmentTurn(state.run, state.playerSheet);
        state.run = envResult.run;
        state.playerSheet = envResult.playerSheet;
        if (state.run?.status === "defeat" || state.run?.status === "victory") {
          maybeTrackRunEnd();
          state.screen = "ending";
          render();
          return;
        }
        if (envResult.finished) {
          render();
          return;
        }
      }

      state.run.hoverCell = state.uiHud.pathHoverCell || null;
      state.run.hoverCellEnemy = Boolean(state.uiHud.pathHoverEnemy);
      state.run.previewPathCells = state.uiHud.pathPreviewCells || [];
      state.run.lockedPathCells = state.uiHud.pathLockedCells || [];
      state.run.lockedPathTarget = state.uiHud.pathLockedTarget || null;
      state.run.lockedPathEnemyId = state.uiHud.pathLockedEnemyId || null;
      state.run.skillTargetCells = state.uiHud.skillTargeting?.targets || state.uiHud.trapTargeting?.targets || [];
      drawRunToCanvas(canvas, state.run, state.playerSheet, nowMs, 1);
    }
    canvasHandlers.maybeRunAutoMoveStep();
  }
});
render();
