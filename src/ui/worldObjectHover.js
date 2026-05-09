import {
  resolveEnemySpriteUrl,
  resolveObjectSpriteUrl,
  resolvePoisonCloudSpriteUrl,
} from "../runtime/spriteAssets.js?v=0.5.6-pre-alpha";
import { buildHoverCardHtml, escapeHtml } from "./hoverCardHtml.js?v=0.5.6-pre-alpha";

function getWorldObjectSpriteUrl(object) {
  if (!object) return "";
  if (object.type === "enemy") {
    return resolveEnemySpriteUrl(String(object?.data?.enemyType || ""));
  }
  if (object.type === "poison_cloud") {
    return resolvePoisonCloudSpriteUrl();
  }
  if (object.type === "ground_loot" || object.type === "trap") {
    return "";
  }
  const rawId = String(object.id || "");
  const parts = rawId.split("_");
  const key = parts.length <= 3 ? rawId : parts.slice(0, -3).join("_");
  return resolveObjectSpriteUrl(key);
}

export function pickPriorityWorldObject(objects = []) {
  if (!Array.isArray(objects) || objects.length === 0) return null;
  return objects.find((entry) => entry.type === "enemy")
    || objects.find((entry) => entry.type === "chest" || entry.type === "anvil")
    || objects[0];
}

export function buildWorldObjectDetailHtml(object) {
  if (!object) return "";
  const iconFallback = escapeHtml(object.icon || "•");
  const spriteUrl = getWorldObjectSpriteUrl(object);
  const iconHtml = spriteUrl
    ? `<img class="item-detail-icon__img" src="${escapeHtml(spriteUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="cm-sprite-fallback">${iconFallback}</span>`;
  const hpNow = Math.max(0, Number(object?.data?.hp || 0));
  const hpMaxRaw = Number(object?.data?.maxHp || 0);
  const hpMax = hpMaxRaw > 0 ? hpMaxRaw : Math.max(1, hpNow);
  const damage = Math.max(0, Number(object?.data?.damage || 0));
  const description = String(object?.description || "").trim() || "Игровой объект на клетке.";
  const badgesHtml = object.type === "enemy"
    ? `<div class="skill-detail-badges skill-detail-badges--item"><span class="cm-skill-choice-card__heal-badge">HP: ${hpNow} / ${hpMax}</span><span class="cm-skill-choice-card__damage-badge">Урон: ${damage}</span></div>`
    : "";
  const sectionsHtml = object.type === "enemy"
    ? `<div class="item-detail-section"><h4 class="item-detail-section-title">Описание</h4><p class="item-detail-desc">${escapeHtml(description)}</p></div>`
    : `<div class="item-detail-section"><h4 class="item-detail-section-title">Описание</h4><p class="item-detail-desc">${escapeHtml(description)}</p></div>`;
  return buildHoverCardHtml({
    rarity: "common",
    headerLeft: "Объект",
    headerRight: String(object.type || "object"),
    titleRowHtml: `<div class="item-detail-title-row"><span class="item-detail-icon cm-inv-cell item-rarity-common" aria-hidden="true">${iconHtml}</span><span class="item-detail-name">${escapeHtml(object.name || "Объект")}</span></div>`,
    badgesHtml,
    sectionsHtml,
  });
}
