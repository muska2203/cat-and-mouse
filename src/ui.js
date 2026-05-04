import { createPlayerSheet } from "./state.js?v=0.4.4-pre-alpha";
import { PRE_GAME_STAT_POINTS } from "./state.js?v=0.4.4-pre-alpha";
import { EQUIP_TYPES } from "./loadout.js?v=0.4.4-pre-alpha";
import { getItemById } from "./loadout.js?v=0.4.4-pre-alpha";
import { applyLoadoutToSheet } from "./loadout.js?v=0.4.4-pre-alpha";
import { getStarterCommonItems } from "./loadout.js?v=0.4.4-pre-alpha";
import { STARTER_LOADOUT_MAX } from "./loadout.js?v=0.4.4-pre-alpha";
import { spendLevelUpPoint } from "./loadout.js?v=0.4.4-pre-alpha";
import { swapItemFromBag } from "./loadout.js?v=0.4.4-pre-alpha";
import { APP_TITLE } from "./app-config.js?v=0.4.4-pre-alpha";
import { APP_VERSION } from "./app-config.js?v=0.4.4-pre-alpha";
import { getSkillById, getCoreSkillDefs, getSkillHoverText } from "./skills.js?v=0.4.4-pre-alpha";
import { roundStat } from "./rules.js?v=0.4.4-pre-alpha";
import {
  STRINGS_RU,
  welcomeSubtitleAlloc,
  welcomeSubtitleCounters,
  gameSubtitleRun,
  endingSubtitleTurns,
  endingSubtitleMaze,
  endingSubtitleChar,
  skillsModalSubtitle,
  quickbarSlotTitle,
  activeEffectBandageRemaining,
  activeEffectStacksLine,
  localizeStatText,
} from "./strings/ru.js?v=0.4.4-pre-alpha";
import { getConsumableHoverText } from "./items/itemPresentation.js?v=0.4.4-pre-alpha";
import { getStatDescriptionRu } from "./player/statCopy.js?v=0.4.4-pre-alpha";

const STAT_LABELS_RU = {
  STR: "СИЛ",
  INT: "ИНТ",
  AGI: "ЛВК",
  LUK: "УДЧ",
  HP_MAX: "HP МАКС",
  HP: "HP",
  baseHP: "БАЗ HP",
  HP_MAX_COMPUTED: "HP МАКС (Ф)",
  CRIT_CHANCE: "КРИТ %",
  CRIT_MULT: "КРИТ Х",
  WEAPON_DM: "УРОН ОРУЖ",
};
const STAT_LABELS_COMPACT = {
  STR: "СИЛ",
  INT: "ИНТ",
  AGI: "ЛВК",
  LUK: "УДЧ",
  HP_MAX: "HP",
  HP: "HP",
};
const BONUS_SORT_ORDER = [
  "STR",
  "INT",
  "AGI",
  "LUK",
  "HP_MAX",
  "CRIT_CHANCE",
  "CRIT_MULT",
];
const SUBTYPE_SORT_ORDER_BY_TYPE = {
  weapon: ["sword", "staff"],
  armor: ["armor", "cloak"],
  amulet: ["tooth", "bead"],
  consumable: ["heal_hp", "heal_mana", "heal_hybrid", "buff", "trap"],
};

function renderPregameItemCardStats(item) {
  if (!item) {
    return "";
  }
  const chunks = [];
  const bonuses = formatItemBonuses(item);
  if (bonuses && bonuses !== "ЭФ") {
    chunks.push(`<div class="pregame-item-bonuses">${bonuses}</div>`);
  }
  if (item.type === "weapon") {
    const wd = item.weaponDamage != null ? roundStat(item.weaponDamage) : "—";
    const cc = item.weaponCritChance != null ? roundStat(item.weaponCritChance) : "—";
    const cm = item.weaponCritMult != null ? roundStat(item.weaponCritMult) : "—";
    chunks.push(
      `<div class="pregame-item-weapon-line">Урон ${wd} · крит ${cc}% · ×${cm}</div>`,
    );
  }
  const equipTypes = new Set(["weapon", "armor", "amulet"]);
  if (item.effectText && !equipTypes.has(item.type)) {
    chunks.push(`<div class="pregame-item-effect">${localizeStatText(item.effectText)}</div>`);
  }
  if (chunks.length === 0) {
    return "";
  }
  return `<div class="pregame-item-stats">${chunks.join("")}</div>`;
}

function sortStarterCommonItemsLikeBag(items) {
  const sectionOrder = ["weapon", "armor", "amulet", "consumable"];
  const buckets = new Map(sectionOrder.map((t) => [t, []]));
  for (const item of items) {
    const t = item.type === "consumable" ? "consumable" : item.type;
    if (!buckets.has(t)) {
      continue;
    }
    buckets.get(t).push(item);
  }
  const out = [];
  for (const t of sectionOrder) {
    const arr = [...(buckets.get(t) || [])];
    arr.sort(compareItemsByRarityThenId);
    out.push(...arr);
  }
  return out;
}

function formatDisplayedNumericStat(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return value;
  }
  return Number(value.toFixed(2));
}

function getDerivedPanelValue(playerSheet, key) {
  if (!playerSheet) return 0;
  if (key === "HP_MAX") {
    return Number(playerSheet.stats?.HP_MAX ?? 0);
  }
  if (key === "WEAPON_DM") {
    return Number(playerSheet.derived?.WEAPON_DAMAGE ?? 0);
  }
  return Number(playerSheet.derived?.[key] ?? 0);
}

function listSkillsForUi(_playerSheet) {
  return getCoreSkillDefs();
}

export function renderApp(root, state) {
  if (state.screen === "welcome") {
    root.innerHTML = renderWelcomeScreen(state);
    return;
  }

  if (state.screen === "game") {
    root.innerHTML = renderGameScreen(state);
    return;
  }

  if (state.screen === "ending") {
    root.innerHTML = renderEndingScreen(state);
    return;
  }

  root.innerHTML = `
    <section class="screen">
      <h1 class="screen-title">${STRINGS_RU.fallbackScreen.title}</h1>
      <p class="screen-subtitle">${STRINGS_RU.fallbackScreen.subtitle}</p>
    </section>
  `;
}

