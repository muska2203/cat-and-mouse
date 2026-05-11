import { APP_VERSION } from "../app-config.js?v=0.5.8-pre-alpha";
import { isKnownPlayerPortraitId, PLAYER_PORTRAITS } from "../game/playerPortraitsCatalog.js?v=0.5.8-pre-alpha";
import { getAllLootItems } from "../loadout.js?v=0.5.8-pre-alpha";
import { getAllSkillIds } from "../skillsRuntime.js?v=0.5.8-pre-alpha";

const spriteCache = new Map();

const ENEMY_SPRITE_KEYS = ["cat_small", "cat_mid", "cat_big"];
const OBJECT_SPRITE_KEYS = ["chest_common", "chest_rare", "chest_unique", "anvil"];
const FLOOR_TILE_KEYS = ["floor1"];
const TILE_SPRITE_KEYS = ["wall", ...FLOOR_TILE_KEYS];
const LOOT_FRAME_BY_RARITY = {
  common: "loot_frame_common",
  rare: "loot_frame_rare",
  unique: "loot_frame_unique",
};
const GROUND_LOOT_CONTAINER_BY_RARITY = {
  common: "ground_loot_container_common",
  rare: "ground_loot_container_rare",
  unique: "ground_loot_container_unique",
};

function withVersion(url) {
  return `${url}?v=${encodeURIComponent(APP_VERSION)}`;
}

export function getItemSubtypeSpriteKey(item) {
  const type = String(item?.type || "").trim();
  const subtype = String(item?.subtype || "").trim();
  if (!type || !subtype) return "";
  return `${type}_${subtype}`.replaceAll("/", "_");
}

export function getItemSpriteKey(item) {
  const id = String(item?.id || "").trim();
  if (!id) return "";
  return id.replaceAll("/", "_");
}

export function resolveItemSpriteUrl(item) {
  const key = getItemSpriteKey(item);
  if (!key) return "";
  return withVersion(`./src/assets/sprites/items/${key}.png`);
}

/**
 * Backward-compatible alias: раньше спрайт выбирался по подтипу.
 * Теперь — по id предмета.
 */
export function resolveItemSubtypeSpriteUrl(item) {
  const byIdUrl = resolveItemSpriteUrl(item);
  if (byIdUrl) return byIdUrl;
  const fallbackKey = getItemSubtypeSpriteKey(item);
  if (!fallbackKey) return "";
  return withVersion(`./src/assets/sprites/items_by_subtype/${fallbackKey}.png`);
}

export function resolveLootFrameSpriteUrl(rarity) {
  const rarityKey = String(rarity || "common");
  const frameKey = LOOT_FRAME_BY_RARITY[rarityKey] || LOOT_FRAME_BY_RARITY.common;
  return withVersion(`./src/assets/sprites/loot_frames/${frameKey}.png`);
}

export function resolveGroundLootContainerSpriteUrl(rarity) {
  const rarityKey = String(rarity || "common");
  const containerKey = GROUND_LOOT_CONTAINER_BY_RARITY[rarityKey] || GROUND_LOOT_CONTAINER_BY_RARITY.common;
  return withVersion(`./src/assets/sprites/ground_loot_containers/${containerKey}.png`);
}

export function resolveEnemySpriteUrl(enemyType) {
  const key = String(enemyType || "").trim();
  if (!key) return "";
  return withVersion(`./src/assets/sprites/enemies/${key}.png`);
}

export function resolveObjectSpriteUrl(objectKey) {
  const key = String(objectKey || "").trim();
  if (!key) return "";
  return withVersion(`./src/assets/sprites/objects/${key}.png`);
}

export function resolveSkillSpriteUrl(skillId) {
  const key = String(skillId || "").trim();
  if (!key) return "";
  return withVersion(`./src/assets/sprites/skills/${key}.png`);
}

