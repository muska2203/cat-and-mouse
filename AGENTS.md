# AGENTS.md — контекст для Cursor

Документ для ИИ-агента и людей: **не выдумывать** доменные термины и правила — при сомнениях сверяться с кодом и с разделами ниже. Раздел «Глоссарий» согласован с автором и дополнен только явными фактами из репозитория (имена полей, файлы).

---

## Проверяемые факты (из репозитория)

- **Стек:** статический фронт, без фреймворка; ES-модули в браузере.
- **Точка входа:** [`index.html`](index.html) подключает [`src/main.js`](src/main.js) (`type="module"`).
- **Версия в URL:** у [`index.html`](index.html) у скрипта и стилей query-параметр `?v=…` — должен совпадать с [`APP_VERSION`](src/app-config.js) в [`src/app-config.js`](src/app-config.js) и с суффиксом `?v=` во всех ES-импортах под `src/`. Синхронизация одной командой: [`scripts/set-app-version.mjs`](scripts/set-app-version.mjs) (см. правило ниже про основную ветку).
- **Стили:** [`styles.css`](styles.css).

### Список модулей `src/`

| Файл | Назначение (кратко; **дополните сами**) |
|------|----------------------------------------|
| [`main.js`](src/main.js) | Главный рантайм приложения: события DOM/клавиатуры, orchestration хода, HUD и связка модулей; «тонкая точка склейки», без дублирования бизнес-логики модулей `game/*` и `items/*`. |
| [`state.js`](src/state.js) | Инициализация `state` и стартового `playerSheet`, базовые константы прогрессии и pre-game параметров. |
| [`game.js`](src/game.js) | Оркестрация ядра забега: создание run-state/следующего уровня, пути к клетке и реэкспорты игровых подмодулей (`runSkills`, `playerStep`, `environmentTurn`). |
| [`render.js`](src/render.js) | Отрисовка игрового canvas (`drawRunToCanvas`): клетки, объекты, туман, анимации и боевые/служебные оверлеи. |
| [`ui.js`](src/ui.js) | Рендер HTML-экрана (`welcome`/`game`/`ending`), разметка HUD/инвентаря/быстрых слотов и утилиты представления UI-данных. |
| [`rules.js`](src/rules.js) | Базовые числовые правила боя и статов: округления HP, профили оружия, derived-статы, расчёт ближней атаки. |
| [`skills.js`](src/skills.js) | Каталог ядровых скиллов (`SKILL_DEFS`), доступ к дефам и формирование текста подсказок по скиллам. |
| [`loadout.js`](src/loadout.js) | Каталог предметов/лут-пулы, операции инвентаря/экипировки, пересчёт листа персонажа и привязка apply-функций расходников. |
| [`maze.js`](src/maze.js) | Генерация лабиринта и стартовых данных уровня (`generateMazeRun`, legacy-вариант для совместимости/сравнения). |
| [`app-config.js`](src/app-config.js) | Константы приложения (название, версия, GA id). |
| [`analytics.js`](src/analytics.js) | Инициализация и отправка аналитики (GA4): `initAnalytics`, `trackEvent`, генерация id забега. |
| [`strings/ru.js`](src/strings/ru.js) | Статические строки UI (экраны, справка, бейдж, активные эффекты, подписи карточки предмета). |
| [`items/itemPresentation.js`](src/items/itemPresentation.js) | Тултипы и тексты логов применения расходников (единый источник для [`ui.js`](src/ui.js), [`consumables.js`](src/game/consumables.js), [`consumableApply.js`](src/items/consumableApply.js)). |
| [`items/consumableApply.js`](src/items/consumableApply.js) | Логика применения расходников: функции по `id`, привязка `applyWhenUsed` к объектам каталога в [`loadout.js`](src/loadout.js). |
| [`player/statCopy.js`](src/player/statCopy.js) | Тултипы описаний характеристик персонажа. |
| [`ui/inventoryPopover.js`](src/ui/inventoryPopover.js) | DOM-контроллер всплывающей карточки предмета; подключается из [`main.js`](src/main.js). |
| [`nav/pathfinding.js`](src/nav/pathfinding.js) | Сетка и поиск пути: `DIRS_8`, границы/стены, эвристика, A* к цели и к ближайшей клетке атаки; блокировка клеток задаётся снаружи ([`game.js`](src/game.js)). |
| [`nav/lineOfSight.js`](src/nav/lineOfSight.js) | Луч Брезенхэма и проверка видимости по сетке стен (`hasLineOfSightOnGrid`); туман — см. [`fogReveal.js`](src/game/fogReveal.js). |
| [`game/rng.js`](src/game/rng.js) | `randomInt`, `randomPick`, `weightedPick` для лута и раскладки уровня ([`game.js`](src/game.js)). |
| [`game/chestLoot.js`](src/game/chestLoot.js) | Число и редкость сундуков на уровень, выпадение предметов из сундука (пулы из [`loadout.js`](src/loadout.js), LUK). |
| [`game/cellObjects.js`](src/game/cellObjects.js) | `ACTOR_KIND`, объекты на клетке (`getObjectsAt`), блокировка (`getBlockingObjectAt`, `isObjectBlockingForActor`), активация (`canObjectBeActivatedBy`), удаление объекта (`removeObject`). |
| [`game/xp.js`](src/game/xp.js) | Опыт за врага и начисление XP / уровней (`getXpForEnemy`, `applyXpGain`). |
| [`game/enemySpawn.js`](src/game/enemySpawn.js) | Подсчёт врагов по уровню и площади (`getEnemyCountsForLevel`). |
| [`game/enemies.js`](src/game/enemies.js) | Поиск врага рядом с игроком и по id (`findNearestEnemy`, `getEnemyById`). |
| [`game/syncHp.js`](src/game/syncHp.js) | Синхронизация `stats.HP` / `baseStats.HP` с полом по [`floorHp`](src/rules.js). |
| [`game/trapsAndClouds.js`](src/game/trapsAndClouds.js) | Статусы оглушения, эффекты ловушек на игрока/врага, ядовитое облако, тик `poison_cloud`. |
| [`game/cellActivation.js`](src/game/cellActivation.js) | Активация объектов на клетке (сундук, лут, ловушки, облако, цель уровня); высыпание лута рядом с сундуком. |
| [`game/levelSpawn.js`](src/game/levelSpawn.js) | Выбор старта и цели по комнатам лабиринта (`planStartAndGoalSpawn`), BFS по проходимым клеткам. |
| [`game/generateObjects.js`](src/game/generateObjects.js) | Размещение сундуков и врагов на лабиринте (`generateObjects`). |
| [`game/cellBlocking.js`](src/game/cellBlocking.js) | Блокировка клеток для пути и врагов (`defaultCellBlocked`, `isCellBlockedForEnemy*`). |
| [`game/fogReveal.js`](src/game/fogReveal.js) | Открытие тумана вокруг игрока (`revealAroundPlayer`). |
| [`game/turnEffects.js`](src/game/turnEffects.js) | Тик `overTimeEffects` на ход игрока (`bandage_regen`, `poison_player`). |
| [`game/trapPlacement.js`](src/game/trapPlacement.js) | Соседние свободные клетки для установки ловушки (`getTrapPlacementCells`). |
| [`game/consumables.js`](src/game/consumables.js) | Оркестрация применения расходника (ловушки — промпт; иначе `resolveConsumableApply`) и установка ловушки (`placeTrap`). |
| [`game/playerStep.js`](src/game/playerStep.js) | Ход игрока по клетке и бой в упор (`tryStep`). |
| [`game/environmentTurn.js`](src/game/environmentTurn.js) | Старт и тик фазы окружения (`beginEnvironmentTurn`, `stepEnvironmentTurn`). |
| [`game/runSkills.js`](src/game/runSkills.js) | Использование скиллов в забеге (`useSkill`, `useSkillAtCell`, `getSkillTargetCells`). |
| [`ui/hudFormat.js`](src/ui/hudFormat.js) | Формат чисел для полосок HUD в [`main.js`](src/main.js). |
| [`input/moveKeys.js`](src/input/moveKeys.js) | Карта клавиш → направление шага; [`resolveMoveDirectionFromEvent`](src/input/moveKeys.js). |
| [`input/gameControls.js`](src/input/gameControls.js) | Ввод с клавиатуры, общий для UI: сейчас — цифры / numpad → индекс быстрого слота. |
| [`runtime/gameLoop.js`](src/runtime/gameLoop.js) | Обёртка `requestAnimationFrame` ([`startAnimationLoop`](src/runtime/gameLoop.js)); тик с логикой остаётся в [`main.js`](src/main.js). |
| [`runtime/motionTiming.js`](src/runtime/motionTiming.js) | Активность `motion` / `environmentMotion`, сброс завершённых анимаций, фаза `levelTransition` — по `(run, nowMs)` без глобального state. |
| [`runtime/canvasGrid.js`](src/runtime/canvasGrid.js) | Клик по canvas → клетка (`screenPointToGrid`); проверка клетки для превью/автопути (`isValidPathTargetCell`). |
| [`runtime/canvasRunHandlers.js`](src/runtime/canvasRunHandlers.js) | Фабрика `createCanvasRunHandlers`: клик/hover по canvas, автопоход (`lockAutoPathToCell`, `maybeRunAutoMoveStep`); подключается из [`main.js`](src/main.js). |

