import { buildItemSpriteStackHtml } from "./spriteIconHtml.js?v=0.5.3-pre-alpha";

export function buildInventoryCellsHtml({
  equipables,
  getItemRarity,
  getWeaponDamageForSheet,
  getValueDeltaClass,
  sheet,
  previewSheet,
  esc,
}) {
  return ((equipables || []).length
    ? equipables.map((entry) => {
      const representativeEntry = entry.entries[0];
      const stackData = entry.count > 1 ? ` data-inventory-detail-stack="${entry.count}"` : "";
      const stackBadge = entry.count > 1 ? `<span class="cm-inv-cell__qty">${entry.count}</span>` : "";
      return `<button class="cm-inv-cell item-rarity-${getItemRarity(entry.item)}" type="button" title="${esc(entry.item.name)}" data-action="bag-item-action" data-item-id="${entry.item.id}" data-bag-instance-id="${representativeEntry.instanceId}" data-drag-kind="bag-equip" data-drag-bag-instance-id="${representativeEntry.instanceId}" data-drag-item-type="${entry.item.type}" data-preview-item-screen="game" data-preview-item-id="${entry.item.id}" data-preview-item-bag-instance-id="${representativeEntry.instanceId}" data-inventory-detail-item-id="${entry.item.id}" data-inventory-detail-instance-id="${representativeEntry.instanceId}"${stackData} draggable="true">${buildItemSpriteStackHtml(entry.item)}${entry.item.type === "weapon" ? `<span class="cm-item-weapon-damage ${getValueDeltaClass(getWeaponDamageForSheet(sheet, entry.item), getWeaponDamageForSheet(previewSheet || sheet, entry.item))}">${getWeaponDamageForSheet(previewSheet || sheet, entry.item)}</span>` : ""}${stackBadge}</button>`;
    })
    : [`<div class="cm-inv-cell cm-inv-cell--empty"></div>`]
  ).join("");
}

export function buildConsumableCellsHtml({ consumables, getItemRarity, esc }) {
  return ((consumables || []).length
    ? consumables.map((entry) => {
      const representativeEntry = entry.entries[0];
      const stackData = entry.count > 1 ? ` data-inventory-detail-stack="${entry.count}"` : "";
      const stackBadge = entry.count > 1 ? `<span class="cm-inv-cell__qty">${entry.count}</span>` : "";
      return `<button class="cm-inv-cell item-rarity-${getItemRarity(entry.item)}" type="button" data-action="use-consumable" data-item-id="${entry.item.id}" data-bag-instance-id="${representativeEntry.instanceId}" data-drag-kind="consumable" data-drag-item-id="${entry.item.id}" data-drag-bag-instance-id="${representativeEntry.instanceId}" data-inventory-detail-item-id="${entry.item.id}"${stackData} draggable="true" title="${esc(entry.item.name)}">${buildItemSpriteStackHtml(entry.item)}${stackBadge}</button>`;
    })
    : [`<div class="cm-inv-cell cm-inv-cell--empty"></div>`]
  ).join("");
}
