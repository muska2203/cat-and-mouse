import { CLASS_CONFIG } from "./state.js?v=0.4.0-pre-alpha";
import { createPlayerSheet } from "./state.js?v=0.4.0-pre-alpha";
import { EQUIP_TYPES } from "./loadout.js?v=0.4.0-pre-alpha";
import { getItemById } from "./loadout.js?v=0.4.0-pre-alpha";
import { applyLoadoutToSheet } from "./loadout.js?v=0.4.0-pre-alpha";
import { getDefaultStarterLoadout } from "./loadout.js?v=0.4.0-pre-alpha";
import { spendLevelUpPoint } from "./loadout.js?v=0.4.0-pre-alpha";
import { swapItemFromBag } from "./loadout.js?v=0.4.0-pre-alpha";
import { APP_TITLE } from "./app-config.js?v=0.4.0-pre-alpha";
import { APP_VERSION } from "./app-config.js?v=0.4.0-pre-alpha";
import { getSkillById } from "./skills.js?v=0.4.0-pre-alpha";
import { getSkillsForClass } from "./skills.js?v=0.4.0-pre-alpha";

const STAT_LABELS_RU = {
  STR: "СИЛ",
  INT: "ИНТ",
  AGI: "ЛВК",
  LUK: "УДЧ",
  HP_MAX: "HP МАКС",
  HP: "HP",
  baseHP: "БАЗ HP",
  HP_MAX_COMPUTED: "HP МАКС (Ф)",
  ATK_PHYS: "АТК ФИЗ",
  ATK_MAGIC: "АТК МАГ",
  CRIT_CHANCE: "КРИТ %",
  CRIT_MULT: "КРИТ Х",
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
  "ATK_PHYS",
  "ATK_MAGIC",
  "CRIT_CHANCE",
  "CRIT_MULT",
];

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
      <h1 class="screen-title">Экран в разработке</h1>
      <p class="screen-subtitle">Этот экран будет добавлен на следующих шагах.</p>
    </section>
  `;
}

function renderWelcomeScreen(state) {
  const selectedClassId = state.selectedClassId || Object.keys(CLASS_CONFIG)[0];
  const selectedStarterLoadout = getDefaultStarterLoadout(selectedClassId);
  const selectedSheet = applyLoadoutToSheet(
    createPlayerSheet(selectedClassId),
    selectedStarterLoadout
  );

  const classesMarkup = Object.values(CLASS_CONFIG).map(
    (playerClass) => {
      return `
      <article class="class-card ${
        selectedClassId === playerClass.id ? "class-card-selected" : ""
      }" data-class-id="${playerClass.id}" role="button" tabindex="0">
        <h3>${playerClass.label}</h3>
        <p>${playerClass.description}</p>
      </article>
    `
    }
  ).join("");

  const starterItemsMarkup = selectedStarterLoadout
    .map((id) => getItemById(id))
    .filter(Boolean)
    .map((item) => `<li><span>${item.icon || getItemIcon(item.type)}</span><strong>${item.name}</strong><small class="item-bonus">${formatItemBonuses(item)}</small></li>`)
    .join("");

  return `
    <section class="screen" aria-label="Приветственный экран">
      <h1 class="screen-title">Mouse Rogue-like</h1>
      <p class="screen-subtitle">
        Проведи мышонка через квартиру-лабиринт до норы, избегая котов и ловушек.
      </p>
      <div class="class-list" aria-label="Доступные классы персонажа">
        ${classesMarkup}
      </div>
      <div class="sheet-grid">
        <article class="class-card">
          <h3>Характеристики: ${selectedSheet.classLabel}</h3>
          <section class="stats-group">
            <ul class="stats-list">
              ${renderBaseAndTotalStats(selectedSheet)}
            </ul>
          </section>
          <section class="stats-group">
            <h4>Остальные</h4>
            <ul class="stats-list">
              ${renderStatsList({
                ATK_PHYS: selectedSheet?.derived?.ATK_PHYS ?? 0,
                ATK_MAGIC: selectedSheet?.derived?.ATK_MAGIC ?? 0,
                CRIT_CHANCE: selectedSheet?.derived?.CRIT_CHANCE ?? 0,
                CRIT_MULT: selectedSheet?.derived?.CRIT_MULT ?? 0,
              }, selectedSheet)}
            </ul>
          </section>
        </article>
        <article class="class-card">
          <h3>Начальное снаряжение</h3>
          <ul class="stats-list">
            ${starterItemsMarkup}
          </ul>
        </article>
      </div>
      <button
        class="btn btn-primary"
        type="button"
        data-action="start-game"
        ${selectedClassId ? "" : "disabled"}
      >
        Начать игру
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
        <h1 class="screen-title">Забег не создан</h1>
        <p class="screen-subtitle">Сначала начни игру на экране снаряжения.</p>
      </section>
    `;
  }

  return `
    <section class="screen screen-game" aria-label="Игровое поле">
      <h1 class="screen-title">Квартира-лабиринт</h1>
      <p class="screen-subtitle">
        Уровень: ${state.run.level}/${state.run.maxLevel}. WASD: шаг по клетке. Размер карты: ${state.run.width}x${state.run.height}. Ходы: ${state.run.turns}.
      </p>
      <div class="game-layout">
        ${renderInventoryPanel(state)}
        <div class="play-panel">
          ${renderTurnPhaseBadge(state.run)}
          <canvas id="gameCanvas" class="game-canvas" width="800" height="500"></canvas>
          ${renderActiveEffects(state)}
          ${renderQuickbar(state)}
          <div class="mobile-controls" aria-label="Управление с телефона">
            <button class="btn mobile-move-btn mobile-up" type="button" data-action="mobile-move" data-direction="up">▲</button>
            <button class="btn mobile-move-btn mobile-left" type="button" data-action="mobile-move" data-direction="left">◀</button>
            <button class="btn mobile-move-btn mobile-down" type="button" data-action="mobile-move" data-direction="down">▼</button>
            <button class="btn mobile-move-btn mobile-right" type="button" data-action="mobile-move" data-direction="right">▶</button>
          </div>
        </div>
        <article class="class-card game-side">
          <h3>Параметры мышонка</h3>
          ${renderHpBar(state.playerSheet)}
          ${renderManaBar(state.playerSheet)}
          ${renderXpBar(state.playerSheet)}
          <p class="progression-line">Уровень: <span data-action="debug-level-up">${state.playerSheet?.level ?? 1}</span></p>
          <p class="progression-line">Очки прокачки: ${state.playerSheet?.unspentPoints ?? 0}</p>
          <section class="stats-group">
            <ul class="stats-list">
              ${renderBaseAndTotalStatsWithUpgrades(state.playerSheet, state.uiHud)}
            </ul>
          </section>
          <section class="stats-group">
            <h4>Остальные</h4>
            <ul class="stats-list">
              ${renderDerivedStatsWithPreview(state.playerSheet, state.uiHud)}
            </ul>
          </section>
          <p class="run-log">${state.run.lastLog || "—"}</p>
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
      ${isPlayerTurn ? "Ход игрока" : "Ход окружения"}
    </div>
  `;
}

function renderEndingScreen(state) {
  if (!state.run || !state.playerSheet) {
    return `
      <section class="screen">
        <h1 class="screen-title">Забег завершен</h1>
        <p class="screen-subtitle">Данные забега отсутствуют.</p>
      </section>
    `;
  }

  const title = state.run.status === "victory" ? "Победа!" : "Поражение";
  const subtitle =
    state.run.status === "victory"
      ? "Мышонок добрался до норы."
      : "HP опустилось до нуля, забег завершен.";

  const equipped = EQUIP_TYPES.map((type) => {
    const itemId = state.playerSheet.equippedByType?.[type];
    const item = itemId ? getItemById(itemId) : null;
    return `<li><span>${toRuType(type)}</span><strong>${item ? item.name : "пусто"}</strong></li>`;
  }).join("");

  const bagItems = (state.playerSheet.bag || [])
    .map((entry) => getItemById(entry.itemId))
    .filter(Boolean)
    .map((item) => `<li><span>${item.icon || getItemIcon(item.type)}</span><strong>${item.name}</strong></li>`)
    .join("");

  return `
    <section class="screen" aria-label="Финальный экран">
      <h1 class="screen-title">${title}</h1>
      <p class="screen-subtitle">${subtitle} Ходы: ${state.run.turns}.</p>
      <p class="screen-subtitle">Достигнут уровень лабиринта: ${state.run.level}/${state.run.maxLevel}.</p>
      <p class="screen-subtitle">Уровень персонажа: ${state.playerSheet.level}. XP: ${state.playerSheet.xp}/${state.playerSheet.xpToNext}.</p>
      <div class="sheet-grid">
        <article class="class-card">
          <h3>Характеристики</h3>
          <ul class="stats-list">
            ${renderStatsList(buildFullStats(state.playerSheet), state.playerSheet)}
          </ul>
        </article>
        <article class="class-card">
          <h3>Экипировка</h3>
          <ul class="stats-list">
            ${equipped}
          </ul>
        </article>
        <article class="class-card">
          <h3>Сумка</h3>
          <ul class="stats-list">
            ${bagItems || "<li><span>—</span><strong>пусто</strong></li>"}
          </ul>
        </article>
      </div>
      <div class="controls-row">
        <button class="btn btn-primary" type="button" data-action="end-to-welcome">В главное меню</button>
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
            <div class="bag-icon slot-equipped-card${rarityClass}" title="${item.name}">
              <span class="bag-icon-glyph">${item.icon || getItemIcon(item.type)}</span>
              <span class="bag-icon-bonus">${equippedBonus}</span>
            </div>
          `
          : `
            <div class="bag-icon slot-equipped-card slot-empty-card">
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
                draggable="true"
                title="${getConsumableHoverText(item, count)}"
              >
                <span class="bag-icon-glyph">${item.icon || getItemIcon(item.type)}</span>
                <span class="bag-icon-bonus">${formatItemBonuses(item)}</span>
                <span class="bag-stack-count">${count}</span>
              </button>
            `)
            .join("")
        : `<p class="empty-bag">Пусто</p>`;

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
                title="${getItemHoverText(entry.item)}"
              >
                <span class="bag-icon-glyph">${entry.item.icon || getItemIcon(entry.item.type)}</span>
                <span class="bag-icon-bonus">${formatItemBonuses(entry.item, equippedItem)}</span>
              </button>
            `;
          })
          .join("")
      : `<p class="empty-bag">Пусто</p>`;

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
      <h3>Инвентарь</h3>
      <p class="inventory-tip">Экипировка: обмен слота. Расходники: применяются и исчезают.</p>
      <ul class="stats-list equip-slots-row">
        ${slots}
      </ul>
      <h4 class="bag-title">Сумка</h4>
      ${bagSections}
      ${renderSkillsMiniPanel(state)}
    </article>
  `;
}

function renderSkillsMiniPanel(state) {
  const classSkills = getSkillsForClass(state.playerSheet?.classId || "");
  const mana = state.playerSheet?.mana || 0;
  const learnedSkills = classSkills.filter((skill) => {
    const skillState = state.playerSheet?.skills?.[skill.id] || { learned: false };
    return skillState.learned;
  });
  const content = learnedSkills.length
    ? learnedSkills.map((skill) => {
      const skillState = state.playerSheet?.skills?.[skill.id] || { learned: false, level: 0 };
      const manaCost = Math.max(1, skill.manaCost - (skill.id === "warrior_roll" ? (skillState.level - 1) : 0));
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
          title="${buildSkillHoverText(skill, skillState, state.playerSheet)}"
        >
          <span class="bag-icon-glyph">${skill.icon || "✨"}</span>
          <span class="bag-icon-bonus">Lv${skillState.level}</span>
          <span class="quick-slot-count">${manaCost}</span>
        </button>
      `;
    }).join("")
    : `<p class="empty-bag">Нет скиллов</p>`;

  return `
    <section class="bag-section">
      <h5 class="bag-title">Скиллы</h5>
      <div class="bag-grid">${content}</div>
    </section>
  `;
}