function renderWelcomeScreen(state) {
  const selectedSheet = applyLoadoutToSheet(createPlayerSheet(state.preGameStats), state.starterLoadout);

  const statKeys = ["STR", "INT", "AGI", "LUK"];
  const statAllocationMarkup = statKeys
    .map((key) => {
      const value = state.preGameStats[key] || 0;
      return `
        <li class="pregame-stat-row">
          <span>${toRuStatName(key)}</span>
          <div class="pregame-stat-controls">
            <button type="button" class="btn" data-action="pregame-stat-minus" data-stat="${key}" ${value <= 0 ? "disabled" : ""}>−</button>
            <strong>${value}</strong>
            <button type="button" class="btn" data-action="pregame-stat-plus" data-stat="${key}" ${state.preGamePointsRemaining <= 0 ? "disabled" : ""}>+</button>
          </div>
        </li>`;
    })
    .join("");

  const starterItems = sortStarterCommonItemsLikeBag(getStarterCommonItems());
  const starterPickCount = state.starterLoadout.length;
  const starterGridMarkup = starterItems
    .map((item) => {
      const selected = state.starterLoadout.includes(item.id);
      const atCap = starterPickCount >= STARTER_LOADOUT_MAX && !selected;
      const cls = ["pregame-item-btn", selected ? "pregame-item-selected" : "", atCap ? "pregame-item-locked" : ""]
        .filter(Boolean)
        .join(" ");
      return `
        <button type="button" class="${cls}" data-action="toggle-starter-item" data-item-id="${item.id}" ${atCap ? "disabled" : ""} title="${getItemHoverText(item)}">
          <span class="bag-icon-glyph">${item.icon || getItemIcon(item.type)}</span>
          <span class="pregame-item-name">${item.name}</span>
          ${renderPregameItemCardStats(item)}
        </button>`;
    })
    .join("");

  const canStart = state.preGamePointsRemaining === 0;

  return `
    <section class="screen" aria-label="${STRINGS_RU.welcome.ariaScreen}">
      <h1 class="screen-title screen-title-centered">${STRINGS_RU.welcome.title}</h1>
      <p class="screen-subtitle screen-title-centered">${welcomeSubtitleAlloc(PRE_GAME_STAT_POINTS, STARTER_LOADOUT_MAX)}</p>
      <p class="screen-subtitle screen-title-centered">${welcomeSubtitleCounters(state.preGamePointsRemaining, starterPickCount, STARTER_LOADOUT_MAX)}</p>
      <div class="sheet-grid">
        <article class="class-card">
          <h3>${STRINGS_RU.welcome.cardStats}</h3>
          <ul class="stats-list">
            ${statAllocationMarkup}
          </ul>
          <section class="stats-group">
            <h4>${STRINGS_RU.welcome.cardDerived}</h4>
            <ul class="stats-list">
              ${renderStatsList({
                HP_MAX: selectedSheet?.stats?.HP_MAX ?? 0,
                CRIT_CHANCE: selectedSheet?.derived?.CRIT_CHANCE ?? 0,
                CRIT_MULT: selectedSheet?.derived?.CRIT_MULT ?? 1,
                WEAPON_DM: selectedSheet?.derived?.WEAPON_DAMAGE ?? 0,
              }, selectedSheet)}
            </ul>
          </section>
        </article>
        <article class="class-card pregame-items-card">
          <h3>${STRINGS_RU.welcome.cardStarters}</h3>
          <div class="pregame-item-grid">
            ${starterGridMarkup}
          </div>
        </article>
      </div>
      <button class="btn btn-primary" type="button" data-action="start-game" ${canStart ? "" : "disabled"}>
        ${STRINGS_RU.welcome.startGame}
      </button>
      ${renderBuildBadge()}
      ${state.uiHud?.helpOpen ? renderHelpModal() : ""}
    </section>
  `;
}

function renderGameScreen(state) {
  if (!state.run) {
    return `
      <section class="screen">
        <h1 class="screen-title">${STRINGS_RU.game.noRunTitle}</h1>
        <p class="screen-subtitle">${STRINGS_RU.game.noRunSubtitle}</p>
      </section>
    `;
  }

  return `
    <section class="screen screen-game" aria-label="${STRINGS_RU.game.ariaScreen}">
      <h1 class="screen-title">${STRINGS_RU.game.title}</h1>
      <p class="screen-subtitle">
        ${gameSubtitleRun(state.run.level, state.run.maxLevel, state.run.width, state.run.height, state.run.turns)}
      </p>
      <div class="game-layout">
        ${renderInventoryPanel(state)}
        <div class="play-panel">
          ${renderTurnPhaseBadge(state.run)}
          <canvas id="gameCanvas" class="game-canvas" width="800" height="500"></canvas>
          ${renderActiveEffects(state)}
          ${renderQuickbar(state)}
          <div class="mobile-controls" aria-label="${STRINGS_RU.game.mobileControlsAria}">
            <button class="btn mobile-move-btn mobile-up" type="button" data-action="mobile-move" data-direction="up">▲</button>
            <button class="btn mobile-move-btn mobile-left" type="button" data-action="mobile-move" data-direction="left">◀</button>
            <button class="btn mobile-move-btn mobile-down" type="button" data-action="mobile-move" data-direction="down">▼</button>
            <button class="btn mobile-move-btn mobile-right" type="button" data-action="mobile-move" data-direction="right">▶</button>
          </div>
        </div>
        <article class="class-card game-side">
          <h3>${STRINGS_RU.game.sidePanelTitle}</h3>
          ${renderHpBar(state.playerSheet)}
          ${renderManaBar(state.playerSheet)}
          ${renderXpBar(state.playerSheet)}
          <p class="progression-line ${state.uiHud?.levelUpPulseUntil ? "progression-line-pulse" : ""}">${STRINGS_RU.game.levelLine} <span data-action="debug-level-up">${state.playerSheet?.level ?? 1}</span></p>
          <p class="progression-line ${state.uiHud?.levelUpPulseUntil ? "progression-line-pulse" : ""}">${STRINGS_RU.game.pointsLine} ${state.playerSheet?.unspentPoints ?? 0}</p>
          <section class="stats-group">
            <h4>${STRINGS_RU.game.statsGroup}</h4>
            <ul class="stats-list">
              ${renderBaseAndTotalStatsWithUpgrades(state.playerSheet, state.uiHud)}
            </ul>
          </section>
          <section class="stats-group">
            <h4>${STRINGS_RU.game.derivedGroup}</h4>
            <ul class="stats-list">
              ${renderDerivedStatsWithPreview(state.playerSheet, state.uiHud)}
            </ul>
          </section>
          <p class="run-log">${state.run.lastLog || STRINGS_RU.game.runLogEmpty}</p>
        </article>
      </div>
      ${state.uiHud?.skillsPanelOpen ? renderSkillsModal(state) : ""}
      ${renderBuildBadge()}
      ${state.uiHud?.helpOpen ? renderHelpModal() : ""}
    </section>
  `;
}