export function resolveTileSpriteUrl(tileType) {
  const key = String(tileType || "").trim();
  if (!key) return "";
  return withVersion(`./src/assets/sprites/tiles/${key}.png`);
}

export function resolveRandomFloorTileSpriteUrl(x, y, levelSeed = 0) {
  const variants = FLOOR_TILE_KEYS.length > 0 ? FLOOR_TILE_KEYS : ["floor"];
  const nx = Number(x) || 0;
  const ny = Number(y) || 0;
  const seed = Number(levelSeed) || 0;
  const hash = ((nx * 73856093) ^ (ny * 19349663) ^ (seed * 83492791)) >>> 0;
  const index = hash % variants.length;
  return resolveTileSpriteUrl(variants[index]);
}

const DEFAULT_PLAYER_SPRITE_BASENAME = "player_mouse";

/** Спрайт героя на поле: имя файла `player_<portraitId>.png` для известных id из каталога. */
export function resolvePlayerSpriteUrl(portraitId = "") {
  const id = String(portraitId || "").trim();
  const basename = id && isKnownPlayerPortraitId(id) ? `player_${id}` : DEFAULT_PLAYER_SPRITE_BASENAME;
  return withVersion(`./src/assets/sprites/actors/${basename}.png`);
}

export function resolveGoalSpriteUrl() {
  return withVersion("./src/assets/sprites/objects/goal_hole.png");
}

export function resolvePoisonCloudSpriteUrl() {
  return withVersion("./src/assets/sprites/objects/poison_cloud.png");
}

function ensureSprite(url) {
  if (!url) return null;
  if (spriteCache.has(url)) {
    return spriteCache.get(url);
  }
  const entry = {
    status: "loading",
    image: null,
  };
  const image = new Image();
  image.onload = () => {
    entry.status = "ready";
    entry.image = image;
  };
  image.onerror = () => {
    entry.status = "error";
    entry.image = null;
  };
  image.src = url;
  spriteCache.set(url, entry);
  return entry;
}

export function preloadSpriteByUrl(url) {
  ensureSprite(url);
}

export function preloadAllRunSprites() {
  const lootItems = getAllLootItems();
  const uniqueItemUrls = new Set();
  for (const item of lootItems) {
    const url = resolveItemSpriteUrl(item);
    if (url) uniqueItemUrls.add(url);
  }
  for (const url of uniqueItemUrls) preloadSpriteByUrl(url);

  for (const rarity of Object.keys(LOOT_FRAME_BY_RARITY)) {
    preloadSpriteByUrl(resolveLootFrameSpriteUrl(rarity));
  }
  for (const rarity of Object.keys(GROUND_LOOT_CONTAINER_BY_RARITY)) {
    preloadSpriteByUrl(resolveGroundLootContainerSpriteUrl(rarity));
  }
  for (const enemyKey of ENEMY_SPRITE_KEYS) {
    preloadSpriteByUrl(resolveEnemySpriteUrl(enemyKey));
  }
  for (const objectKey of OBJECT_SPRITE_KEYS) {
    preloadSpriteByUrl(resolveObjectSpriteUrl(objectKey));
  }
  for (const skillId of getAllSkillIds()) {
    preloadSpriteByUrl(resolveSkillSpriteUrl(skillId));
  }
  for (const tileKey of TILE_SPRITE_KEYS) {
    preloadSpriteByUrl(resolveTileSpriteUrl(tileKey));
  }
  preloadSpriteByUrl(resolvePlayerSpriteUrl(""));
  for (const portrait of PLAYER_PORTRAITS) {
    preloadSpriteByUrl(resolvePlayerSpriteUrl(portrait.id));
  }
  preloadSpriteByUrl(resolveGoalSpriteUrl());
  preloadSpriteByUrl(resolvePoisonCloudSpriteUrl());
}

export function getLoadedSprite(url) {
  const entry = ensureSprite(url);
  if (!entry || entry.status !== "ready") return null;
  return entry.image;
}
