/**
 * Всплывающая карточка предмета инвентаря (DOM вне #app).
 */
import { createHoverPopoverController } from "./hoverPopover.js?v=0.5.7-pre-alpha";

export function createInventoryItemPopoverController(options) {
  const {
    root,
    getScreen,
    getItemById,
    getItemInstanceById,
    buildInventoryItemDetailHtml,
  } = options;

  const popover = createHoverPopoverController({ delayMs: 0 });

  function updateFromEvent(event) {
    const screen = getScreen();
    if (screen !== "game" && screen !== "welcome" && screen !== "ending") {
      scheduleHide();
      return;
    }
    const trigger = event.target.closest("[data-inventory-detail-item-id]");
    if (!trigger || !root.contains(trigger)) {
      scheduleHide();
      return;
    }

    const itemId = trigger.dataset.inventoryDetailItemId;
    const instanceId = trigger.dataset.inventoryDetailInstanceId || "";
    const stackRaw = trigger.dataset.inventoryDetailStack;
    const stackCount = stackRaw !== undefined && stackRaw !== "" ? Number(stackRaw) : undefined;
    const key = `${itemId}:${instanceId}:${stackRaw ?? ""}`;
    const item = itemId ? getItemById(itemId) : null;
    if (!item) {
      hide();
      return;
    }
    const instanceEntry = instanceId && typeof getItemInstanceById === "function"
      ? getItemInstanceById(instanceId)
      : null;

    popover.updateAnchor({
      key,
      anchorEl: trigger,
      html: buildInventoryItemDetailHtml(item, { stackCount, instanceEntry }),
    });
  }

  return {
    hide: popover.hide,
    scheduleHide: popover.scheduleHide,
    updateFromEvent,
  };
}