function renderTurnPhaseBadge(run) {
  const isPlayerTurn = run?.turnPhase !== "environment";
  return `
    <div class="turn-phase-badge ${isPlayerTurn ? "turn-phase-player" : "turn-phase-environment"}">
      ${isPlayerTurn ? STRINGS_RU.turnPhase.player : STRINGS_RU.turnPhase.environment}
    </div>
  `;
}

function renderEndingScreen(state) {
  if (!state.run || !state.playerSheet) {
    return `
      <section class="screen">
        <h1 class="screen-title">${STRINGS_RU.ending.missingTitle}</h1>
        <p class="screen-subtitle">${STRINGS_RU.ending.missingSubtitle}</p>
      </section>
    `;
  }

  const title = state.run.status === "victory" ? STRINGS_RU.ending.victoryTitle : STRINGS_RU.ending.defeatTitle;
  const subtitle =
    state.run.status === "victory"
      ? STRINGS_RU.ending.victorySubtitle
      : STRINGS_RU.ending.defeatSubtitle;

  const equipped = EQUIP_TYPES.map((type) => {
    const itemId = state.playerSheet.equippedByType?.[type];
    const item = itemId ? getItemById(itemId) : null;
    return `<li><span>${toRuType(type)}</span><strong>${item ? item.name : STRINGS_RU.ending.bagEmptyLabel}</strong></li>`;
  }).join("");

  const bagItems = (state.playerSheet.bag || [])
    .map((entry) => getItemById(entry.itemId))
    .filter(Boolean)
    .map((item) => `<li><span>${item.icon || getItemIcon(item.type)}</span><strong>${item.name}</strong></li>`)
    .join("");

  return `
    <section class="screen" aria-label="${STRINGS_RU.ending.ariaScreen}">
      <h1 class="screen-title">${title}</h1>
      <p class="screen-subtitle">${endingSubtitleTurns(subtitle, state.run.turns)}</p>
      <p class="screen-subtitle">${endingSubtitleMaze(state.run.level, state.run.maxLevel)}</p>
      <p class="screen-subtitle">${endingSubtitleChar(state.playerSheet.level, state.playerSheet.xp, state.playerSheet.xpToNext)}</p>
      <div class="sheet-grid">
        <article class="class-card">
          <h3>${STRINGS_RU.ending.cardStats}</h3>
          <ul class="stats-list">
            ${renderStatsList(buildFullStats(state.playerSheet), state.playerSheet)}
          </ul>
        </article>
        <article class="class-card">
          <h3>${STRINGS_RU.ending.cardEquip}</h3>
          <ul class="stats-list">
            ${equipped}
          </ul>
        </article>
        <article class="class-card">
          <h3>${STRINGS_RU.ending.cardBag}</h3>
          <ul class="stats-list">
            ${bagItems || STRINGS_RU.ending.bagEmptyRow}
          </ul>
        </article>
      </div>
      <div class="controls-row">
        <button class="btn btn-primary" type="button" data-action="end-to-welcome">${STRINGS_RU.ending.toWelcome}</button>
      </div>
      ${renderBuildBadge()}
      ${state.uiHud?.helpOpen ? renderHelpModal() : ""}
    </section>
  `;
}

