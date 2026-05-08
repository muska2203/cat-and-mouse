import {
  resolveItemSubtypeSpriteUrl,
  resolveLootFrameSpriteUrl,
  resolveSkillSpriteUrl,
} from "../runtime/spriteAssets.js?v=0.5.2-pre-alpha";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getItemRarityById(itemId) {
  const id = String(itemId || "");
  if (id.startsWith("unique_")) return "unique";
  if (id.startsWith("rare_")) return "rare";
  return "common";
}

export function buildItemSpriteStackHtml(item, options = {}) {
  if (!item) return `<span class="cm-sprite-fallback">${escapeHtml(options.fallbackText || "•")}</span>`;
  const rarity = options.rarity || getItemRarityById(item.id);
  const frameUrl = resolveLootFrameSpriteUrl(rarity);
  const bodyUrl = resolveItemSubtypeSpriteUrl(item);
  const fallback = escapeHtml(options.fallbackText || item.icon || "•");
  const includeFrame = options.includeFrame !== false;
  return `<span class="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">${includeFrame ? `<img class="cm-sprite-stack__frame" src="${frameUrl}" alt="" loading="lazy" decoding="async" />` : ""}<img class="cm-sprite-stack__body" src="${bodyUrl}" alt="" loading="lazy" decoding="async" /><span class="cm-sprite-fallback">${fallback}</span></span>`;
}

export function buildSkillSpriteHtml(skill, options = {}) {
  const url = resolveSkillSpriteUrl(skill?.id);
  const fallback = escapeHtml(options.fallbackText || skill?.icon || "✨");
  return `<span class="cm-sprite-stack cm-sprite-stack--skill" aria-hidden="true"><img class="cm-sprite-stack__skill" src="${url}" alt="" loading="lazy" decoding="async" /><span class="cm-sprite-fallback">${fallback}</span></span>`;
}