function renderStatsList(statsObject, playerSheet = null) {
  return Object.entries(statsObject)
    .map(([name, value]) => `<li><span title="${getStatDescriptionRu(name, playerSheet)}">${toRuStatName(name)}</span><strong>${value}</strong></li>`)
    .join("");
}

function renderBaseAndTotalStats(playerSheet) {
  const statsOrder = ["STR", "INT", "AGI", "LUK", "HP_MAX"];
  return statsOrder
    .map((key) => {
      const baseValue = playerSheet?.baseStats?.[key] ?? 0;
      const totalValue = playerSheet?.stats?.[key] ?? baseValue;
      const totalMarkup = totalValue !== baseValue
        ? `<span class="stat-total-value"> (${totalValue})</span>`
        : "";
      return `<li><span title="${getStatDescriptionRu(key, playerSheet)}">${toRuStatName(key)}</span><strong>${baseValue}${totalMarkup}</strong></li>`;
    })
    .join("");
}

function renderStatsListWithUpgrades(statsObject, playerSheet, upgradeByStat) {
  const hasPoints = (playerSheet?.unspentPoints || 0) > 0;
  return Object.entries(statsObject)
    .map(([name, value]) => {
      const upgradeValue = upgradeByStat[name];
      const upgradeButton = hasPoints && upgradeValue
        ? `<button class="btn upgrade-inline-btn" type="button" data-action="upgrade-stat" data-stat="${name}">+${upgradeValue}</button>`
        : "";
      return `<li><span title="${getStatDescriptionRu(name, playerSheet)}">${toRuStatName(name)}</span><div class="stat-value-with-upgrade"><strong>${value}</strong>${upgradeButton}</div></li>`;
    })
    .join("");
}