Бэклог идей: [`IDEAS.md`](IDEAS.md).

---

## Глоссарий и основные понятия

### Экраны приложения

1. **Экран выбора / настройки персонажа** — начальный экран: распределение начальных характеристик и выбор стартового снаряжения (до лимита обычных предметов), затем старт забега.

2. **Основной игровой экран** — экран, где идёт забег: сетка-лабиринт (клетки), по мере исследования открывается туман войны; отображаются объекты на открытых клетках, цель уровня, фаза хода, автопуть и подсветка целей скиллов (см. [`renderGameScreen`](src/ui.js), [`drawRunToCanvas`](src/render.js)).

   **Имена в коде:** `state.screen === "welcome" | "game" | "ending"` ([`ui.js`](src/ui.js) — `renderApp`).

   **Что именно показывается про персонажа на этом экране (по коду UI, без доменных дополнений):**
   - **Слева панель «Инвентарь»:** слоты экипировки (`weapon`, `armor`, `amulet`), сумка по секциям (оружие / броня / амулеты / расходники), мини-панель **изученных** скиллов из ядра (`getCoreSkillDefs`), с манакостом на кнопке.
   - **По центру:** бейдж фазы хода («Ход игрока» / «Ход окружения»), canvas с картой, блок **«Эффекты»** (см. `renderActiveEffects` / `collectActiveEffects` — буст следующего удара, перевязь, стаки сыров/сухарей и т.д.), **быстрые слоты** 1–9, мобильные кнопки шага.
   - **Справа «Параметры персонажа»:** полосы HP, маны, XP; уровень персонажа; очки прокачки (`unspentPoints`); блок «Характеристики» — STR, INT, AGI, LUK с кнопками «+1» при наличии очков; блок «Остальные» — `HP_MAX`, шанс крита, множитель крита, базовый урон оружия (как в UI); строка журнала забега `run.lastLog`.

