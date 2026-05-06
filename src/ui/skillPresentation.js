import { getCoreSkillFormulaText, getRegenHealPerTurn, getHealSkillRawValue } from "../skills/coreSkillCalc.js?v=0.4.8-pre-alpha";
import { buildWeaponSkillHoverData } from "../weaponSkills.js?v=0.4.8-pre-alpha";
import { getSkillManaCost } from "../skills.js?v=0.4.8-pre-alpha";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildSkillDetailHtml(skill, skillState, options = {}) {
  if (!skill) return "";
  const manaCost = options.playerSheet ? getSkillManaCost(skill, options.playerSheet) : Math.max(0, Number(skill.manaCost || 0));
  const level = Math.max(1, Number(skillState?.level || 1));
  const skillKind = options.skillKind || "core";
  const cooldownBase = Math.max(0, Number(options.cooldownBase ?? skill.cooldownTurns ?? 0));
  const cooldownLeft = Math.max(0, Number(options.cooldownLeft || 0));
  const rawDescription = String(skill.description || "").trim();
  const description = rawDescription
    .replace(/^Выбери клетку персонажа\.\s*/i, "")
    .replace(/^Цель:\s*своя клетка\.\s*/i, "")
    .trim() || "—";
  let formula = String(skill.property || "").trim() || "Формула не указана.";
  let targets = "По правилам скилла";
  let badgesHtml = `<span class="cm-skill-choice-card__mana-badge">Мана: ${manaCost}</span>`;

  if (skillKind === "weapon") {
    const hoverData = buildWeaponSkillHoverData(skill, options.weaponItem || null, options.playerSheet || null);
    if (hoverData?.formula) {
      formula = hoverData.formula;
    }
    if (hoverData?.targets) {
      targets = hoverData.targets;
    }
    if (hoverData?.damage) {
      badgesHtml += `<span class="cm-skill-choice-card__damage-badge">Урон: ${hoverData.damage}</span>`;
    }
    if (hoverData?.damagePercent) {
      badgesHtml += `<span class="cm-skill-choice-card__damage-badge">Урон: ${hoverData.damagePercent}% HP МАКС</span>`;
    }
    if (hoverData?.manaPercent) {
      badgesHtml += `<span class="cm-skill-choice-card__mana-badge">Мана: +${hoverData.manaPercent}% МАКС</span>`;
    }
  } else if (skill.id === "skill_support_regen") {
    formula = getCoreSkillFormulaText(skill.id, level);
    targets = "Своя клетка";
    const healPerTurn = getRegenHealPerTurn(level, options.playerSheet);
    badgesHtml += `<span class="cm-skill-choice-card__heal-badge">Лечение: ${healPerTurn}/ход</span>`;
  } else if (skill.id === "skill_support_heal") {
    formula = getCoreSkillFormulaText(skill.id, level);
    targets = "Своя клетка";
    const heal = getHealSkillRawValue(level, options.playerSheet);
    badgesHtml += `<span class="cm-skill-choice-card__heal-badge">Лечение: ${heal}</span>`;
  } else if (rawDescription.toLowerCase().includes("клетку персонажа")) {
    targets = "Своя клетка";
  }
  return `<div class="item-detail-card item-detail-rarity-common"><div class="skill-detail-topline"><span class="item-detail-icon" aria-hidden="true">${escapeHtml(skill.icon || "✨")}</span><span class="item-detail-name">${escapeHtml(skill.name)}</span><div class="skill-detail-badges">${badgesHtml}</div></div><div class="item-detail-section"><h4 class="item-detail-section-title">Описание</h4><p class="item-detail-desc">${escapeHtml(description).replace(/\n/g, "<br>")}</p></div><div class="item-detail-section"><h4 class="item-detail-section-title">Формула</h4><p class="item-detail-desc">${escapeHtml(formula).replace(/\n/g, "<br>")}</p></div><div class="item-detail-section"><h4 class="item-detail-section-title">Доступные цели</h4><p class="item-detail-desc">${escapeHtml(targets)}</p></div><div class="item-detail-section"><h4 class="item-detail-section-title">Кулдаун</h4><p class="item-detail-desc">Базовый: ${cooldownBase} х. Текущий: ${cooldownLeft} х.</p></div></div>`;
}
