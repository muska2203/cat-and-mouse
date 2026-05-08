import { getRunEndingSummaryMetrics } from "../../game/runTotals.js?v=0.5.4-pre-alpha";

export function buildEndingScreenHtml({
  portrait,
  run,
  sheet,
  isVictory,
  title,
  subtitle,
  durationLabel,
  equipRows,
  esc,
  getUiStatIcon,
  getUiStatName,
  renderModal,
  footerMetaHtml = "",
}) {
  const m = getRunEndingSummaryMetrics(run);
  return `
    <div class="cm-app cm-ending-app">
      <div class="cm-main cm-ending-main">
        <aside class="cm-col cm-col--left">
          <section class="cm-panel cm-panel--fill">
            <span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span>
            <h2 class="cm-panel__title">Карточка героя</h2>
            <div class="cm-panel__body">
              <div class="cm-hero-portrait"><div class="cm-portrait-ring"><div class="cm-portrait-inner"><img src="${portrait.imageSrc}" width="112" height="112" alt="${esc(portrait.name)}" /></div></div><div class="cm-level-badge">${sheet?.level || 1}</div></div>
              <div class="cm-bar cm-bar--hp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="./src/assets/icons/ui/hp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>HP</span><span>${sheet?.stats?.HP || 0} / ${sheet?.stats?.HP_MAX || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.stats?.HP || 0) / Math.max(1, sheet?.stats?.HP_MAX || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--mana"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="./src/assets/icons/ui/mana.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Мана</span><span>${sheet?.mana || 0} / ${sheet?.manaMax || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.mana || 0) / Math.max(1, sheet?.manaMax || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--xp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="./src/assets/icons/ui/xp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Опыт</span><span>${sheet?.xp || 0} / ${sheet?.xpToNext || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.xp || 0) / Math.max(1, sheet?.xpToNext || 1)) * 100)))}%"></div></div></div></div></div>
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
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Ходов</span><span class="cm-ending-metric__value">${m.totalTurns}</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Убито противников</span><span class="cm-ending-metric__value">${m.enemiesKilled}</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Достигнут уровень лабиринта</span><span class="cm-ending-metric__value">${m.deepestLevel}</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Открыто сундуков</span><span class="cm-ending-metric__value">${m.chestsOpened}</span></div>
                <div class="cm-ending-metric"><span class="cm-ending-metric__label">Подобрано предметов</span><span class="cm-ending-metric__value">${m.itemsPickedUp}</span></div>
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
      ${footerMetaHtml}
    </div>
    ${renderModal()}
  `;
}