3. **Победный / поражения экран** — итог забега (`run.status === "victory" | ...`), краткий текст, ходы, уровень лабиринта, уровень и XP персонажа, сводка статов / экипировки / сумки ([`renderEndingScreen`](src/ui.js)).

### Персонаж, снаряжение, скиллы, эффекты (смысл от автора + привязка к коду)

- **Слоты** — типы `weapon`, `armor`, `amulet` ([`EQUIP_TYPES`](src/loadout.js)); оружие задаёт профиль ближнего боя через [`getWeaponCombatProfile`](src/rules.js) / [`buildDerivedStats`](src/rules.js). Остальные предметы в основном дают бонусы к статам (и свой текст эффекта в данных).

- **Сумка** — предметы вне слотов: массив `playerSheet.bag` (записи с `instanceId`, `itemId`), обмен со слотами и использование расходников ([`loadout.js`](src/loadout.js), обработчики в [`main.js`](src/main.js)).

- **Скиллы** — в данных персонажа: `playerSheet.skills[skillId]` — `learned`, `level` для скиллов из [`getCoreSkillDefs`](src/skills.js). **Скиллы предметов (оружия и др.)** — задумка автора; в UI слева сейчас выводятся только изученные **ядровые** скиллы (`listSkillsForUi` → `getCoreSkillDefs`). Поведение «скиллы оружия только в слоте» — **на проверку**, см. пометку в [`IDEAS.md`](IDEAS.md).

