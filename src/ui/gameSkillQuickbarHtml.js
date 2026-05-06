import { getSkillManaCost } from "../skills.js?v=0.4.8-pre-alpha";

export function buildSkillsListHtml({ learnedSkills, weaponSkills, sheet, esc }) {
  const coreSkillsHtml = (learnedSkills || [])
    .map((skill) => {
      const skillLevel = Math.max(1, Number(sheet?.skills?.[skill.id]?.level || 1));
      const manaCost = getSkillManaCost(skill, sheet);
      return `<li class="cm-skill"><button class="cm-skill__btn" type="button" data-action="left-skill-use" data-skill-kind="core" data-skill-id="${skill.id}" data-skill-detail-id="${skill.id}" data-skill-detail-kind="core" data-drag-kind="skill" data-drag-skill-kind="core" data-drag-skill-id="${skill.id}" draggable="true"><span class="cm-skill__icon">${skill.icon || "✨"}</span><span class="cm-skill__name">${esc(skill.name)} [ур. ${skillLevel}]</span><span class="cm-skill__mana">${manaCost}</span></button></li>`;
    })
    .join("");
  const weaponSkillsHtml = (weaponSkills || [])
    .map((skill) => {
      const manaCost = getSkillManaCost(skill, sheet);
      return `<li class="cm-skill"><button class="cm-skill__btn" type="button" data-action="left-skill-use" data-skill-kind="weapon" data-skill-id="${skill.id}" data-skill-detail-id="${skill.id}" data-skill-detail-kind="weapon" data-drag-kind="skill" data-drag-skill-kind="weapon" data-drag-skill-id="${skill.id}" draggable="true"><span class="cm-skill__icon">${skill.icon || "✨"}</span><span class="cm-skill__name">${esc(skill.name)} [ур. ${Math.max(1, Number(skill.level || 1))}]</span><span class="cm-skill__mana">${manaCost}</span>${skill.cooldownLeft > 0 ? `<span class="cm-skill__cooldown">CD ${skill.cooldownLeft}</span>` : ""}</button></li>`;
    })
    .join("");
  return (coreSkillsHtml || weaponSkillsHtml)
    ? `${coreSkillsHtml}${weaponSkillsHtml ? `${coreSkillsHtml ? `<li class="cm-skills__divider" aria-hidden="true"></li>` : ""}${weaponSkillsHtml}` : ""}`
    : `<li class="cm-skill"><span class="cm-skill__icon">—</span><span class="cm-skill__name">Нет изученных скиллов</span><span class="cm-skill__mana"></span></li>`;
}

export function buildQuickbarHtml({
  quickSlots,
  sheet,
  weaponSkills,
  getItemById,
  getCoreSkillDefs,
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
      const skill = getCoreSkillDefs().find((s) => s.id === slot.skillId);
      const manaCost = getSkillManaCost(skill, sheet);
      return `<button class="cm-hot-slot${isActive}" type="button" data-action="quickbar-use" data-slot-index="${i}" data-skill-detail-id="${skill?.id || ""}" data-skill-detail-kind="core" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="true" title="${esc(skill?.name || "Скилл")}"><span class="cm-hot-slot__key">${i + 1}</span>${skill?.icon || "✨"}<span class="cm-hot-slot__mana">${manaCost}</span></button>`;
    }
    if (slot.kind === "weapon-skill") {
      const skill = (weaponSkills || []).find((entry) => entry.id === slot.weaponSkillId) || null;
      const manaCost = getSkillManaCost(skill, sheet);
      const cooldownBadge = skill?.cooldownLeft > 0 ? `<span class="cm-hot-slot__cooldown">CD ${skill.cooldownLeft}</span>` : "";
      return `<button class="cm-hot-slot${isActive}" type="button" data-action="quickbar-use" data-slot-index="${i}" data-skill-detail-id="${skill?.id || ""}" data-skill-detail-kind="weapon" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="true" title="${esc(skill?.name || "Оружейный скилл")}"><span class="cm-hot-slot__key">${i + 1}</span>${skill?.icon || "✨"}<span class="cm-hot-slot__mana">${manaCost}</span>${cooldownBadge}</button>`;
    }
    return `<button class="cm-hot-slot cm-hot-slot--empty${isActive}" type="button" data-action="quickbar-use" data-slot-index="${i}" data-drag-kind="quick-slot" data-drag-slot-index="${i}" draggable="false"><span class="cm-hot-slot__key">${i + 1}</span></button>`;
  }).join("");
}
