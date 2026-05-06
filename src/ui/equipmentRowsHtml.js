const EQUIP_TYPES = ["weapon", "armor", "amulet"];

export function buildGameEquipRowsHtml({
  sheet,
  previewSheet,
  getItemById,
  getItemRarity,
  getWeaponDamageForSheet,
  getValueDeltaClass,
  toRuType,
  esc,
}) {
  const equipped = sheet?.equippedByType || {};
  return EQUIP_TYPES.map((type) => {
    const item = getItemById(equipped[type]);
    if (item) {
      return `
      <div class="cm-equip-slot">
        <span class="cm-equip-slot__label">${toRuType(type)}</span>
        <button class="cm-equip-slot__box item-rarity-${getItemRarity(item)}" type="button" data-action="equip-slot-action" data-equip-type="${type}" data-drag-kind="equipped-item" data-drag-equip-type="${type}" data-inventory-detail-item-id="${item.id}" data-inventory-detail-instance-id="${sheet?.equippedInstanceByType?.[type] || ""}" draggable="true" title="${esc(item.name)}">
          <span class="cm-equip-slot__icon">${item.icon || "—"}</span>
          ${type === "weapon" ? `<span class="cm-item-weapon-damage ${getValueDeltaClass(getWeaponDamageForSheet(sheet, item), getWeaponDamageForSheet(previewSheet || sheet, item))}">${getWeaponDamageForSheet(previewSheet || sheet, item)}</span>` : ""}
        </button>
      </div>
    `;
    }
    return `
      <div class="cm-equip-slot">
        <span class="cm-equip-slot__label">${toRuType(type)}</span>
        <div class="cm-equip-slot__box" data-equip-type="${type}">
          <span class="cm-equip-slot__icon">—</span>
          <span class="cm-equip-slot__bonus"></span>
        </div>
      </div>
    `;
  }).join("");
}

export function buildEndingEquipRowsHtml({
  sheet,
  getItemById,
  getItemRarity,
  getWeaponDamageForSheet,
  toRuType,
}) {
  return EQUIP_TYPES.map((type) => {
    const item = getItemById(sheet?.equippedByType?.[type]);
    return `
      <div class="cm-equip-slot">
        <span class="cm-equip-slot__label">${toRuType(type)}</span>
        <div class="cm-equip-slot__box ${item ? `item-rarity-${getItemRarity(item)}` : ""}" ${item ? `data-inventory-detail-item-id="${item.id}" data-inventory-detail-instance-id="${sheet?.equippedInstanceByType?.[type] || ""}"` : ""}>
          <span class="cm-equip-slot__icon">${item?.icon || "—"}</span>
          ${type === "weapon" && item ? `<span class="cm-item-weapon-damage">${getWeaponDamageForSheet(sheet, item)}</span>` : ""}
        </div>
      </div>
    `;
  }).join("");
}