- **Активные эффекты** — на основном экране: комбинация `run` (например `nextHitMultiplier`, `overTimeEffects`) и `playerSheet.effectStacks` ([`collectActiveEffects`](src/ui.js)).

- **Быстрые слоты** — `state.uiHud.quickbarSlots` (9 слотов), payload вида `skill` / `consumable` ([`renderQuickbar`](src/ui.js), логика в [`main.js`](src/main.js)); клавиши 1–9 и справка в модалке помощи.

### Игровые объекты на поле

**Авторская классификация (проходимость, активация и т.д.)** — см. подпункты ниже.

**Что есть в коде как сущности на карте / в забеге (для согласования терминов):**

| В коде (`run.objects` / логика) | Кратко по коду | Нужно ли уточнить у автора |
|---------------------------------|----------------|----------------------------|
| `type: "enemy"` | Враг на клетке, блокирует ход игрока; свои `data` (HP, урон и т.д.) | Вы уже описали как «Противник» — ок |
| `type: "chest"` | Сундук | Ок |
| `type: "ground_loot"` | Лут на земле (`purpose: "ground_loot"`) | Соответствует вашему «лут как объект на клетке» |
| `type: "trap"` | **Ловушка** — см. определение ниже | Ок |
| `type: "poison_cloud"` | **Ядовитое облако** — см. определение ниже (ранее в коде: `trap_cloud`) | Ок |
| **Цель уровня («нор» / выход)** | В коде это **не** элемент `run.objects`, а координаты **`run.goal`**; на canvas рисуется значок, если клетка открыта ([`render.js`](src/render.js)) | Совпадает с вашим п. 3.5 по смыслу; в коде — `goal` |

**Не объекты на клетке, а эффекты забега / игрока:**

- Записи в `run.overTimeEffects` с `type: "poison_player"`, `"bandage_regen"` ([`turnEffects.js`](src/game/turnEffects.js)) — обработка ходов, не тип в `run.objects` в том же смысле, что сундук.

**Персонаж на карте:** позиция в `run.player` (координаты); долгоживущие характеристики и инвентарь — в `state.playerSheet`.

### Ловушка и ядовитое облако (автор)

- **Ловушка** (`type: "trap"` в [`game.js`](src/game.js)) — проходимый игровой объект, который активируется персонажем или противником и выполняет заложенную в нём логику (урон, станы, спавн других объектов и т.д.).

- **Ядовитое облако** (`type: "poison_cloud"`) — зона на клетках: появляется от срабатывания **определённой** ловушки (флаг `spawnPoisonCloud` + [`spawnPoisonCloudObjects`](src/game/trapsAndClouds.js)), живёт ограниченное число ходов (`data.durationTurns`, тикает в [`tickTemporaryObjects`](src/game/trapsAndClouds.js)); при входе игрока или врага на клетку с облаком срабатывает `activation.effect === "trigger_poison_cloud"` — урон и/или отравление по `data.trapConfig` ([`applyObjectActivationOnCell`](src/game/cellActivation.js))). Отрисовка — отдельным слоем поверх обычных объектов ([`render.js`](src/render.js)).

### Ваши пункты глоссария (как в запросе)

