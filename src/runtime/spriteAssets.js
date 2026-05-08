import { APP_VERSION } from "../app-config.js?v=0.5.3-pre-alpha";
import { getAllLootItems } from "../loadout.js?v=0.5.3-pre-alpha";
import { getAllSkillIds } from "../skillsRuntime.js?v=0.5.3-pre-alpha";

const spriteCache = new Map();

const ENEMY_SPRITE_KEYS = ["cat_small", "cat_mid", "cat_big"];
const OBJECT_SPRITE_KEYS = ["chest_common", "chest_rare", "chest_unique", "anvil"];
const FLOOR_TILE_KEYS = ["floor1", "floor2"];
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

export function resolveItemSubtypeSpriteUrl(item) {
  const key = getItemSubtypeSpriteKey(item);
  if (!key) return "";
  return withVersion(`./src/assets/sprites/items_by_subtype/${key}.png`);
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

export function resolvePlayerSpriteUrl() {
  return withVersion("./src/assets/sprites/actors/player_mouse.png");
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
    const url = resolveItemSubtypeSpriteUrl(item);
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
  preloadSpriteByUrl(resolvePlayerSpriteUrl());
  preloadSpriteByUrl(resolveGoalSpriteUrl());
  preloadSpriteByUrl(resolvePoisonCloudSpriteUrl());
}

export function getLoadedSprite(url) {
  const entry = ensureSprite(url);
  if (!entry || entry.status !== "ready") return null;
  return entry.image;
}
