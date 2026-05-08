export function createHoverPopoverController(options = {}) {
  const delayMs = Math.max(0, Number(options.delayMs || 0));
  let popoverEl = null;
  let showTimer = null;
  let visibleKey = null;
  let pendingPayload = null;

  function ensureEl() {
    if (popoverEl) return popoverEl;
    popoverEl = document.createElement("div");
    popoverEl.className = "inventory-item-detail-popover";
    popoverEl.setAttribute("role", "tooltip");
    popoverEl.hidden = true;
    popoverEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(popoverEl);
    return popoverEl;
  }

  function clearTimer() {
    if (showTimer != null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
  }

  function hide() {
    clearTimer();
    visibleKey = null;
    pendingPayload = null;
    if (!popoverEl) return;
    popoverEl.hidden = true;
    popoverEl.setAttribute("aria-hidden", "true");
    popoverEl.innerHTML = "";
    popoverEl.style.visibility = "";
  }

  function scheduleHide() {
    hide();
  }

  function positionByAnchor(anchorEl) {
    if (!popoverEl || popoverEl.hidden || !anchorEl) return;
    const pad = 10;
    const rect = anchorEl.getBoundingClientRect();
    popoverEl.style.visibility = "hidden";
    const w = popoverEl.offsetWidth;
    const h = popoverEl.offsetHeight;
    let x = rect.left - w - pad;
    let y = rect.top;
    if (x < 10) x = rect.right + pad;
    if (y + h > window.innerHeight - 10) y = Math.max(10, window.innerHeight - h - 10);
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    popoverEl.style.left = `${x}px`;
    popoverEl.style.top = `${y}px`;
    popoverEl.style.visibility = "visible";
  }

  function positionByPoint(clientX, clientY) {
    if (!popoverEl || popoverEl.hidden) return;
    const pad = 12;
    popoverEl.style.visibility = "hidden";
    const w = popoverEl.offsetWidth;
    const h = popoverEl.offsetHeight;
    let x = Number(clientX || 0) + pad;
    let y = Number(clientY || 0) + pad;
    if (x + w > window.innerWidth - 10) {
      x = Math.max(10, Number(clientX || 0) - w - pad);
    }
    if (y + h > window.innerHeight - 10) {
      y = Math.max(10, window.innerHeight - h - 10);
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    popoverEl.style.left = `${x}px`;
    popoverEl.style.top = `${y}px`;
    popoverEl.style.visibility = "visible";
  }

  function showWithPayload(payload, positionFn) {
    if (!payload || !payload.key || !payload.html) {
      hide();
      return;
    }
    const pop = ensureEl();
    const showNow = () => {
      if (!pendingPayload || pendingPayload.key !== payload.key) return;
      pop.innerHTML = payload.html;
      visibleKey = payload.key;
      pop.hidden = false;
      pop.setAttribute("aria-hidden", "false");
      positionFn(payload);
    };
    pendingPayload = payload;
    if (visibleKey === payload.key && !pop.hidden) {
      positionFn(payload);
      return;
    }
    clearTimer();
    if (delayMs <= 0) {
      showNow();
      return;
    }
    showTimer = setTimeout(showNow, delayMs);
  }

  function updateAnchor(payload) {
    showWithPayload(payload, (entry) => positionByAnchor(entry.anchorEl));
  }

  function updatePoint(payload) {
    showWithPayload(payload, (entry) => positionByPoint(entry.clientX, entry.clientY));
  }

  return {
    hide,
    scheduleHide,
    updateAnchor,
    updatePoint,
  };
}