- **3.1 Персонаж** — игрок напрямую управляет им; сумка, снаряжение, скиллы, состояния, лимит действий за ход и т.д. *(В коде разделение: лист персонажа `playerSheet`, позиция на уровне `run.player`.)*

- **3.2 Сундук** — статичный активируемый проходимый контейнер с лутом при активации.

- **3.3 Противник** — непроходимый для игрока объект, логика преследования / урона и т.д.

- **3.4 Лут на клетке** — статичный активируемый проходимый объект, при активации выдаёт предмет.

- **3.5 Нора / выход** — статичный активируемый проходимый объект, переход на следующий уровень. *(В коде: достижение клетки `run.goal`.)*

---

## Характеристики персонажа — выжимка из кода **на ревью автора**

Ниже — что реально лежит в [`createPlayerSheet`](src/state.js) / пересчёте [`recalculateSheetFromInventory`](src/loadout.js) и производных [`buildDerivedStats`](src/rules.js), и **что показывается на основном игровом экране** в правой колонке.

### Поля `playerSheet` (структурно)

| Область | Поля / ключи | Заметка |
|---------|----------------|---------|
| База и итог статов | `baseStats`, `stats` | Ключи включают `STR`, `INT`, `AGI`, `LUK`, `VISION`, `HP`, `HP_MAX` (формула HP_MAX: 100 + СИЛ×8 + временные бонусы из [`loadout.js`](src/loadout.js) / `bonusHpMaxFromEffects`) |
| Производные | `derived` | `HP_MAX_COMPUTED`, `ATK_PHYS`, `ATK_MAGIC`, `CRIT_CHANCE`, `CRIT_MULT`, `WEAPON_DAMAGE` |
| Ресурсы | `mana`, `manaMax` | `manaMax` пересчитывается от ИНТ |
| Прогрессия | `level`, `xp`, `xpToNext`, `unspentPoints`, `skillPoints` | Очки прокачки на экране — `unspentPoints` |
| Скиллы | `skills[skillId]` | `{ learned, level }` для ядровых определений |
| Стаки «сыров» | `effectStacks.hp_max_plus_5`, `hp_max_plus_4`, `hp_max_plus_1` | Влияют на отображаемые эффекты и HP_MAX |
| Прочее | `bonusHpMaxFromEffects`, `equippedByType`, `bag`, `loadout` | Экипировка и сумка |

### Что видит игрок в правой колонке «Параметры персонажа»

- Полосы: **HP**, **мана**, **XP**.
- **Уровень**, **очки прокачки** (`unspentPoints`).
- **Характеристики:** только **STR, INT, AGI, LUK** (с кнопками улучшения при очках).
- **Остальные:** **HP_MAX**, **CRIT_CHANCE**, **CRIT_MULT**, **WEAPON_DAMAGE** (в UI подпись `WEAPON_DM`).

### Есть в `stats` / `derived`, но не вынесено в эту правую колонку «Остальные»

- **`VISION`** — есть в `stats` после старта, в [`ui.js`](src/ui.js) для игрового экрана отдельной строкой не выводится (используется логикой карты / тумана в [`game.js`](src/game.js)).
- **`ATK_PHYS`, `ATK_MAGIC`, `HP_MAX_COMPUTED`** — считаются в `derived`, на главной правой панели не показаны (есть в финальном экране через `buildFullStats` частично не все — см. [`buildFullStats`](src/ui.js): STR…LUK, HP, HP_MAX, CRIT_*, WEAPON_DM).

Если что-то из этого должно называться и отображаться иначе — поправьте формулировки в этом файле.

### Идеи для расширения глоссария (вопросы к автору)

- Нужно ли **дублировать в глоссарии** описание фазы хода и ходов (`run.turnPhase`, `run.turns`) — базовое поведение в фазе окружения см. подраздел «Фаза „ход окружения“…» в разделе про поток.
- Нужен ли отдельный **термин в глоссарии** для автопути (`uiHud.pathLockedCells`, отмена по `mouseup` при `autoMoveActive`) — см. тот же подраздел.