function renderInventoryPanel(state) {
  const equipped = state.playerSheet?.equippedByType || {};
  const bagEntries = state.playerSheet?.bag || [];

  const slots = EQUIP_TYPES.map((type) => {
    const itemId = equipped[type];
    const item = itemId ? getItemById(itemId) : null;
    const equippedBonus = item ? formatItemBonuses(item, item) : "—";
    const rarityClass = item ? ` item-rarity-${getItemRarity(item)}` : "";
    return `
      <li class="slot-item">
        <span class="slot-name">${toRuType(type)}</span>
        ${item
          ? `
            <div
              class="bag-icon slot-equipped-card${rarityClass}"
              data-equip-type="${type}"
              data-inventory-detail-item-id="${item.id}"
              aria-label="${escapeAttr(item.name)}"
            >
              <span class="bag-icon-glyph">${item.icon || getItemIcon(item.type)}</span>
              <span class="bag-icon-bonus">${equippedBonus}</span>
            </div>
          `
          : `
            <div class="bag-icon slot-equipped-card slot-empty-card" data-equip-type="${type}">
              <span class="bag-icon-glyph">—</span>
              <span class="bag-icon-bonus">—</span>
            </div>
          `}
      </li>
    `;
  }).join("");

  const bagSections = ["weapon", "armor", "amulet", "consumable"].map((type) => {
    if (type === "consumable") {
      const grouped = new Map();
      for (const entry of bagEntries) {
        const bagItemId = typeof entry === "string" ? entry : entry?.itemId;
        const item = getItemById(bagItemId);
        if (!item || item.type !== "consumable") continue;
        const bucket = grouped.get(item.id) || { item, count: 0 };
        bucket.count += 1;
        grouped.set(item.id, bucket);
      }

      const consumableStacks = Array.from(grouped.values())
        .sort((a, b) => compareItemsByRarityThenId(a.item, b.item));

      const content = consumableStacks.length
        ? consumableStacks
            .map(({ item, count }) => `
              <button
                class="bag-icon item-rarity-${getItemRarity(item)}"
                type="button"
                data-action="bag-item-action"
                data-item-id="${item.id}"
                data-consumable-item-id="${item.id}"
                data-drag-kind="consumable"
                data-drag-item-id="${item.id}"
                data-inventory-detail-item-id="${item.id}"
                data-inventory-detail-stack="${count}"
                draggable="true"
                aria-label="${escapeAttr(item.name)}"
              >
                <span class="bag-icon-glyph">${item.icon || getItemIcon(item.type)}</span>
                <span class="bag-icon-bonus">${formatItemBonuses(item)}</span>
                <span class="bag-stack-count">${count}</span>
              </button>
            `)
            .join("")
        : `<p class="empty-bag">${STRINGS_RU.inventory.emptyBag}</p>`;

      return `
        <section class="bag-section" data-type="${type}">
          <h5 class="bag-title">${toRuSectionType(type)}</h5>
          <div class="bag-grid">
            ${content}
          </div>
        </section>
      `;
    }

    const itemsForType = [...bagEntries]
      .map((entry) => {
        const item = getItemById(entry.itemId);
        if (!item || item.type !== type) {
          return null;
        }
        return {
          ...entry,
          item,
          bagIndex: bagEntries.findIndex((bagEntry) => bagEntry.instanceId === entry.instanceId),
        };
      })
      .filter(Boolean)
      .sort((a, b) => compareItemsByRarityThenId(a.item, b.item));

    const content = itemsForType.length
      ? itemsForType
          .map((entry) => {
            const equippedItemId = equipped?.[type];
            const equippedItem = equippedItemId ? getItemById(equippedItemId) : null;
            return `
              <button
                class="bag-icon item-rarity-${getItemRarity(entry.item)}"
                type="button"
                data-action="bag-item-action"
                data-item-id="${entry.item.id}"
                data-bag-instance-id="${entry.instanceId}"
                data-bag-index="${entry.bagIndex}"
                data-drag-kind="bag-equip"
                data-drag-bag-instance-id="${entry.instanceId}"
                data-drag-item-type="${entry.item.type}"
                data-inventory-detail-item-id="${entry.item.id}"
                draggable="true"
                aria-label="${escapeAttr(entry.item.name)}"
              >
                <span class="bag-icon-glyph">${entry.item.icon || getItemIcon(entry.item.type)}</span>
                <span class="bag-icon-bonus">${formatItemBonuses(entry.item, equippedItem)}</span>
              </button>
            `;
          })
          .join("")
      : `<p class="empty-bag">${STRINGS_RU.inventory.emptyBag}</p>`;

    return `
      <section class="bag-section" data-type="${type}">
        <h5 class="bag-title">${toRuSectionType(type)}</h5>
        <div class="bag-grid">
          ${content}
        </div>
      </section>
    `;
  }).join("");

  return `
    <article class="class-card inventory-panel">
      <h3>${STRINGS_RU.inventory.title}</h3>
      <p class="inventory-tip">${STRINGS_RU.inventory.tip}</p>
      <ul class="stats-list equip-slots-row">
        ${slots}
      </ul>
      <h4 class="bag-title">${STRINGS_RU.inventory.bagHeading}</h4>
      ${bagSections}
      ${renderSkillsMiniPanel(state)}
    </article>
  `;
}

function renderSkillsMiniPanel(state) {
  const classSkills = listSkillsForUi(state.playerSheet);
  const mana = state.playerSheet?.mana || 0;
  const learnedSkills = classSkills.filter((skill) => {
    const skillState = state.playerSheet?.skills?.[skill.id] || { learned: false };
    return skillState.learned;
  });
  const content = learnedSkills.length
    ? learnedSkills.map((skill) => {
      const skillState = state.playerSheet?.skills?.[skill.id] || { learned: false, level: 0 };
      const manaCost = Math.max(1, skill.manaCost);
      const notEnoughMana = mana < manaCost;
      const classes = ["bag-icon", notEnoughMana ? "quick-slot-out" : ""].filter(Boolean).join(" ");
      return `
        <button
          class="${classes}"
          type="button"
          data-action="left-skill-use"
          data-skill-id="${skill.id}"
          data-drag-kind="skill"
          data-drag-skill-id="${skill.id}"
          draggable="true"
          title="${getSkillHoverText(skill, skillState, state.playerSheet)}"
        >
          <span class="bag-icon-glyph">${skill.icon || "✨"}</span>
          <span class="bag-icon-bonus">Lv${skillState.level}</span>
          <span class="quick-slot-count">${manaCost}</span>
        </button>
      `;
    }).join("")
    : `<p class="empty-bag">${STRINGS_RU.inventory.noSkills}</p>`;

  return `
    <section class="bag-section">
      <h5 class="bag-title">${STRINGS_RU.inventory.skillsHeading}</h5>
      <div class="bag-grid">${content}</div>
    </section>
  `;
}

function renderStatsList(statsObject, playerSheet = null) {
  return Object.entries(statsObject)
    .map(([name, value]) => {
      const tooltip = getStatDescriptionRu(name, playerSheet);
      const shown = typeof value === "number" ? formatDisplayedNumericStat(value) : value;
      return `<li title="${tooltip}"><span title="${tooltip}">${toRuStatName(name)}</span><strong title="${tooltip}">${shown}</strong></li>`;
    })
    .join("");
}

function renderBaseAndTotalStats(playerSheet) {
  const statsOrder = ["STR", "INT", "AGI", "LUK", "HP_MAX"];
  return statsOrder
    .map((key) => {
      const baseRaw = Number(playerSheet?.baseStats?.[key] ?? 0);
      const tooltip = getStatDescriptionRu(key, playerSheet);
      return `<li title="${tooltip}"><span title="${tooltip}">${toRuStatName(key)}</span><strong title="${tooltip}" class="stat-base-value">${formatDisplayedNumericStat(baseRaw)}</strong></li>`;
    })
    .join("");
}

