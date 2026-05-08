import { buildItemSpriteStackHtml } from "../spriteIconHtml.js?v=0.5.1-pre-alpha";

export function buildAnvilOverlayHtml({
  session,
  modeDescription,
  esc,
  getItemById,
  getRarityBadgeClass,
  improvePreview,
  reforgePreview,
  recyclePreview,
  reforgeCandidates,
  windowPosition = null,
}) {
  if (!session) return "";
  const mode = session.mode || null;
  const usesLeft = Math.max(0, Number(session?.usesLeft ?? 0));
  const usesText = `Осталось созданий: ${usesLeft}`;
  const floatingClass = windowPosition ? "cm-anvil-card--floating" : "";
  const floatingStyle = windowPosition
    ? ` style="left:${Math.round(Number(windowPosition.x || 0))}px;top:${Math.round(Number(windowPosition.y || 0))}px;"`
    : "";
  if (!mode) {
    return `
      <div class="cm-anvil-overlay cm-modal-backdrop is-open">
        <section class="cm-panel cm-modal cm-anvil-card ${floatingClass}" role="dialog" aria-modal="true" aria-label="Наковальня"${floatingStyle}>
          <h2 class="cm-panel__title cm-anvil-drag-handle" data-action="anvil-drag-handle">Наковальня</h2>
          <div class="cm-panel__body">
            <p class="cm-anvil-note">${usesText}</p>
            <div class="cm-anvil-mode-grid">
              <button type="button" class="cm-anvil-mode-card" data-action="anvil-mode-select" data-anvil-mode="recycle">
                <span class="cm-anvil-mode-card__icon">♻</span>
                <span class="cm-anvil-mode-card__title">Переработка</span>
                <span class="cm-anvil-mode-card__desc">Случайный предмет по сумме шансов.</span>
              </button>
              <button type="button" class="cm-anvil-mode-card" data-action="anvil-mode-select" data-anvil-mode="improve">
                <span class="cm-anvil-mode-card__icon">⬆</span>
                <span class="cm-anvil-mode-card__title">Улучшение</span>
                <span class="cm-anvil-mode-card__desc">Три одинаковых в предмет редкостью выше.</span>
              </button>
              <button type="button" class="cm-anvil-mode-card" data-action="anvil-mode-select" data-anvil-mode="reforge">
                <span class="cm-anvil-mode-card__icon">⚒</span>
                <span class="cm-anvil-mode-card__title">Перековка</span>
                <span class="cm-anvil-mode-card__desc">Три одной редкости в выбранный предмет.</span>
              </button>
            </div>
            <div class="cm-modal__actions">
              <button class="cm-btn cm-btn--secondary" type="button" data-action="anvil-close">Закрыть</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  const slotHtml = [0, 1, 2]
    .map((slotIndex) => {
      const slot = session.slots?.[slotIndex] || null;
      if (!slot) {
        return `<div class="cm-inv-cell cm-anvil-slot" data-anvil-slot-index="${slotIndex}"></div>`;
      }
      const item = getItemById(slot.itemId);
      return `
        <button
          type="button"
          class="cm-inv-cell cm-anvil-slot cm-anvil-slot--filled ${getRarityBadgeClass(slot.rarity)}"
          data-action="anvil-slot-return"
          data-drag-kind="anvil-slot"
          data-anvil-slot-index="${slotIndex}"
          data-preview-item-screen="game"
          data-preview-item-id="${slot.itemId}"
          data-preview-item-bag-instance-id="${slot.instanceId || ""}"
          data-inventory-detail-item-id="${slot.itemId}"
          data-inventory-detail-instance-id="${slot.instanceId || ""}"
          draggable="true"
        >${buildItemSpriteStackHtml(item)}</button>
      `;
    })
    .join("");

  const resultReady = !!session.result;
  const improvePreviewReady = mode === "improve" && !resultReady && !!improvePreview?.itemId;
  const reforgePreviewReady = mode === "reforge" && !resultReady && !!reforgePreview?.itemId;
  const resultState = resultReady
    ? session.result
    : improvePreviewReady
      ? improvePreview
      : reforgePreviewReady
        ? reforgePreview
        : null;
  const resultItem = resultState ? getItemById(resultState.itemId) : null;
  const resultClass = resultState ? getRarityBadgeClass(resultState.rarity) : "";
  const resultDisabled = !resultReady && !resultState;
  const recyclePreviewSafe = recyclePreview || {};
  let recycleProbClass = "";
  if (mode === "recycle") {
    const commonChance = Number(recyclePreviewSafe.commonChance || 0);
    const rareChance = Number(recyclePreviewSafe.rareChance || 0);
    const uniqueChance = Number(recyclePreviewSafe.uniqueChance || 0);
    if (uniqueChance >= rareChance && uniqueChance >= commonChance) {
      recycleProbClass = "cm-anvil-result--prob-unique";
    } else if (rareChance >= commonChance) {
      recycleProbClass = "cm-anvil-result--prob-rare";
    } else {
      recycleProbClass = "cm-anvil-result--prob-common";
    }
  }
  const resultCell = `
    <button
      type="button"
      class="cm-inv-cell cm-anvil-result ${resultClass} ${resultReady ? "cm-anvil-result--ready" : ""} ${recycleProbClass}"
      data-action="${resultReady ? "anvil-result-take" : ""}"
      data-drag-kind="${resultReady ? "anvil-result" : ""}"
      data-anvil-result="${resultReady ? "true" : "false"}"
      data-preview-item-screen="game"
      ${resultState?.itemId ? `data-preview-item-id="${resultState.itemId}"` : ""}
      ${resultReady && session.result?.instanceId ? `data-preview-item-bag-instance-id="${session.result.instanceId}"` : ""}
      ${resultState?.itemId ? `data-inventory-detail-item-id="${resultState.itemId}"` : ""}
      ${resultReady && session.result?.instanceId ? `data-inventory-detail-instance-id="${session.result.instanceId}"` : ""}
      ${resultReady ? "draggable=\"true\"" : ""}
      ${resultDisabled ? "disabled" : ""}
    >${buildItemSpriteStackHtml(resultItem)}</button>
  `;
  const canCraft = !!session.canCraft;
  const actionLabel = mode === "recycle" ? "Переработать" : mode === "improve" ? "Улучшить" : "Перековать";
  const reforgeSelect = mode === "reforge"
    ? `
      <label class="cm-anvil-reforge-label">
        Цель перековки
        <select class="cm-anvil-reforge-select" data-action="anvil-reforge-target">
          <option value="">Выбери предмет...</option>
          ${reforgeCandidates.map((item) => `
            <option value="${item.id}" ${session.reforgeTargetItemId === item.id ? "selected" : ""}>${esc(item.icon || "•")} ${esc(item.name)}</option>
          `).join("")}
        </select>
      </label>
    `
    : "";
  const recycleChances = mode === "recycle" && recyclePreview
    ? `<p class="cm-anvil-note">Обычный: ${Math.round(recyclePreview.commonChance)}% · Редкий: ${Math.round(recyclePreview.rareChance)}% · Уникальный: ${Math.round(recyclePreview.uniqueChance)}%</p>`
    : "";

  return `
    <div class="cm-anvil-overlay cm-modal-backdrop is-open">
      <section class="cm-panel cm-modal cm-anvil-card ${floatingClass}" role="dialog" aria-modal="true" aria-label="Наковальня"${floatingStyle}>
        <h2 class="cm-panel__title cm-anvil-drag-handle" data-action="anvil-drag-handle">Наковальня: ${mode === "recycle" ? "Переработка" : mode === "improve" ? "Улучшение" : "Перековка"}</h2>
        <div class="cm-panel__body">
          <button type="button" class="cm-btn cm-btn--secondary cm-anvil-back-btn" data-action="anvil-back-to-modes">← К выбору</button>
          <p class="cm-anvil-subtitle">${esc(modeDescription || "")}</p>
          <p class="cm-anvil-note">${usesText}</p>
          ${reforgeSelect}
          <div class="cm-anvil-craft-row">
            <div class="cm-anvil-slots">${slotHtml}</div>
            <div class="cm-anvil-arrow">→</div>
            <div
              class="cm-anvil-result-wrap"
              ${resultState?.itemId ? `data-inventory-detail-item-id="${resultState.itemId}"` : ""}
              ${resultReady && session.result?.instanceId ? `data-inventory-detail-instance-id="${session.result.instanceId}"` : ""}
            >${resultCell}</div>
          </div>
          ${recycleChances}
          <div class="cm-modal__actions">
            <button
              class="cm-btn cm-btn--primary cm-anvil-action-btn"
              type="button"
              data-action="anvil-craft"
              ${canCraft ? "" : "disabled"}
            >${actionLabel}</button>
            <button class="cm-btn cm-btn--secondary" type="button" data-action="anvil-close">Закрыть</button>
          </div>
        </div>
      </section>
    </div>
  `;
}
