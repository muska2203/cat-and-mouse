export function buildGameScreenHtml({
  portrait,
  run,
  sheet,
  displaySheet,
  previewSheet,
  effects,
  quickbarHtml,
  equipRows,
  inventoryCellsHtml,
  consumableCellsHtml,
  skillsHtml,
  esc,
  getUiStatIcon,
  getUiStatName,
  getValueDeltaClass,
  renderModal,
}) {
  return `
    <div class="cm-app cm-app--game">
      <div class="cm-main">
        <aside class="cm-col cm-col--left">
          <section class="cm-panel cm-panel--hero" aria-labelledby="hero-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span><span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span><span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span><span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="hero-title">Герой</h2>
            <div class="cm-panel__body">
              <div class="cm-hero-portrait"><div class="cm-portrait-ring"><div class="cm-portrait-inner"><img src="${portrait.imageSrc}" width="112" height="112" alt="${esc(portrait.name)}" /></div></div><button class="cm-level-badge" type="button" data-action="secret-level-up" aria-label="Скрытое повышение уровня">${sheet?.level || 1}</button></div>
              <div class="cm-bar cm-bar--hp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="./src/assets/icons/ui/hp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>HP</span><span>${displaySheet?.stats?.HP || 0} / ${displaySheet?.stats?.HP_MAX || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((displaySheet?.stats?.HP || 0) / Math.max(1, displaySheet?.stats?.HP_MAX || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--mana"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="./src/assets/icons/ui/mana.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Мана</span><span>${displaySheet?.mana || 0} / ${displaySheet?.manaMax || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((displaySheet?.mana || 0) / Math.max(1, displaySheet?.manaMax || 1)) * 100)))}%"></div></div></div></div></div>
              <div class="cm-bar cm-bar--xp"><div class="cm-bar__row"><span class="cm-bar__icon-wrap"><img class="cm-bar__icon" src="./src/assets/icons/ui/xp.svg" width="22" height="22" alt="" /></span><div class="cm-bar__content"><div class="cm-bar__label"><span>Опыт</span><span>${sheet?.xp || 0} / ${sheet?.xpToNext || 1}</span></div><div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round(((sheet?.xp || 0) / Math.max(1, sheet?.xpToNext || 1)) * 100)))}%"></div></div></div></div></div>
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
            <div class="cm-panel__body"><div class="cm-log"><p class="cm-log__line cm-log__line--with-icon"><img class="cm-log__mark" src="./src/assets/icons/ui/log.svg" width="16" height="16" alt="" /><span class="cm-log__text">${esc(run?.lastLog || "—")}</span></p></div></div>
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
                  <footer class="cm-hotbar-wrap cm-panel cm-hotbar-wrap--in-field cm-hotbar-wrap--recessed"><span class="cm-rivet cm-rivet--tl"></span><span class="cm-rivet cm-rivet--tr"></span><span class="cm-rivet cm-rivet--bl"></span><span class="cm-rivet cm-rivet--br"></span><div class="cm-hotbar">${quickbarHtml}</div></footer>
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
}
