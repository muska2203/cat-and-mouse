/** Единый источник id и метаданных внешности героя (welcome + спрайт на поле). */
export const PLAYER_PORTRAITS = [
  {
    id: "witcher",
    name: "Белый Хвост",
    imageSrc: "./src/assets/avatars/witcher-ready.png",
    desc: "Охотник на чудовищ и мечник-алхимик.",
  },
  {
    id: "halfling-mage",
    name: "Сырный Мерлин",
    imageSrc: "./src/assets/avatars/halfling-mage-ready.png",
    desc: "Арканист поддержки и контроля.",
  },
  {
    id: "paladin",
    name: "Сир Чеддар",
    imageSrc: "./src/assets/avatars/paladin-ready.png",
    desc: "Паладин света и фронтовой защитник.",
  },
  {
    id: "elven-ranger",
    name: "Тонкоух",
    imageSrc: "./src/assets/avatars/elven-ranger-ready.png",
    desc: "Стрелок-разведчик с тропами между капканами.",
  },
  {
    id: "orc-barbarian",
    name: "Клыкохвост",
    imageSrc: "./src/assets/avatars/orc-barbarian-ready.png",
    desc: "Берсерк ближнего боя, проламывающий дорогу.",
  },
  {
    id: "samurai",
    name: "Усатый Сэнсэй",
    imageSrc: "./src/assets/avatars/samurai-ready.png",
    desc: "Дуэлянт дисциплины и одного точного удара.",
  },
  {
    id: "necromancer",
    name: "Мышь-Косторез",
    imageSrc: "./src/assets/avatars/necromancer-ready.png",
    desc: "Тёмный маг, повелитель порчи и проклятий.",
  },
];

const KNOWN_PORTRAIT_IDS = new Set(PLAYER_PORTRAITS.map((p) => p.id));

export function isKnownPlayerPortraitId(portraitId) {
  return KNOWN_PORTRAIT_IDS.has(String(portraitId || "").trim());
}
