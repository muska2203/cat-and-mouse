export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildHoverCardHtml(options = {}) {
  const rarity = String(options.rarity || "common");
  const headerLeft = options.headerLeft ? `<span class="item-detail-rarity">${escapeHtml(options.headerLeft)}</span>` : "";
  const headerRight = options.headerRight ? `<span class="item-detail-type">${escapeHtml(options.headerRight)}</span>` : "";
  const headerHtml = (headerLeft || headerRight)
    ? `<header class="item-detail-head">${headerLeft}${headerRight}</header>`
    : "";
  const titleRowHtml = String(options.titleRowHtml || "");
  const badgesHtml = String(options.badgesHtml || "");
  const sectionsHtml = String(options.sectionsHtml || "");
  const emptyHintHtml = String(options.emptyHintHtml || "");
  return `<div class="item-detail-card item-detail-rarity-${escapeHtml(rarity)}">${headerHtml}${titleRowHtml}${badgesHtml}${sectionsHtml}${emptyHintHtml}</div>`;
}