function renderBaseAndTotalStatsWithUpgrades(playerSheet, previewState = null) {
  const hasPoints = (playerSheet?.unspentPoints || 0) > 0;
  const previewMode = getPreviewMode(previewState);
  const previewSheet = buildPreviewSheet(playerSheet, {
    type: "upgrade",
    stat: previewState?.upgradePreviewStat || null,
    bagInstanceId: previewState?.equipPreviewBagInstanceId || null,
  });
  const statsOrder = [
    { key: "STR", upgrade: 1 },
    { key: "INT", upgrade: 1 },
    { key: "AGI", upgrade: 1 },
    { key: "LUK", upgrade: 1 },
    { key: "HP_MAX", upgrade: 3 },
  ];

  return statsOrder
    .map(({ key, upgrade }) => {
      const baseValue = playerSheet?.baseStats?.[key] ?? 0;
      const totalValue = playerSheet?.stats?.[key] ?? baseValue;
      const previewBase = previewSheet?.baseStats?.[key];
      const previewTotal = previewSheet?.stats?.[key];
      const shownBase = previewBase != null ? previewBase : baseValue;
      const shownTotal = previewTotal != null ? previewTotal : totalValue;
      const isBasePreviewed = shownBase !== baseValue;
      const isTotalPreviewed = shownTotal !== totalValue;
      const upgradeButton = hasPoints
        ? `<button class="btn upgrade-inline-btn" type="button" data-action="upgrade-stat" data-stat="${key}">+${upgrade}</button>`
        : "";
      const totalDelta = shownTotal - totalValue;
      let previewClass = "";
      if (previewMode === "upgrade" && isTotalPreviewed) {
        previewClass = "stat-preview-up";
      } else if (previewMode === "equip" && isTotalPreviewed) {
        if (totalDelta > 0) previewClass = "stat-preview-up";
        if (totalDelta < 0) previewClass = "stat-preview-down";
      }
      const totalMarkup = shownTotal !== shownBase
        ? `<span class="stat-total-neutral ${previewClass}"> (${shownTotal})</span>`
        : "";
      return `
        <li>
          <span title="${getStatDescriptionRu(key, playerSheet)}">${toRuStatName(key)}</span>
          <div class="stat-value-with-upgrade">
            <strong>${shownBase}${totalMarkup}</strong>
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
  const current = {
    ATK_PHYS: playerSheet?.derived?.ATK_PHYS ?? 0,
    ATK_MAGIC: playerSheet?.derived?.ATK_MAGIC ?? 0,
    CRIT_CHANCE: playerSheet?.derived?.CRIT_CHANCE ?? 0,
    CRIT_MULT: playerSheet?.derived?.CRIT_MULT ?? 0,
  };
  return Object.entries(current)
    .map(([key, value]) => {
      const previewValue = previewSheet?.derived?.[key];
      const isPreviewed = previewValue != null && previewValue !== value;
      const shown = isPreviewed ? previewValue : value;
      const delta = shown - value;
      let previewClass = "";
      if (previewMode === "upgrade" && isPreviewed) {
        previewClass = "stat-preview-up";
      } else if (previewMode === "equip" && isPreviewed) {
        if (delta > 0) previewClass = "stat-preview-up";
        if (delta < 0) previewClass = "stat-preview-down";
      }
      return `<li><span title="${getStatDescriptionRu(key, playerSheet)}">${toRuStatName(key)}</span><strong class="${previewClass}">${shown}</strong></li>`;
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

function localizeStatText(effectText) {
  return effectText
    .replaceAll("STR", "СИЛ")
    .replaceAll("INT", "ИНТ")
    .replaceAll("AGI", "ЛВК")
    .replaceAll("LUK", "УДЧ")
    .replaceAll("HP_MAX", "HP МАКС");
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

function compareItemsByRarityThenId(a, b) {
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

function getStatDescriptionRu(statName, playerSheet) {
  const stats = playerSheet?.stats || {};
  const derived = playerSheet?.derived || {};
  if (statName === "STR") return "СИЛ: влияет на физический урон. Основная часть формулы ATK_PHYS.";
  if (statName === "INT") return "ИНТ: влияет на магический урон. Основная часть формулы ATK_MAGIC.";
  if (statName === "AGI") return "ЛВК: влияет на физический урон и ряд эффектов мобильности.";
  if (statName === "LUK") return "УДЧ: влияет на шанс и силу критов, а также часть магического урона.";
  if (statName === "HP_MAX") return "HP МАКС: верхний предел здоровья персонажа.";
  if (statName === "HP") return "HP: текущее здоровье. При 0 персонаж проигрывает забег.";
  if (statName === "ATK_PHYS") {
    const str = stats.STR ?? playerSheet?.baseStats?.STR ?? 0;
    const agi = stats.AGI ?? playerSheet?.baseStats?.AGI ?? 0;
    return `АТК ФИЗ: STR*1.5 + AGI*0.4. Сейчас: ${derived.ATK_PHYS ?? 0} (STR=${str}, AGI=${agi}).`;
  }
  if (statName === "ATK_MAGIC") {
    const intValue = stats.INT ?? playerSheet?.baseStats?.INT ?? 0;
    const luk = stats.LUK ?? playerSheet?.baseStats?.LUK ?? 0;
    return `АТК МАГ: INT*1.5 + LUK*0.4. Сейчас: ${derived.ATK_MAGIC ?? 0} (INT=${intValue}, LUK=${luk}).`;
  }
  if (statName === "CRIT_CHANCE") {
    return `КРИТ %: шанс критического удара. Сейчас: ${derived.CRIT_CHANCE ?? 0}%.`;
  }
  if (statName === "CRIT_MULT") {
    return `КРИТ Х: множитель урона крита. Сейчас: x${derived.CRIT_MULT ?? 1}.`;
  }
  return "Характеристика персонажа.";
}

function getItemHoverText(item) {
  if (!item) return "";
  if (item.isConsumable) {
    return getConsumableHoverText(item, 1);
  }
  return `${item.name} (${toRuType(item.type)}): ${localizeStatText(item.effectText)}`;
}

function getConsumableHoverText(item, count) {
  const stacksText = count > 1 ? `\nСтак: ${count}` : "";
  if (item.id === "cheese_ration") {
    return `${item.name}: лечит 10 HP (не выше HP МАКС), дополнительно +4 маны.${stacksText}`;
  }
  if (item.id === "common_crumb_ration") {
    return `${item.name}: лечит 10 HP (не выше HP МАКС).${stacksText}`;
  }
  if (item.id === "common_mint_drop") {
    return `${item.name}: восстанавливает 10 маны (не выше максимума).${stacksText}`;
  }
  if (item.id === "common_warm_milk") {
    return `${item.name}: лечит 6 HP и восстанавливает 6 маны.${stacksText}`;
  }
  if (item.id === "common_sharp_pepper") {
    return `${item.name}: следующая атака персонажа получает множитель x1.5.${stacksText}`;
  }
  if (item.id === "rare_hearty_stew") {
    return `${item.name}: лечит 18 HP (не выше HP МАКС).${stacksText}`;
  }
  if (item.id === "rare_focus_tonic") {
    return `${item.name}: восстанавливает 16 маны (не выше максимума).${stacksText}`;
  }
  if (item.id === "rare_dual_elixir") {
    return `${item.name}: лечит 12 HP и восстанавливает 12 маны.${stacksText}`;
  }
  if (item.id === "rare_battle_pepper") {
    return `${item.name}: следующая атака персонажа получает множитель x2.${stacksText}`;
  }
  if (item.id === "unique_phoenix_broth") {
    return `${item.name}: лечит 28 HP (не выше HP МАКС).${stacksText}`;
  }
  if (item.id === "unique_aether_draught") {
    return `${item.name}: восстанавливает 24 маны (не выше максимума).${stacksText}`;
  }
  if (item.id === "unique_twilight_mix") {
    return `${item.name}: лечит 20 HP и восстанавливает 20 маны.${stacksText}`;
  }
  if (item.id === "unique_storm_pepper") {
    return `${item.name}: следующая атака персонажа получает множитель x2.5.${stacksText}`;
  }
  if (item.id === "hard_cheese") {
    return `${item.name}: +5 HP МАКС до конца забега (эффект стакается).${stacksText}`;
  }
  if (item.id === "common_cracker") {
    return `${item.name}: +4 HP МАКС до конца забега (эффект стакается).${stacksText}`;
  }
  if (item.id === "rare_royal_cheese") {
    return `${item.name}: лечит 20 HP, +1 HP МАКС до конца забега и +8 маны.${stacksText}`;
  }
  if (item.id === "rare_spice_vial") {
    return `${item.name}: следующий удар персонажа получает множитель x2.${stacksText}`;
  }
  if (item.id === "pepper_bomb") {
    return `${item.name}: наносит 8 урона ближайшему коту.${stacksText}`;
  }
  return `${item.name}: ${localizeStatText(item.effectText)}.${stacksText}`;
}

function buildSkillHoverText(skill, skillState, playerSheet) {
  const level = skillState?.level || 0;
  const manaCost = Math.max(1, skill.manaCost - (skill.id === "warrior_roll" ? (level - 1) : 0));
  const atkMagic = playerSheet?.derived?.ATK_MAGIC ?? 0;
  const atkPhys = playerSheet?.derived?.ATK_PHYS ?? 0;
  const agi = playerSheet?.stats?.AGI ?? playerSheet?.baseStats?.AGI ?? 0;
  if (skill.id === "mage_arc_shot") {
    const dmg = Math.max(1, Math.floor(atkMagic * (1.1 + level * 0.2)));
    return `${skill.name}\nМана: ${manaCost}\nФормула: ATK_MAGIC * (1.1 + 0.2 * уровень_скилла)\nЗависит от: ATK_MAGIC=${atkMagic}\nТекущий урон: ${dmg}\nЦель: видимая открытая клетка с котом, не за стеной.`;
  }
  if (skill.id === "mage_mirror_veil") {
    const charges = 1 + level;
    const reduction = 1 + level;
    return `${skill.name}\nМана: ${manaCost}\nТекущее действие: ${charges} срабатываний, -${reduction} входящего урона.\nЦель: клетка персонажа.`;
  }
  if (skill.id === "warrior_power_hit") {
    const dmg = Math.max(1, Math.floor(atkPhys * (1.2 + level * 0.25)));
    return `${skill.name}\nМана: ${manaCost}\nФормула: ATK_PHYS * (1.2 + 0.25 * уровень_скилла)\nЗависит от: ATK_PHYS=${atkPhys}\nТекущий урон: ${dmg}\nЦель: соседняя клетка с котом (радиус 1).`;
  }
  if (skill.id === "warrior_roll") {
    const throughDamage = Math.max(1, Math.floor(agi * 0.6 + level));
    return `${skill.name}\nМана: ${manaCost}\nФормула урона по пути: AGI * 0.6 + уровень_скилла\nЗависит от: AGI=${agi}\nУрон по коту в промежуточной клетке: ${throughDamage}\nЦель: клетка через 1 по прямой, нельзя через стену и на клетку с котом.`;
  }
  if (skill.id === "warrior_bandage") {
    const healPerTurn = 5 + level;
    const totalHeal = healPerTurn * 3;
    return `${skill.name}\nМана: ${manaCost}\nФормула: 5 + уровень_скилла (за ход)\nТекущее восстановление: ${healPerTurn} HP/ход, всего ${totalHeal} HP за 3 хода\nЦель: клетка персонажа. Повторно нельзя, пока эффект активен.`;
  }
  if (skill.id === "mage_heal") {
    const heal = 40 + Math.max(0, (level - 1) * 10);
    return `${skill.name}\nМана: ${manaCost}\nФормула: 40 + 10 * (уровень_скилла - 1)\nТекущее восстановление: ${heal} HP\nЦель: клетка персонажа.`;
  }
  return `${skill.name}\nМана: ${manaCost}\n${skill.description}`;
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
    ATK_PHYS: playerSheet?.derived?.ATK_PHYS ?? 0,
    ATK_MAGIC: playerSheet?.derived?.ATK_MAGIC ?? 0,
    CRIT_CHANCE: playerSheet?.derived?.CRIT_CHANCE ?? 0,
    CRIT_MULT: playerSheet?.derived?.CRIT_MULT ?? 0,
  };
}

function renderBuildBadge() {
  return `
    <div class="build-badge-wrap">
      <p class="build-badge-note">Используется анонимная аналитика: запуски, класс, исход забега, причины поражения и применение скиллов.</p>
      <p class="build-badge">
        ${APP_TITLE} · v${APP_VERSION}
        <button class="build-help-btn" type="button" data-action="open-help" title="Справка по управлению">?</button>
      </p>
    </div>
  `;
}

function renderHelpModal() {
  return `
    <div class="help-modal-backdrop">
      <section class="help-modal">
        <h3>Справка</h3>
        <p><strong>Как ходить:</strong> используй WASD или стрелки. По диагонали — Q, E, Z, C.</p>
        <p><strong>Мышка:</strong> наведи курсор на клетку, чтобы увидеть путь. Клик по соседней клетке — шаг (или удар, если там кот). Клик по дальней клетке — герой запомнит маршрут и пойдет по нему сам.</p>
        <p><strong>Автоход:</strong> герой идет по запомненному пути между ходами. Автодвижение остановится, если герой получил урон, путь перекрыт или цель уже достигнута.</p>
        <p><strong>Скиллы и предметы:</strong> кнопки 1-9 — быстрые слоты. Можно положить туда скиллы и расходники. Нажми на скилл, затем на клетку цели. Пробел — использовать подготовленный скилл на себя (если это разрешено).</p>
        <p><strong>Как идут ходы:</strong> сначала ходишь ты, потом ходят коты. Коты могут обходить стены и двигаться одновременно.</p>
        <p><strong>Подсказки в бою:</strong> активные эффекты показаны в левом верхнем углу, подробности — по наведению.</p>
        <div class="controls-row">
          <button class="btn btn-primary" type="button" data-action="close-help">Закрыть</button>
        </div>
      </section>
    </div>
  `;
}

function renderSkillsModal(state) {
  const classSkills = getSkillsForClass(state.playerSheet?.classId || "");
  const cards = classSkills.map((skill) => {
    const skillState = state.playerSheet?.skills?.[skill.id] || { learned: false, level: 0 };
    const canSpend = (state.playerSheet?.skillPoints || 0) > 0;
    const maxed = skillState.level >= skill.maxLevel;
    const action = !skillState.learned ? "learn-skill" : "upgrade-skill";
    const actionLabel = !skillState.learned ? "Изучить" : "Улучшить";
    const enabled = canSpend && !maxed;
    return `
      <article class="class-card">
        <h3 title="${buildSkillHoverText(skill, skillState, state.playerSheet)}">${skill.icon || "✨"} ${skill.name}</h3>
        <p>${skill.description}</p>
        <p class="progression-line">Мана: ${skill.manaCost}</p>
        <p class="progression-line">Свойство: ${skill.property}</p>
        <p class="progression-line">Уровень: ${skillState.level}/${skill.maxLevel}</p>
        <button class="btn btn-primary" type="button" data-action="${action}" data-skill-id="${skill.id}" ${enabled ? "" : "disabled"}>
          ${actionLabel}
        </button>
      </article>
    `;
  }).join("");

  return `
    <div class="skills-modal-backdrop">
      <section class="screen skills-screen-enter skills-modal-panel">
        <h1 class="screen-title">Скиллы</h1>
        <p class="screen-subtitle">Каждые 2 уровня дается 1 очко скилла. Доступно: ${state.playerSheet?.skillPoints || 0}</p>
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
    const count = item ? (counts.get(item.id) || 0) : 0;
    const isDraggable = Boolean(slotPayload);
    const isOutOfStock = Boolean(item) && count <= 0;
    const isNotEnoughMana = Boolean(skill) && mana < (skill.manaCost || 0);
    const glyph = item
      ? (item.icon || getItemIcon(item.type))
      : skill
        ? (skill.icon || "✨")
        : "·";
    const title = item
      ? `${item.name} (${count})`
      : skill
        ? `${skill.name} (${skill.manaCost} маны)`
        : `Слот ${slotIndex}`;
    const classes = [
      "quick-slot-btn",
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
        ${skill ? `<span class="quick-slot-count">${skill.manaCost}</span>` : ""}
      </button>
    `;
  }).join("");

  return `
    <div class="quickbar" aria-label="Панель быстрого доступа">
      ${slotButtons}
    </div>
  `;
}

function renderActiveEffects(state) {
  const effects = collectActiveEffects(state);
  const content = effects.length
    ? effects.map((effect) => {
      const centerBadge = effect.badge || "";
      const detailRows = [
        effect.remainingText ? `<p><strong>Осталось:</strong> ${effect.remainingText}</p>` : "",
        effect.description ? `<p><strong>Эффект:</strong> ${effect.description}</p>` : "",
        effect.stacksText ? `<p><strong>Стаки:</strong> ${effect.stacksText}</p>` : "",
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
    : `<span class="active-effects-empty">—</span>`;
  return `
    <aside class="active-effects-panel" aria-label="Активные эффекты">
      <h4>Эффекты</h4>
      <div class="active-effects-icons">${content}</div>
    </aside>
  `;
}

function collectActiveEffects(state) {
  const run = state.run || {};
  const stacks = state.playerSheet?.effectStacks || {};
  const effects = [];
  if ((run.nextHitMultiplier || 1) > 1) {
    effects.push({
      name: "Колба специй",
      icon: "🧪",
      badge: "1",
      remainingText: "1 применение",
      description: `Следующий удар x${run.nextHitMultiplier}.`,
      stacksText: "1",
    });
  }
  if (run.mirrorVeil?.charges > 0) {
    effects.push({
      name: "Зеркальная вуаль",
      icon: "🪞",
      badge: String(run.mirrorVeil.charges),
      remainingText: `${run.mirrorVeil.charges} применений`,
      description: `Снижает входящий урон на ${run.mirrorVeil.reduction}.`,
      stacksText: "1",
    });
  }
  const bandage = (run.overTimeEffects || []).find((effect) => effect.type === "bandage_regen");
  if (bandage?.turnsLeft > 0) {
    effects.push({
      name: "Перевязать раны",
      icon: "🩹",
      badge: `${bandage.turnsLeft}t`,
      remainingText: `${bandage.turnsLeft} ходов`,
      description: `Восстанавливает ${bandage.healPerTurn} HP каждый ход.`,
      stacksText: "1",
    });
  }
  if ((stacks.hard_cheese || 0) > 0) {
    effects.push({
      name: "Твердый сыр",
      icon: "🧀",
      badge: "∞",
      remainingText: "До конца забега",
      description: "Постоянно увеличивает HP_MAX на 5.",
      stacksText: `${stacks.hard_cheese} (суммарно +${stacks.hard_cheese * 5} HP_MAX)`,
    });
  }
  if ((stacks.common_cracker || 0) > 0) {
    effects.push({
      name: "Сухарик",
      icon: "🥨",
      badge: "∞",
      remainingText: "До конца забега",
      description: "Постоянно увеличивает HP_MAX на 4.",
      stacksText: `${stacks.common_cracker} (суммарно +${stacks.common_cracker * 4} HP_MAX)`,
    });
  }
  if ((stacks.rare_royal_cheese || 0) > 0) {
    effects.push({
      name: "Королевский сыр",
      icon: "👑",
      badge: "∞",
      remainingText: "До конца забега",
      description: "Постоянно увеличивает HP_MAX на 1.",
      stacksText: `${stacks.rare_royal_cheese} (суммарно +${stacks.rare_royal_cheese} HP_MAX)`,
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
