/**
 * Статические строки UI (русский). Шаблоны с подстановкой — функции ниже.
 */

export const STRINGS_RU = {
  fallbackScreen: {
    title: "Экран в разработке",
    subtitle: "Этот экран будет добавлен на следующих шагах.",
  },
  welcome: {
    ariaScreen: "Приветственный экран",
    title: "Доберись до норы... если сможешь",
    subtitleAlloc: "Распредели {points} очков по характеристикам и выбери до {maxItems} предметов обычного качества.",
    subtitleCounters: "Очков осталось: {remaining}. Выбрано предметов: {picked}/{maxItems}.",
    cardStats: "Характеристики",
    cardDerived: "Производные",
    cardStarters: "Стартовые предметы (обычные)",
    startGame: "Начать игру",
  },
  game: {
    ariaScreen: "Игровое поле",
    title: "Квартира-лабиринт",
    subtitleRun:
      "Уровень: {level}/{maxLevel}. WASD: шаг по клетке. Размер карты: {width}x{height}. Ходы: {turns}.",
    noRunTitle: "Забег не создан",
    noRunSubtitle: "Сначала начни игру на экране снаряжения.",
    mobileControlsAria: "Управление с телефона",
    sidePanelTitle: "Параметры мышонка",
    levelLine: "Уровень:",
    pointsLine: "Очки прокачки:",
    statsGroup: "Характеристики",
    derivedGroup: "Остальные",
    runLogEmpty: "—",
  },
  ending: {
    ariaScreen: "Финальный экран",
    missingTitle: "Забег завершен",
    missingSubtitle: "Данные забега отсутствуют.",
    victoryTitle: "Победа!",
    defeatTitle: "Поражение",
    victorySubtitle: "Мышонок добрался до норы.",
    defeatSubtitle: "HP опустилось до нуля, забег завершен.",
    subtitleTurns: "{subtitle} Ходы: {turns}.",
    subtitleMazeLevel: "Достигнут уровень лабиринта: {level}/{maxLevel}.",
    subtitleChar: "Уровень персонажа: {charLevel}. XP: {xp}/{xpToNext}.",
    cardStats: "Характеристики",
    cardEquip: "Экипировка",
    cardBag: "Сумка",
    bagEmptyRow: "<li><span>—</span><strong>пусто</strong></li>",
    toWelcome: "В главное меню",
    bagEmptyLabel: "пусто",
  },
  turnPhase: {
    player: "Ход игрока",
    environment: "Ход окружения",
  },
  inventory: {
    title: "Инвентарь",
    tip: "Экипировка: обмен слота. Расходники: применяются и исчезают.",
    bagHeading: "Сумка",
    emptyBag: "Пусто",
    skillsHeading: "Скиллы",
    noSkills: "Нет скиллов",
  },
  skillsModal: {
    title: "Скиллы",
    subtitle: "Каждые 2 уровня дается 1 очко скилла. Доступно: {skillPoints}",
    close: "Закрыть",
    learn: "Изучить",
    upgrade: "Улучшить",
    manaLine: "Мана:",
    propertyLine: "Свойство:",
    levelLine: "Уровень:",
  },
  quickbar: {
    aria: "Панель быстрого доступа",
    slotTitle: "Слот {n}",
  },
  activeEffects: {
    aria: "Активные эффекты",
    heading: "Эффекты",
    empty: "—",
    labelRemaining: "Осталось:",
    labelEffect: "Эффект:",
    labelStacks: "Стаки:",
    nextHitName: "Колба специй",
    nextHitRemaining: "1 применение",
    nextHitStacks: "1",
    bandageName: "Перевязать раны",
    bandageRemainingTurns: "{n} ходов",
    hardCheeseName: "Твердый сыр",
    hardCheeseRemaining: "До конца забега",
    hardCheeseDesc: "Постоянно увеличивает максимум HP на 5 за приём.",
    crackerName: "Сухарик",
    crackerDesc: "Постоянно увеличивает максимум HP на 4 за приём.",
    royalCheeseName: "Королевский сыр",
    royalCheeseDesc: "Постоянно увеличивает максимум HP на 1 за приём.",
    stacksSummary: "{n} стак(ов), суммарно +{total} к макс. HP",
  },
  buildBadge: {
    analyticsNote:
      "Используется анонимная аналитика: запуски, исход забега, причины поражения и применение скиллов.",
    helpTitle: "Справка по управлению",
  },
  helpModal: {
    title: "Справка",
    move: "Как ходить:",
    moveBody: "используй WASD или стрелки. По диагонали — Q, E, Z, C.",
    mouse: "Мышка:",
    mouseBody:
      "наведи курсор на клетку, чтобы увидеть путь. Клик по соседней клетке — шаг (или удар, если там кот). Клик по дальней клетке — герой запомнит маршрут и пойдет по нему сам.",
    auto: "Автоход:",
    autoBody:
      "герой идет по запомненному пути между ходами. Автодвижение остановится, если герой получил урон, путь перекрыт или цель уже достигнута.",
    skills: "Скиллы и предметы:",
    skillsBody:
      "кнопки 1-9 — быстрые слоты. Можно положить туда скиллы и расходники. Нажми на скилл, затем на клетку цели. Пробел — использовать подготовленный скилл на себя (если это разрешено).",
    turns: "Как идут ходы:",
    turnsBody: "сначала ходишь ты, потом ходят коты. Коты могут обходить стены и двигаться одновременно.",
    hints: "Подсказки в бою:",
    hintsBody: "активные эффекты показаны в левом верхнем углу, подробности — по наведению.",
    close: "Закрыть",
  },
  itemDetail: {
    bonusesTitle: "Бонусы характеристик",
    combatTitle: "Боевые параметры",
    baseDamage: "Базовый урон:",
    critChanceBase: "Шанс крита (база оружия):",
    critMultBase: "Множитель крита (база оружия):",
    effectTitle: "Эффект",
    descriptionTitle: "Описание",
    emptyHint: "Нет дополнительных сведений.",
    rarityUnique: "Уникальный",
    rarityRare: "Редкий",
    rarityCommon: "Обычный",
  },
};