---

## Поток данных и экраны

Минимальный фактический поток по коду (от ввода до кадра):

1. `index.html` грузит `src/main.js`, там создаётся глобальный `state` через `createInitialState`.
2. `renderApp(root, state)` в `ui.js` рисует текущий экран по `state.screen`: `welcome` / `game` / `ending`.
3. В `game`-режиме пользовательский ввод (клавиатура, клики/hover canvas, quickbar, drag&drop) обрабатывается в `main.js` и `runtime/canvasRunHandlers.js`.
4. Обработчики вызывают прикладные функции домена: `tryStep`, `useSkillAtCell`, `useConsumable`, `placeTrap`, `stepEnvironmentTurn`, операции инвентаря из `loadout.js`.
5. Эти функции мутируют `run` и/или `playerSheet` (позиции, HP/мана, `run.objects`, эффекты, фаза хода, логи, анимации), после чего `main.js` обновляет `state`.
6. Тик `requestAnimationFrame` (`startAnimationLoop` → `animationLoop`) ведёт фазовые переходы, автопуть, окружение, завершает анимации и поддерживает HUD-анимации.
7. Каждый кадр `main.js` вызывает `drawRunToCanvas(...)` из `render.js`, а затем `rerender()` синхронизирует DOM/HUD через `renderApp`.
8. Переходы экранов: `welcome -> game` при старте забега; `game -> ending` при `run.status` победа/поражение; новый уровень создаётся через `createNextLevelRun`.

### Фаза «ход окружения», ввод и анимации

- **Ход игрока (лимит действий):** за ход персонаж выполняет **1 действие**. Текущие действия: экипировка предмета из сумки в слот, применение скилла, применение расходника, активация клетки, передвижение на одну клетку.
- **Завершение хода игрока:** после расхода действия запускается фаза окружения; в конце цикла хода тикают эффекты (`overTimeEffects`) и у временных эффектов уменьшается счётчик `turnsLeft` на 1.
- **Ход окружения (лимит действий):** противники действуют в своей фазе, сейчас также с лимитом **1 действие на ход** на сущность (атака/перемещение/действие по ситуации), после чего управление возвращается игроку.
- В фазе **`run.turnPhase === "environment"`** персонаж **не** может двигаться и **ничего** применять (шаг, скиллы, расходники и т.п.). Исключение: **отмена автопохода** — при активном `uiHud.autoMoveActive` отпускание кнопки мыши над canvas сбрасывает маршрут и логирует отмену даже вне хода игрока (см. обработчик `mouseup` в [`main.js`](src/main.js)); дальнейший клик по canvas в эту фазу не обрабатывается как ход.
- **Блокирующая анимация** — основная анимация движения объектов и фазы окружения: `run.motion`, `run.environmentMotion` (и связанные проверки «активна ли анимация» в [`motionTiming.js`](src/runtime/motionTiming.js)); пока она активна, ввод, который зависит от неё, не должен продвигать игру.
- **Неблокирующие анимации** — как правило мелкие эффекты (например всплывающий урон `run.floatingTexts`, тряска `run.screenShake` и т.п.); они не должны удерживать фазу хода и общий прогресс так же, как движение по клеткам.

---

## Правила для агента (стиль работы)

**Заполняет автор.**

- Объём диффов: …
- Что трогать только осознанно: …
- **Язык по умолчанию:** комментарии в коде и пользовательский текст (UI, логи, тултипы) — **русский**, если в задаче явно не выбран другой язык.
- **`instanceId` предметов:** считать `instanceId` глобальным идентификатором экземпляра предмета. Любой экземпляр (в экипировке и в сумке) обязан иметь собственный `instanceId`; при перемещении между слотами/сумкой `instanceId` сохраняется у того же экземпляра и не пересоздаётся без явной причины.
- **Редкость предметов в `ui-new`:** использовать единый вариант подсветки «A» (рамка + мягкое свечение) через классы `item-rarity-common|rare|unique`; не возвращать тестовые варианты на стартовый экран.
- **Отображение урона оружия в `ui-new`:** у оружия показывать **итоговый базовый урон в руках персонажа** (с учётом характеристик), а не сырой `weaponDamage` предмета и не крит/временные множители.
- **Бейджи в `ui-new`:**
  - урон оружия — круглый бейдж с **одним числом** в правом нижнем углу ячейки;
  - количество расходников — круглый бейдж в левом нижнем углу;
  - в экипировке не использовать старые `+1`-метки.
