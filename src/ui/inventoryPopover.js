/**
 * Всплывающая карточка предмета инвентаря (DOM вне #app).
 */
export function createInventoryItemPopoverController(options) {
  const {
    root,
    getScreen,
    getItemById,
    getItemInstanceById,
    buildInventoryItemDetailHtml,
  } = options;

  let popoverEl = null;
  let popoverKey = null;
  function ensureEl() {
    if (popoverEl) {
      return popoverEl;
    }
    popoverEl = document.createElement("div");
    popoverEl.className = "inventory-item-detail-popover";
    popoverEl.setAttribute("role", "tooltip");
    popoverEl.hidden = true;
    popoverEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(popoverEl);
    return popoverEl;
  }

  function hide() {
    popoverKey = null;
    if (popoverEl) {
      popoverEl.hidden = true;
      popoverEl.setAttribute("aria-hidden", "true");
      popoverEl.innerHTML = "";
      popoverEl.style.visibility = "";
    }
  }

  function scheduleHide() {
    hide();
  }

  function positionByAnchor(anchorEl) {
    const el = popoverEl;
    if (!el || el.hidden || !anchorEl) {
      return;
    }
    const pad = 10;
    const rect = anchorEl.getBoundingClientRect();
    el.style.visibility = "hidden";
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = rect.left - w - pad;
    let y = rect.top;
    if (x < 10) {
      x = rect.right + pad;
    }
    if (y + h > window.innerHeight - 10) {
      y = Math.max(10, window.innerHeight - h - 10);
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = "visible";
  }

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

    const pop = ensureEl();
    if (popoverKey !== key) {
      pop.innerHTML = buildInventoryItemDetailHtml(item, { stackCount, instanceEntry });
      popoverKey = key;
    }
    pop.hidden = false;
    pop.setAttribute("aria-hidden", "false");
    positionByAnchor(trigger);
  }

  return { hide, scheduleHide, updateFromEvent };
}
