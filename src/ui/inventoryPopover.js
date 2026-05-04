/**
 * Всплывающая карточка предмета инвентаря (DOM вне #app).
 */
export function createInventoryItemPopoverController(options) {
  const { root, getScreen, getItemById, buildInventoryItemDetailHtml } = options;

  let popoverEl = null;
  let popoverKey = null;
  let hideTimer = null;

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
    clearTimeout(hideTimer);
    hideTimer = null;
    popoverKey = null;
    if (popoverEl) {
      popoverEl.hidden = true;
      popoverEl.setAttribute("aria-hidden", "true");
      popoverEl.innerHTML = "";
      popoverEl.style.visibility = "";
    }
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      hide();
    }, 120);
  }

  function position(clientX, clientY) {
    const el = popoverEl;
    if (!el || el.hidden) {
      return;
    }
    const pad = 14;
    el.style.visibility = "hidden";
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + w > window.innerWidth - 10) {
      x = Math.max(10, clientX - w - pad);
    }
    if (y + h > window.innerHeight - 10) {
      y = Math.max(10, clientY - h - pad);
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = "visible";
  }

  function updateFromEvent(event) {
    if (getScreen() !== "game") {
      scheduleHide();
      return;
    }
    const trigger = event.target.closest("[data-inventory-detail-item-id]");
    if (!trigger || !root.contains(trigger)) {
      scheduleHide();
      return;
    }

    clearTimeout(hideTimer);
    hideTimer = null;

    const itemId = trigger.dataset.inventoryDetailItemId;
    const stackRaw = trigger.dataset.inventoryDetailStack;
    const stackCount = stackRaw !== undefined && stackRaw !== "" ? Number(stackRaw) : undefined;
    const key = `${itemId}:${stackRaw ?? ""}`;
    const item = itemId ? getItemById(itemId) : null;
    if (!item) {
      hide();
      return;
    }

    const pop = ensureEl();
    if (popoverKey !== key) {
      pop.innerHTML = buildInventoryItemDetailHtml(item, { stackCount });
      popoverKey = key;
    }
    pop.hidden = false;
    pop.setAttribute("aria-hidden", "false");
    position(event.clientX, event.clientY);
  }

  return { hide, scheduleHide, updateFromEvent };
}