- **Область применения визуала:** правила редкости/беджей держать консистентными на всех экранах `ui-new` — стартовом (`welcome`), игровом (`game`) и итоговом (`ending`).
- **Формулы в UI-текстах:** любые формулы в описаниях/тултипах/карточках UI поддерживать синхронными с реальными расчётами в коде; при изменении игровой формулы обновлять соответствующие тексты в UI в той же задаче.
- **`AGENTS.md`:** не править без явного запроса в задаче; если правка нужна — минимальный дифф, только проверяемые факты из кода/репозитория, без переписывания глоссария и правил от себя.
- **Папка `design/`:** любые правки в `design/` (включая `design/impl`, `design/projects`, `design/avatars` и файлы изображений) вносить **только по прямой инструкции автора** в текущей задаче.
- **Любые правки UI:** перед изменениями сверять с концептом [`design/main_concept.png`](design/main_concept.png) и профильным документом в [`design/projects/`](design/projects/) + соответствующим макетом в [`design/impl/`](design/impl/).
- **Если есть расхождение** между текущим UI и дизайн-проектом — не импровизировать: сначала согласовать направление с пользователем.
- **Десктоп-этап миграции UI:** не добавлять/не возвращать мобильные элементы управления, пока задача явно не требует mobile.

**Расходники (не-ловушки):** не добавлять ветвление по `item.id` в [`consumables.js`](src/game/consumables.js). Новая логика — отдельная функция в [`consumableApply.js`](src/items/consumableApply.js), контекст вызова `{ run, playerSheet, item }`, результат `{ log, restoredMana? }` (`restoredMana` — доп. мана после текста лога, как у сыров с бонусом маны). Зарегистрировать в `CONSUMABLE_APPLY_BY_ID`; при загрузке [`loadout.js`](src/loadout.js) вызывает `attachConsumableApplyToItems` — на объектах каталога появляется поле `applyWhenUsed`. Тексты логов и тултипов — только через [`itemPresentation.js`](src/items/itemPresentation.js).

**Версия и основная ветка (`main`):** перед коммитом или пушем в `main` выполните из корня репозитория `node scripts/set-app-version.mjs --suggest` — скрипт покажет текущую версию и **предложит** следующую (эвристика patch+1). Утвердите номер (или задайте свой), затем `node scripts/set-app-version.mjs <новая_версия>`, чтобы обновить [`src/app-config.js`](src/app-config.js), [`index.html`](index.html) и все `?v=` в импортах под `src/`. Проверка без записи: `node scripts/set-app-version.mjs --dry-run <версия>`. После успешной смены версии обязательно обновляйте [`src/devlog.js`](src/devlog.js): **добавляйте новую запись в начало массива** для этой версии с кратким списком пользовательских изменений.

**Требования к `devlog`:**
- Новая запись добавляется **после** выполнения скрипта смены версии и должна содержать **эту новую версию**.
- Формат хранения — массив записей в [`src/devlog.js`](src/devlog.js), новая запись всегда добавляется **в начало массива**.
- Описание — короткий список изменений, заметных пользователю (механики, UI/UX, поведение).
- Если менялась игровая механика, описывать **что изменилось для игрока**.
- Технические рефакторинги, которые не меняют пользовательское поведение, в `devlog` **не перечислять**.
- На странице `Devlog` показываются только последние 5 версий; структуру данных поддерживать совместимой с этой логикой.

---

## Антипаттерны и «уже решено»

**Заполняет автор.** Чего не предлагать повторно.

