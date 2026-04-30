import { CLASS_CONFIG } from "./state.js";
import { createPlayerSheet } from "./state.js";
import { EQUIP_TYPES } from "./loadout.js";
import { getItemById } from "./loadout.js";
import { applyLoadoutToSheet } from "./loadout.js";
import { getDefaultStarterLoadout } from "./loadout.js";

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
  HP_MAX: "HP+",
  HP: "HP",
};

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
    .map((item) => `<li><span>${item.icon || getItemIcon(item.type)}</span><strong>${item.name}</strong></li>`)
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
          <ul class="stats-list">
            ${renderStatsList(buildWelcomeStats(selectedSheet))}
          </ul>
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
          <section class="stats-group">
            <ul class="stats-list">
              ${renderStatsList({
                STR: state.playerSheet?.stats?.STR ?? 0,
                INT: state.playerSheet?.stats?.INT ?? 0,
                AGI: state.playerSheet?.stats?.AGI ?? 0,
                LUK: state.playerSheet?.stats?.LUK ?? 0,
              })}
            </ul>
          </section>
          <section class="stats-group">
            <h4>Остальные</h4>
            <ul class="stats-list">
              ${renderStatsList({
                ATK_PHYS: state.playerSheet?.derived?.ATK_PHYS ?? 0,
                ATK_MAGIC: state.playerSheet?.derived?.ATK_MAGIC ?? 0,
                CRIT_CHANCE: state.playerSheet?.derived?.CRIT_CHANCE ?? 0,
                CRIT_MULT: state.playerSheet?.derived?.CRIT_MULT ?? 0,
              })}
            </ul>
          </section>
          <p class="run-log">${state.run.lastLog || "—"}</p>
        </article>
      </div>
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
    .map((id) => getItemById(id))
    .filter(Boolean)
    .map((item) => `<li><span>${item.icon || getItemIcon(item.type)}</span><strong>${item.name}</strong></li>`)
    .join("");

  return `
    <section class="screen" aria-label="Финальный экран">
      <h1 class="screen-title">${title}</h1>
      <p class="screen-subtitle">${subtitle} Ходы: ${state.run.turns}.</p>
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
    </section>
  `;
}

function renderInventoryPanel(state) {
  const equipped = state.playerSheet?.equippedByType || {};
  const bagIds = state.playerSheet?.bag || [];

  const slots = EQUIP_TYPES.map((type) => {
    const itemId = equipped[type];
    const item = itemId ? getItemById(itemId) : null;
    return `
      <li class="slot-item">
        <div>
          <span>${toRuType(type)}</span>
          <strong>${item ? item.name : "пусто"}</strong>
        </div>
        <small class="item-bonus">${item ? formatItemBonuses(item) : "—"}</small>
      </li>
    `;
  }).join("");

  const bagIcons = bagIds.length
    ? bagIds
        .map((itemId, bagIndex) => {
          const item = getItemById(itemId);
          if (!item) {
            return "";
          }

          return `
            <button
              class="bag-icon"
              type="button"
              data-action="bag-item-action"
              data-item-id="${item.id}"
              data-bag-index="${bagIndex}"
              title="${item.name} (${toRuType(item.type)}): ${localizeStatText(item.effectText)}"
            >
              <span class="bag-icon-glyph">${item.icon || getItemIcon(item.type)}</span>
              <span class="bag-icon-bonus">${formatItemBonuses(item)}</span>
            </button>
          `;
        })
        .join("")
    : `<p class="empty-bag">Сумка пуста</p>`;

  return `
    <article class="class-card inventory-panel">
      <h3>Инвентарь</h3>
      <p class="inventory-tip">Экипировка: обмен слота. Расходники: применяются и исчезают.</p>
      <ul class="stats-list">
        ${slots}
      </ul>
      <h4 class="bag-title">Сумка</h4>
      <div class="bag-grid">
        ${bagIcons}
      </div>
    </article>
  `;
}

function renderStatsList(statsObject) {
  return Object.entries(statsObject)
    .map(([name, value]) => `<li><span>${toRuStatName(name)}</span><strong>${value}</strong></li>`)
    .join("");
}

function toRuType(itemType) {
  if (itemType === "weapon") return "оружие";
  if (itemType === "armor") return "броня";
  if (itemType === "amulet") return "амулет";
  if (itemType === "consumable") return "расходник";
  return itemType;
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

function formatItemBonuses(item) {
  const entries = Object.entries(item.statBonuses || {});
  if (entries.length === 0) {
    return "ЭФ";
  }

  return entries
    .map(([statName, value]) => `+${toCompactStatName(statName)}${value}`)
    .join(" ");
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

function buildWelcomeStats(playerSheet) {
  return {
    STR: playerSheet?.stats?.STR ?? 0,
    INT: playerSheet?.stats?.INT ?? 0,
    AGI: playerSheet?.stats?.AGI ?? 0,
    LUK: playerSheet?.stats?.LUK ?? 0,
    HP: playerSheet?.stats?.HP_MAX ?? 0,
    ATK_PHYS: playerSheet?.derived?.ATK_PHYS ?? 0,
    ATK_MAGIC: playerSheet?.derived?.ATK_MAGIC ?? 0,
    CRIT_CHANCE: playerSheet?.derived?.CRIT_CHANCE ?? 0,
    CRIT_MULT: playerSheet?.derived?.CRIT_MULT ?? 0,
  };
}