function renderStatsListWithUpgrades(statsObject, playerSheet, upgradeByStat) {
  const hasPoints = (playerSheet?.unspentPoints || 0) > 0;
  return Object.entries(statsObject)
    .map(([name, value]) => {
      const tooltip = getStatDescriptionRu(name, playerSheet);
      const upgradeValue = upgradeByStat[name];
      const upgradeButton = hasPoints && upgradeValue
        ? `<button class="btn upgrade-inline-btn" type="button" data-action="upgrade-stat" data-stat="${name}" title="${tooltip}. Потратить 1 очко: +${upgradeValue} ${toRuStatName(name)}.">+${upgradeValue}</button>`
        : "";
      const shown = typeof value === "number" ? formatDisplayedNumericStat(value) : value;
      return `<li title="${tooltip}"><span title="${tooltip}">${toRuStatName(name)}</span><div class="stat-value-with-upgrade"><strong title="${tooltip}">${shown}</strong>${upgradeButton}</div></li>`;
    })
    .join("");
}

function renderBaseAndTotalStatsWithUpgrades(playerSheet, previewState = null) {
  const hasPoints = (playerSheet?.unspentPoints || 0) > 0;
  const upgradePreviewStat = previewState?.upgradePreviewStat || null;
  const equipPreviewId = previewState?.equipPreviewBagInstanceId || null;
  const previewMode = getPreviewMode(previewState);

  let previewSheet = null;
  if (previewMode === "upgrade" && upgradePreviewStat && hasPoints) {
    previewSheet = buildPreviewSheet(playerSheet, {
      type: "upgrade",
      stat: upgradePreviewStat,
      bagInstanceId: null,
    });
  } else if (previewMode === "equip" && equipPreviewId) {
    previewSheet = buildPreviewSheet(playerSheet, {
      type: "equip",
      stat: null,
      bagInstanceId: equipPreviewId,
    });
  }

  const statsOrder = [
    { key: "STR", upgrade: 1 },
    { key: "INT", upgrade: 1 },
    { key: "AGI", upgrade: 1 },
    { key: "LUK", upgrade: 1 },
  ];

  return statsOrder
    .map(({ key, upgrade }) => {
      const tooltip = getStatDescriptionRu(key, playerSheet);
      const totalRaw = Number(playerSheet?.stats?.[key] ?? 0);
      const showPreviewSheet = previewSheet != null;
      const previewTotalRaw = showPreviewSheet
        ? Number(previewSheet.stats?.[key] ?? totalRaw)
        : totalRaw;
      const displayed = formatDisplayedNumericStat(previewTotalRaw);
      const valueClasses = ["stat-base-value"];
      if (showPreviewSheet && roundStat(previewTotalRaw) !== roundStat(totalRaw)) {
        if (previewMode === "upgrade" && upgradePreviewStat === key) {
          valueClasses.push("stat-base-value-preview");
        } else if (previewMode === "equip") {
          const delta = roundStat(previewTotalRaw) - roundStat(totalRaw);
          if (delta > 0) valueClasses.push("stat-preview-up");
          if (delta < 0) valueClasses.push("stat-preview-down");
        }
      }
      const upgradeButton = hasPoints
        ? `<button class="btn upgrade-inline-btn" type="button" data-action="upgrade-stat" data-stat="${key}" title="${tooltip}. Потратить 1 очко: +${upgrade} ${toRuStatName(key)}.">+${upgrade}</button>`
        : "";
      return `
        <li title="${tooltip}">
          <span title="${tooltip}">${toRuStatName(key)}</span>
          <div class="stat-value-with-upgrade">
            <strong title="${tooltip}" class="${valueClasses.join(" ")}">${displayed}</strong>
            ${upgradeButton}
          </div>
        </li>
      `;
    })
    .join("");
}

function renderDerivedStatsWithPreview(playerSheet, previewStat = null) {
  const previewMode = getPreviewMode(previewStat);
  const previewSheet = buildPreviewSheet(playerSheet, {
    type: "upgrade",
    stat: previewStat?.upgradePreviewStat || null,
    bagInstanceId: previewStat?.equipPreviewBagInstanceId || null,
  });
  const keys = ["HP_MAX", "CRIT_CHANCE", "CRIT_MULT", "WEAPON_DM"];
  return keys
    .map((key) => {
      const tooltip = getStatDescriptionRu(key, playerSheet);
      const value = getDerivedPanelValue(playerSheet, key);
      const previewValue = previewSheet ? getDerivedPanelValue(previewSheet, key) : null;
      const isPreviewed = previewSheet != null && roundStat(previewValue) !== roundStat(value);
      const shown = isPreviewed ? previewValue : value;
      const delta = roundStat(shown) - roundStat(value);
      let previewClass = "";
      if (previewMode === "upgrade" && isPreviewed) {
        previewClass = "stat-preview-up";
      } else if (previewMode === "equip" && isPreviewed) {
        if (delta > 0) previewClass = "stat-preview-up";
        if (delta < 0) previewClass = "stat-preview-down";
      }
      const display = formatDisplayedNumericStat(shown);
      return `<li title="${tooltip}"><span title="${tooltip}">${toRuStatName(key)}</span><strong title="${tooltip}" class="${previewClass}">${display}</strong></li>`;
    })
    .join("");
}

function buildPreviewSheet(playerSheet, preview) {
  if (!playerSheet || !preview) {
    return null;
  }

  const { stat, bagInstanceId } = preview;
  const temp = {
    ...playerSheet,
    baseStats: { ...playerSheet.baseStats },
    stats: { ...playerSheet.stats },
    derived: { ...playerSheet.derived },
    bag: [...(playerSheet.bag || [])],
    equippedByType: { ...(playerSheet.equippedByType || {}) },
  };

  if (stat && (playerSheet.unspentPoints || 0) > 0) {
    return spendLevelUpPoint(temp, stat);
  }

  if (bagInstanceId) {
    return swapItemFromBag(temp, bagInstanceId);
  }

  return null;
}

function getPreviewMode(previewState) {
  if (previewState?.upgradePreviewStat) return "upgrade";
  if (previewState?.equipPreviewBagInstanceId) return "equip";
  return "none";
}

function toRuType(itemType) {
  if (itemType === "weapon") return "оружие";
  if (itemType === "armor") return "броня";
  if (itemType === "amulet") return "амулет";
  if (itemType === "consumable") return "расходник";
  return itemType;
}

