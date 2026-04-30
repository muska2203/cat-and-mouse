import { CLASS_CONFIG } from "./state.js?v=0.1.1-pre-alpha";
import { createPlayerSheet } from "./state.js?v=0.1.1-pre-alpha";
import { EQUIP_TYPES } from "./loadout.js?v=0.1.1-pre-alpha";
import { getItemById } from "./loadout.js?v=0.1.1-pre-alpha";
import { applyLoadoutToSheet } from "./loadout.js?v=0.1.1-pre-alpha";
import { getDefaultStarterLoadout } from "./loadout.js?v=0.1.1-pre-alpha";
import { spendLevelUpPoint } from "./loadout.js?v=0.1.1-pre-alpha";
import { swapItemFromBag } from "./loadout.js?v=0.1.1-pre-alpha";
import { APP_TITLE } from "./app-config.js?v=0.1.1-pre-alpha";
import { APP_VERSION } from "./app-config.js?v=0.1.1-pre-alpha";

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
              })}
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
        <canvas id="gameCanvas" class="game-canvas" width="800" height="500"></canvas>
        <article class="class-card game-side">
          <h3>Параметры мышонка</h3>
          ${renderHpBar(state.playerSheet)}
          ${renderXpBar(state.playerSheet)}
          <p class="progression-line">Уровень: ${state.playerSheet?.level ?? 1}</p>
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
      <div class="mobile-controls" aria-label="Управление с телефона">
        <button class="btn mobile-move-btn mobile-up" type="button" data-action="mobile-move" data-direction="up">▲</button>
        <button class="btn mobile-move-btn mobile-left" type="button" data-action="mobile-move" data-direction="left">◀</button>
        <button class="btn mobile-move-btn mobile-down" type="button" data-action="mobile-move" data-direction="down">▼</button>
        <button class="btn mobile-move-btn mobile-right" type="button" data-action="mobile-move" data-direction="right">▶</button>
      </div>
      ${renderBuildBadge()}
    </section>
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
            ${renderStatsList(buildFullStats(state.playerSheet))}
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
    return `
      <li class="slot-item">
        <span class="slot-name">${toRuType(type)}</span>
        ${item
          ? `
            <div class="bag-icon slot-equipped-card" title="${item.name}">
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
    const itemsForType = [...bagEntries]
      .map((entry) => {
        const item = getItemById(entry.itemId);
        if (!item || item.type !== type) {
          return null;
        }
        return {
          ...entry,
          item,
          statsSum: getItemStatsSum(item),
          bagIndex: bagEntries.findIndex((bagEntry) => bagEntry.instanceId === entry.instanceId),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.statsSum !== a.statsSum) {
          return b.statsSum - a.statsSum;
        }
        return String(a.instanceId).localeCompare(String(b.instanceId));
      });

    const content = itemsForType.length
      ? itemsForType
          .map((entry) => {
            const equippedItemId = equipped?.[type];
            const equippedItem = equippedItemId ? getItemById(equippedItemId) : null;
            return `
              <button
                class="bag-icon"
                type="button"
                data-action="bag-item-action"
                data-item-id="${entry.item.id}"
                data-bag-instance-id="${entry.instanceId}"
                data-bag-index="${entry.bagIndex}"
                title="${entry.item.name} (${toRuType(entry.item.type)}): ${localizeStatText(entry.item.effectText)}"
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
    </article>
  `;
}

function renderStatsList(statsObject) {
  return Object.entries(statsObject)
    .map(([name, value]) => `<li><span>${toRuStatName(name)}</span><strong>${value}</strong></li>`)
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
      return `<li><span>${toRuStatName(key)}</span><strong>${baseValue}${totalMarkup}</strong></li>`;
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
      return `<li><span>${toRuStatName(name)}</span><div class="stat-value-with-upgrade"><strong>${value}</strong>${upgradeButton}</div></li>`;
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
          <span>${toRuStatName(key)}</span>
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
      return `<li><span>${toRuStatName(key)}</span><strong class="${previewClass}">${shown}</strong></li>`;
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

function getItemStatsSum(item) {
  return Object.values(item?.statBonuses || {}).reduce((sum, value) => sum + value, 0);
}

function toCompactStatName(statName) {
  return STAT_LABELS_COMPACT[statName] || statName;
}

function toRunStatusRu(status) {
  if (status === "victory") return "ПОБЕДА";
  if (status === "defeat") return "ПОРАЖЕНИЕ";
  return "В ПУТИ";
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
  return `<p class="build-badge">${APP_TITLE} · v${APP_VERSION}</p>`;
}