export function welcomeSubtitleAlloc(points, maxItems) {
  return STRINGS_RU.welcome.subtitleAlloc.replace("{points}", String(points)).replace("{maxItems}", String(maxItems));
}

export function welcomeSubtitleCounters(remaining, picked, maxItems) {
  return STRINGS_RU.welcome.subtitleCounters
    .replace("{remaining}", String(remaining))
    .replace("{picked}", String(picked))
    .replace("{maxItems}", String(maxItems));
}

export function gameSubtitleRun(level, maxLevel, width, height, turns) {
  return STRINGS_RU.game.subtitleRun
    .replace("{level}", String(level))
    .replace("{maxLevel}", String(maxLevel))
    .replace("{width}", String(width))
    .replace("{height}", String(height))
    .replace("{turns}", String(turns));
}

export function endingSubtitleTurns(subtitle, turns) {
  return STRINGS_RU.ending.subtitleTurns.replace("{subtitle}", subtitle).replace("{turns}", String(turns));
}

export function endingSubtitleMaze(level, maxLevel) {
  return STRINGS_RU.ending.subtitleMazeLevel.replace("{level}", String(level)).replace("{maxLevel}", String(maxLevel));
}

export function endingSubtitleChar(charLevel, xp, xpToNext) {
  return STRINGS_RU.ending.subtitleChar
    .replace("{charLevel}", String(charLevel))
    .replace("{xp}", String(xp))
    .replace("{xpToNext}", String(xpToNext));
}

export function skillsModalSubtitle(skillPoints) {
  return STRINGS_RU.skillsModal.subtitle.replace("{skillPoints}", String(skillPoints));
}

export function quickbarSlotTitle(n) {
  return STRINGS_RU.quickbar.slotTitle.replace("{n}", String(n));
}

export function activeEffectBandageRemaining(n) {
  return STRINGS_RU.activeEffects.bandageRemainingTurns.replace("{n}", String(n));
}

export function activeEffectStacksLine(count, totalHp) {
  return STRINGS_RU.activeEffects.stacksSummary
    .replace("{n}", String(count))
    .replace("{total}", String(totalHp));
}

/** Локализация аббревиатур стат в тексте предметов. */
export function localizeStatText(effectText) {
  if (effectText == null) return "";
  return String(effectText)
    .replaceAll("STR", "СИЛ")
    .replaceAll("INT", "ИНТ")
    .replaceAll("AGI", "ЛВК")
    .replaceAll("LUK", "УДЧ")
    .replaceAll("HP_MAX", "HP МАКС");
}
