import { getSkillManaCost } from "../skillsRuntime.js?v=0.4.12-pre-alpha";

export function buildSkillsListHtml({ skills, sheet, esc }) {
  const skillsHtml = (skills || [])
    .map((skill) => {
      const manaCost = getSkillManaCost(skill, sheet);
      return `<li class="cm-skill"><button class="cm-skill__btn" type="button" data-action="left-skill-use" data-skill-id="${skill.id}" data-skill-detail-id="${skill.id}" data-drag-kind="skill" data-drag-skill-id="${skill.id}" draggable="true"><span class="cm-skill__icon">${skill.icon || "✨"}</span><span class="cm-skill__name">${esc(skill.name)} [ур. ${Math.max(1, Number(skill.level || 1))}]</span><span class="cm-skill__mana">${manaCost}</span></button></li>`;
    })
    .join("");
  return skillsHtml
    ? skillsHtml
    : `<li class="cm-skill"><span class="cm-skill__icon">—</span><span class="cm-skill__name">Нет скиллов</span><span class="cm-skill__mana"></span></li>`;
}

export function buildQuickbarHtml({
  quickSlots,
  sheet,
  skills,
  getItemById,
  activeSlotIndex,
  esc,
}) {
  return Array.from({ length: 9 }).map((_, i) => {
    const slot = quickSlots[i] || null;
    const isActive = i === activeSlotIndex ? " active" : "";
    if (!slot) {
      return `<button class="cm-hot-slot cm-hot-slot--empty${isActive}" type="button" data-action="quickbar-use" data-slot-index="${i}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="false"><span class="cm-hot-slot__key">${i + 1}</span></button>`;
    }
    if (slot.kind === "consumable") {
      const item = getItemById(slot.itemId);
      const count = (sheet?.bag || []).filter((entry) => entry.itemId === slot.itemId).length;
      const qtyBadge = count > 1 ? `<span class="cm-hot-slot__qty">${count}</span>` : "";
      return `<button class="cm-hot-slot${isActive}" type="button" data-action="quickbar-use" data-slot-index="${i}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" data-inventory-detail-item-id="${item?.id || ""}" data-inventory-detail-stack="${count}" draggable="true" title="${esc(item?.name || "Расходник")}"><span class="cm-hot-slot__key">${i + 1}</span>${item?.icon || "•"}${qtyBadge}</button>`;
    }
    if (slot.kind === "skill") {
      const skill = (skills || []).find((entry) => entry.id === slot.skillId) || null;
      const manaCost = getSkillManaCost(skill, sheet);
      return `<button class="cm-hot-slot${isActive}" type="button" data-action="quickbar-use" data-slot-index="${i}" data-skill-detail-id="${skill?.id || ""}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="true" title="${esc(skill?.name || "Скилл")}"><span class="cm-hot-slot__key">${i + 1}</span>${skill?.icon || "✨"}<span class="cm-hot-slot__mana">${manaCost}</span></button>`;
    }
    return `<button class="cm-hot-slot cm-hot-slot--empty${isActive}" type="button" data-action="quickbar-use" data-slot-index="${i}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="false"><span class="cm-hot-slot__key">${i + 1}</span></button>`;
  }).join("");
}