function toRuSectionType(itemType) {
  if (itemType === "consumable") return "расходники";
  if (itemType === "amulet") return "амулеты";
  return toRuType(itemType);
}

function toRuStatName(statName) {
  return STAT_LABELS_RU[statName] || statName;
}

function getItemIcon(type) {
  if (type === "weapon") return "🗡";
  if (type === "armor") return "🛡";
  if (type === "amulet") return "💍";
  if (type === "consumable") return "🧀";
  return "📦";
}

function formatItemBonuses(item, compareWithItem = null) {
  const entries = Object.entries(item.statBonuses || {}).sort(([a], [b]) => {
    const aIndex = BONUS_SORT_ORDER.indexOf(a);
    const bIndex = BONUS_SORT_ORDER.indexOf(b);
    const ai = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bi = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
  if (entries.length === 0) {
    return "ЭФ";
  }

  return entries
    .map(([statName, value]) => {
      const compareValue = compareWithItem?.statBonuses?.[statName] ?? 0;
      let compareClass = "bonus-eq";
      if (value > compareValue) compareClass = "bonus-up";
      if (value < compareValue) compareClass = "bonus-down";
      return `<span class="${compareClass}">+${toCompactStatName(statName)}${value}</span>`;
    })
    .join("<br>");
}

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

function toCompactStatName(statName) {
  return STAT_LABELS_COMPACT[statName] || statName;
}

function toRunStatusRu(status) {
  if (status === "victory") return "ПОБЕДА";
  if (status === "defeat") return "ПОРАЖЕНИЕ";
  return "В ПУТИ";
}

function getItemHoverText(item) {
  if (!item) return "";
  if (item.isConsumable) {
    return getConsumableHoverText(item, 1);
  }
  return `${item.name} (${toRuType(item.type)}): ${localizeStatText(item.effectText)}`;
}

function escapeHtml(text) {
  if (text == null) {
    return "";
  }
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text) {
  if (text == null) {
    return "";
  }
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function formatItemStatBonusesDetailSection(item) {
  const entries = Object.entries(item.statBonuses || {}).sort(([a], [b]) => {
    const aIndex = BONUS_SORT_ORDER.indexOf(a);
    const bIndex = BONUS_SORT_ORDER.indexOf(b);
    const ai = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bi = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
  if (entries.length === 0) {
    return "";
  }
  const lis = entries
    .map(([statName, value]) => {
      const label = toRuStatName(statName);
      const sign = value > 0 ? "+" : "";
      return `<li>${sign}${escapeHtml(String(value))} ${escapeHtml(label)}</li>`;
    })
    .join("");
  const id = STRINGS_RU.itemDetail;
  return `
    <div class="item-detail-section">
      <h4 class="item-detail-section-title">${id.bonusesTitle}</h4>
      <ul class="item-detail-list">${lis}</ul>
    </div>`;
}

function formatWeaponCombatDetailSection(item) {
  if (item.type !== "weapon") {
    return "";
  }
  const wd = item.weaponDamage != null ? roundStat(item.weaponDamage) : "—";
  const cc = item.weaponCritChance != null ? roundStat(item.weaponCritChance) : "—";
  const cm = item.weaponCritMult != null ? roundStat(item.weaponCritMult) : "—";
  const id = STRINGS_RU.itemDetail;
  return `
    <div class="item-detail-section">
      <h4 class="item-detail-section-title">${id.combatTitle}</h4>
      <ul class="item-detail-list item-detail-list-plain">
        <li>${id.baseDamage} <strong>${escapeHtml(String(wd))}</strong></li>
        <li>${id.critChanceBase} <strong>${escapeHtml(String(cc))}%</strong></li>
        <li>${id.critMultBase} <strong>×${escapeHtml(String(cm))}</strong></li>
      </ul>
    </div>`;
}

function formatItemDetailDescriptionSection(item, stackCount) {
  const id = STRINGS_RU.itemDetail;
  if (item.isConsumable) {
    const raw = getConsumableHoverText(item, stackCount ?? 1);
    const body = escapeHtml(raw).replace(/\n/g, "<br>");
    return `
      <div class="item-detail-section">
        <h4 class="item-detail-section-title">${id.effectTitle}</h4>
        <p class="item-detail-desc">${body}</p>
      </div>`;
  }
  if (item.effectText) {
    return `
      <div class="item-detail-section">
        <h4 class="item-detail-section-title">${id.descriptionTitle}</h4>
        <p class="item-detail-desc">${escapeHtml(localizeStatText(item.effectText))}</p>
      </div>`;
  }
  return "";
}

/** HTML содержимое всплывающей карточки предмета (инвентарь). */
export function buildInventoryItemDetailHtml(item, options = {}) {
  if (!item) {
    return "";
  }
  const stackCount = options.stackCount;
  const rarity = getItemRarity(item);
  const id = STRINGS_RU.itemDetail;
  const rarityRu =
    rarity === "unique" ? id.rarityUnique : rarity === "rare" ? id.rarityRare : id.rarityCommon;
  const typeRu = toRuType(item.type);
  const icon = item.icon || getItemIcon(item.type);
  const stackPill =
    item.isConsumable && stackCount != null && stackCount > 1
      ? `<span class="item-detail-stack-pill" aria-hidden="true">×${stackCount}</span>`
      : "";

  const sections = [
    formatItemStatBonusesDetailSection(item),
    formatWeaponCombatDetailSection(item),
    formatItemDetailDescriptionSection(item, stackCount),
  ]
    .filter(Boolean)
    .join("");

  const emptyHint =
    sections === ""
      ? `<p class="item-detail-muted item-detail-empty">${STRINGS_RU.itemDetail.emptyHint}</p>`
      : "";

  return `
    <div class="item-detail-card item-detail-rarity-${escapeHtml(rarity)}">
      <header class="item-detail-head">
        <span class="item-detail-rarity">${escapeHtml(rarityRu)}</span>
        <span class="item-detail-type">${escapeHtml(typeRu)}</span>
        ${stackPill}
      </header>
      <div class="item-detail-title-row">
        <span class="item-detail-icon" aria-hidden="true">${escapeHtml(icon)}</span>
        <span class="item-detail-name">${escapeHtml(item.name)}</span>
      </div>
      ${sections}
      ${emptyHint}
    </div>`;
}

function renderHpBar(playerSheet) {
  const hp = Math.max(0, playerSheet?.stats?.HP ?? 0);
  const hpMax = Math.max(1, playerSheet?.stats?.HP_MAX ?? 1);
  const percent = Math.max(0, Math.min(100, Math.round((hp / hpMax) * 100)));
  return `
    <div class="hp-block">
      <div class="hp-track">
        <div class="hp-fill" style="width:${percent}%"></div>
      </div>
      <div class="hp-value">${hp} / ${hpMax}</div>
    </div>
  `;
}

function renderXpBar(playerSheet) {
  const xp = Math.max(0, playerSheet?.xp ?? 0);
  const xpToNext = Math.max(1, playerSheet?.xpToNext ?? 1);
  const percent = Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100)));
  return `
    <div class="xp-block">
      <div class="xp-track">
        <div class="xp-fill" style="width:${percent}%"></div>
      </div>
      <div class="xp-value">${xp} / ${xpToNext}</div>
    </div>
  `;
}

function renderManaBar(playerSheet) {
  const mana = Math.max(0, playerSheet?.mana ?? 0);
  const manaMax = Math.max(1, playerSheet?.manaMax ?? 1);
  const percent = Math.max(0, Math.min(100, Math.round((mana / manaMax) * 100)));
  return `
    <div class="mana-block">
      <div class="mana-track">
        <div class="mana-fill" style="width:${percent}%"></div>
      </div>
      <div class="mana-value">${mana} / ${manaMax}</div>
    </div>
  `;
}

function buildFullStats(playerSheet) {
  return {
    STR: playerSheet?.stats?.STR ?? 0,
    INT: playerSheet?.stats?.INT ?? 0,
    AGI: playerSheet?.stats?.AGI ?? 0,
    LUK: playerSheet?.stats?.LUK ?? 0,
    HP: playerSheet?.stats?.HP ?? 0,
    HP_MAX: playerSheet?.stats?.HP_MAX ?? 0,
    CRIT_CHANCE: playerSheet?.derived?.CRIT_CHANCE ?? 0,
    CRIT_MULT: Number((playerSheet?.derived?.CRIT_MULT ?? 1).toFixed(2)),
    WEAPON_DM: playerSheet?.derived?.WEAPON_DAMAGE ?? 0,
  };
}

function renderBuildBadge() {
  return `
    <div class="build-badge-wrap">
      <p class="build-badge-note">${STRINGS_RU.buildBadge.analyticsNote}</p>
      <p class="build-badge">
        ${APP_TITLE} · v${APP_VERSION}
        <button class="build-help-btn" type="button" data-action="open-help" title="${STRINGS_RU.buildBadge.helpTitle}">?</button>
      </p>
    </div>
  `;
}

function renderHelpModal() {
  const h = STRINGS_RU.helpModal;
  return `
    <div class="help-modal-backdrop">
      <section class="help-modal">
        <h3>${h.title}</h3>
        <p><strong>${h.move}</strong> ${h.moveBody}</p>
        <p><strong>${h.mouse}</strong> ${h.mouseBody}</p>
        <p><strong>${h.auto}</strong> ${h.autoBody}</p>
        <p><strong>${h.skills}</strong> ${h.skillsBody}</p>
        <p><strong>${h.turns}</strong> ${h.turnsBody}</p>
        <p><strong>${h.hints}</strong> ${h.hintsBody}</p>
        <div class="controls-row">
          <button class="btn btn-primary" type="button" data-action="close-help">${h.close}</button>
        </div>
      </section>
    </div>
  `;
}

function renderSkillsModal(state) {
  const classSkills = listSkillsForUi(state.playerSheet);
  const cards = classSkills.map((skill) => {
    const skillState = state.playerSheet?.skills?.[skill.id] || { learned: false, level: 0 };
    const canSpend = (state.playerSheet?.skillPoints || 0) > 0;
    const maxed = skillState.level >= skill.maxLevel;
    const action = !skillState.learned ? "learn-skill" : "upgrade-skill";
    const actionLabel = !skillState.learned ? STRINGS_RU.skillsModal.learn : STRINGS_RU.skillsModal.upgrade;
    const enabled = canSpend && !maxed;
    return `
      <article class="class-card">
        <h3 title="${getSkillHoverText(skill, skillState, state.playerSheet)}">${skill.icon || "✨"} ${skill.name}</h3>
        <p>${skill.description}</p>
        <p class="progression-line">${STRINGS_RU.skillsModal.manaLine} ${skill.manaCost}</p>
        <p class="progression-line">${STRINGS_RU.skillsModal.propertyLine} ${skill.property}</p>
        <p class="progression-line">${STRINGS_RU.skillsModal.levelLine} ${skillState.level}/${skill.maxLevel}</p>
        <button class="btn btn-primary" type="button" data-action="${action}" data-skill-id="${skill.id}" ${enabled ? "" : "disabled"}>
          ${actionLabel}
        </button>
      </article>
    `;
  }).join("");

  return `
    <div class="skills-modal-backdrop">
      <section class="screen skills-screen-enter skills-modal-panel">
        <h1 class="screen-title">${STRINGS_RU.skillsModal.title}</h1>
        <p class="screen-subtitle">${skillsModalSubtitle(state.playerSheet?.skillPoints || 0)}</p>
        <div class="controls-row">
          <button class="btn" type="button" data-action="close-skills">${STRINGS_RU.skillsModal.close}</button>
        </div>
        <div class="sheet-grid">${cards}</div>
      </section>
    </div>
  `;
}

function renderQuickbar(state) {
  const slots = state.uiHud?.quickbarSlots || [];
  const pulseSlot = state.uiHud?.quickbarPulseSlot;
  const bagEntries = state.playerSheet?.bag || [];
  const mana = state.playerSheet?.mana || 0;
  const counts = new Map();
  for (const entry of bagEntries) {
    const itemId = typeof entry === "string" ? entry : entry?.itemId;
    if (!itemId) continue;
    counts.set(itemId, (counts.get(itemId) || 0) + 1);
  }

  const slotButtons = Array.from({ length: 9 }, (_, idx) => {
    const slotIndex = idx + 1;
    const slotValue = slots[idx] || null;
    const slotPayload = normalizeQuickbarSlot(slotValue);
    const item = slotPayload?.kind === "consumable" ? getItemById(slotPayload.itemId) : null;
    const skill = slotPayload?.kind === "skill" ? getSkillById(slotPayload.skillId) : null;
    const skillState = skill ? (state.playerSheet?.skills?.[skill.id] || { learned: false, level: 0 }) : null;
    const count = item ? (counts.get(item.id) || 0) : 0;
    const isDraggable = Boolean(slotPayload);
    const isOutOfStock = Boolean(item) && count <= 0;
    const manaCost = skill ? Math.max(1, skill.manaCost) : 0;
    const isNotEnoughMana = Boolean(skill) && mana < manaCost;
    const glyph = item
      ? (item.icon || getItemIcon(item.type))
      : skill
        ? (skill.icon || "✨")
        : "·";
    const title = item
      ? getConsumableHoverText(item, count)
      : skill
        ? getSkillHoverText(skill, skillState, state.playerSheet)
        : quickbarSlotTitle(slotIndex);
    const classes = [
      "quick-slot-btn",
      item ? `item-rarity-${getItemRarity(item)}` : "",
      pulseSlot === idx ? "quick-slot-pulse" : "",
      (isOutOfStock || isNotEnoughMana) ? "quick-slot-out" : "",
    ].filter(Boolean).join(" ");

    return `
      <button
        class="${classes}"
        type="button"
        data-action="quickbar-use"
        data-slot-index="${idx}"
        data-drag-kind="quick-slot"
        data-drag-slot-index="${idx}"
        draggable="${isDraggable ? "true" : "false"}"
        title="${title}"
      >
        <span class="quick-slot-key">${slotIndex}</span>
        <span class="quick-slot-glyph">${glyph}</span>
        ${item ? `<span class="quick-slot-count">${count}</span>` : ""}
        ${skill ? `<span class="quick-slot-count">${manaCost}</span>` : ""}
      </button>
    `;
  }).join("");

  return `
    <div class="quickbar" aria-label="${STRINGS_RU.quickbar.aria}">
      ${slotButtons}
    </div>
  `;
}

function renderActiveEffects(state) {
  const effects = collectActiveEffects(state);
  const content = effects.length
    ? effects.map((effect) => {
      const centerBadge = effect.badge || "";
      const ae = STRINGS_RU.activeEffects;
      const detailRows = [
        effect.remainingText ? `<p><strong>${ae.labelRemaining}</strong> ${effect.remainingText}</p>` : "",
        effect.description ? `<p><strong>${ae.labelEffect}</strong> ${effect.description}</p>` : "",
        effect.stacksText ? `<p><strong>${ae.labelStacks}</strong> ${effect.stacksText}</p>` : "",
      ].filter(Boolean).join("");
      return `
        <div class="active-effect-icon-wrap" title="${effect.name}">
          <span class="active-effect-icon">${effect.icon}</span>
          <span class="active-effect-badge">${centerBadge}</span>
          <div class="active-effect-tooltip">
            <h5>${effect.name}</h5>
            ${detailRows}
          </div>
        </div>
      `;
    }).join("")
    : `<span class="active-effects-empty">${STRINGS_RU.activeEffects.empty}</span>`;
  return `
    <aside class="active-effects-panel" aria-label="${STRINGS_RU.activeEffects.aria}">
      <h4>${STRINGS_RU.activeEffects.heading}</h4>
      <div class="active-effects-icons">${content}</div>
    </aside>
  `;
}

function collectActiveEffects(state) {
  const run = state.run || {};
  const stacks = state.playerSheet?.effectStacks || {};
  const ae = STRINGS_RU.activeEffects;
  const effects = [];
  if ((run.nextHitMultiplier || 1) > 1) {
    effects.push({
      name: ae.nextHitName,
      icon: "🧪",
      badge: "1",
      remainingText: ae.nextHitRemaining,
      description: `Следующий удар x${run.nextHitMultiplier}.`,
      stacksText: ae.nextHitStacks,
    });
  }
  const bandage = (run.overTimeEffects || []).find((effect) => effect.type === "bandage_regen");
  if (bandage?.turnsLeft > 0) {
    effects.push({
      name: ae.bandageName,
      icon: "🩹",
      badge: `${bandage.turnsLeft}t`,
      remainingText: activeEffectBandageRemaining(bandage.turnsLeft),
      description: `Восстанавливает ${bandage.healPerTurn} HP каждый ход.`,
      stacksText: "1",
    });
  }
  if ((stacks.hp_max_plus_5 || 0) > 0) {
    effects.push({
      name: ae.hardCheeseName,
      icon: "🧀",
      badge: "∞",
      remainingText: ae.hardCheeseRemaining,
      description: ae.hardCheeseDesc,
      stacksText: activeEffectStacksLine(stacks.hp_max_plus_5, stacks.hp_max_plus_5 * 5),
    });
  }
  if ((stacks.hp_max_plus_4 || 0) > 0) {
    effects.push({
      name: ae.crackerName,
      icon: "🥨",
      badge: "∞",
      remainingText: ae.hardCheeseRemaining,
      description: ae.crackerDesc,
      stacksText: activeEffectStacksLine(stacks.hp_max_plus_4, stacks.hp_max_plus_4 * 4),
    });
  }
  if ((stacks.hp_max_plus_1 || 0) > 0) {
    effects.push({
      name: ae.royalCheeseName,
      icon: "👑",
      badge: "∞",
      remainingText: ae.hardCheeseRemaining,
      description: ae.royalCheeseDesc,
      stacksText: activeEffectStacksLine(stacks.hp_max_plus_1, stacks.hp_max_plus_1),
    });
  }
  return effects;
}

function normalizeQuickbarSlot(value) {
  if (!value) return null;
  if (typeof value === "string") return { kind: "consumable", itemId: value };
  if (value.kind === "consumable" && value.itemId) return value;
  if (value.kind === "skill" && value.skillId) return value;
  return null;
}
