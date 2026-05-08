import { buildSkillHoverData } from "../skillsRuntime.js?v=0.5.3-pre-alpha";
import { getSkillManaCost } from "../skillsRuntime.js?v=0.5.3-pre-alpha";
import { buildSkillSpriteHtml } from "./spriteIconHtml.js?v=0.5.3-pre-alpha";
import { buildHoverCardHtml, escapeHtml } from "./hoverCardHtml.js?v=0.5.3-pre-alpha";

export function buildSkillDetailHtml(skill, skillState, options = {}) {
  if (!skill) return "";
  const manaCost = options.playerSheet ? getSkillManaCost(skill, options.playerSheet) : Math.max(0, Number(skill.manaCost || 0));
  const chargesTotal = Math.max(1, Number(skill?.targeting?.charges || 1));
  const rawDescription = String(skill.description || "").trim();
  const description = rawDescription
    .replace(/^Выбери клетку персонажа\.\s*/i, "")
    .replace(/^Цель:\s*своя клетка\.\s*/i, "")
    .trim() || "—";
  let formula = String(skill.property || "").trim() || "Формула не указана.";
  let targets = "По правилам скилла";
  let badgesHtml = `<span class="cm-skill-choice-card__mana-badge">Мана: ${manaCost}</span>`;

  const hoverData = buildSkillHoverData(skill, options.item || null, options.playerSheet || null);
  if (hoverData?.formula) {
    formula = hoverData.formula;
  }
  if (hoverData?.targets) {
    targets = hoverData.targets;
  }
  if (hoverData?.damage) {
    badgesHtml += `<span class="cm-skill-choice-card__damage-badge">Урон: ${hoverData.damage}</span>`;
  }
  if (hoverData?.damageCenter) {
    badgesHtml += `<span class="cm-skill-choice-card__damage-badge">Центр: ${hoverData.damageCenter}</span>`;
  }
  if (hoverData?.damageSplash) {
    badgesHtml += `<span class="cm-skill-choice-card__damage-badge">Край: ${hoverData.damageSplash}</span>`;
  }
  if (hoverData?.damagePercent) {
    badgesHtml += `<span class="cm-skill-choice-card__damage-badge">Урон: ${hoverData.damagePercent}% HP МАКС</span>`;
  }
  if (hoverData?.manaPercent) {
    badgesHtml += `<span class="cm-skill-choice-card__mana-badge">Мана: +${hoverData.manaPercent}% МАКС</span>`;
  }
  if (chargesTotal > 1) {
    badgesHtml += `<span class="cm-skill-choice-card__mana-badge">Целей: ${chargesTotal}</span>`;
  }
  if (rawDescription.toLowerCase().includes("клетку персонажа")) {
    targets = "Своя клетка";
  }
  return buildHoverCardHtml({
    rarity: "common",
    titleRowHtml: `<div class="skill-detail-topline"><span class="item-detail-icon" aria-hidden="true">${buildSkillSpriteHtml(skill)}</span><span class="item-detail-name">${escapeHtml(skill.name)}</span><div class="skill-detail-badges">${badgesHtml}</div></div>`,
    sectionsHtml: `<div class="item-detail-section"><h4 class="item-detail-section-title">Описание</h4><p class="item-detail-desc">${escapeHtml(description).replace(/\n/g, "<br>")}</p></div><div class="item-detail-section"><h4 class="item-detail-section-title">Формула</h4><p class="item-detail-desc">${escapeHtml(formula).replace(/\n/g, "<br>")}</p></div><div class="item-detail-section"><h4 class="item-detail-section-title">Доступные цели</h4><p class="item-detail-desc">${escapeHtml(targets)}</p></div>`,
  });
}
