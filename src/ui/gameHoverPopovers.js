import { createHoverPopoverController } from "./hoverPopover.js?v=0.5.6-pre-alpha";
import { buildWorldObjectDetailHtml, pickPriorityWorldObject } from "./worldObjectHover.js?v=0.5.6-pre-alpha";

export function createSkillHoverPopoverController(options) {
  const {
    root,
    getScreen,
    getPlayerSheet,
    getActiveSkills,
    getSkillById,
    getEquippedItemContextBySkill,
    buildSkillDetailHtml,
  } = options;
  const popover = createHoverPopoverController({ delayMs: 0 });

  function updateFromEvent(event) {
    if (getScreen() !== "game") {
      popover.scheduleHide();
      return;
    }
    const trigger = event.target.closest("[data-skill-detail-id]");
    if (!trigger || !root.contains(trigger)) {
      popover.scheduleHide();
      return;
    }
    const playerSheet = getPlayerSheet();
    const skillId = trigger.dataset.skillDetailId;
    const skills = getActiveSkills(playerSheet);
    const activeSkill = skills.find((skill) => skill.id === skillId) || null;
    const skill = activeSkill ? { ...getSkillById(activeSkill.id), level: activeSkill.level } : null;
    if (!skill) {
      popover.hide();
      return;
    }
    const skillState = { learned: true, level: 1 };
    const html = buildSkillDetailHtml(skill, skillState, {
      item: getEquippedItemContextBySkill(playerSheet, skill.id)?.item || null,
      playerSheet,
    });
    popover.updateAnchor({
      key: `${skill.id}:${Number(skillState?.level || 1)}`,
      anchorEl: trigger,
      html,
    });
  }

  return {
    hide: popover.hide,
    scheduleHide: popover.scheduleHide,
    updateFromEvent,
  };
}

export function createWorldObjectHoverPopoverController(options) {
  const {
    getState,
    screenPointToGrid,
    buildGroundLootDetailHtml,
  } = options;
  const popover = createHoverPopoverController({ delayMs: 220 });

  function updateFromEvent(event) {
    const state = getState();
    if (state.screen !== "game" || !state.run) {
      popover.scheduleHide();
      return;
    }
    const canvas = event.target.closest("#newGameCanvas");
    if (!canvas) {
      popover.scheduleHide();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const localX = Number(event.clientX || 0) - rect.left;
    const localY = Number(event.clientY || 0) - rect.top;
    const cell = screenPointToGrid(
      state.run,
      localX,
      localY,
      rect.width,
      rect.height,
      state.uiHud?.canvasZoom ?? 1,
    );
    if (!cell || !state.run.discovered?.[cell.y]?.[cell.x]) {
      popover.scheduleHide();
      return;
    }
    const objects = (state.run.objects || []).filter((object) => object.x === cell.x && object.y === cell.y);
    const object = pickPriorityWorldObject(objects);
    if (!object) {
      popover.scheduleHide();
      return;
    }
    const groundLootHtml = object.type === "ground_loot" && typeof buildGroundLootDetailHtml === "function"
      ? buildGroundLootDetailHtml(object, state)
      : "";
    const html = groundLootHtml || buildWorldObjectDetailHtml(object);
    popover.updatePoint({
      key: String(object.id || `${object.type}:${object.x}:${object.y}`),
      clientX: Number(event.clientX || 0),
      clientY: Number(event.clientY || 0),
      html,
    });
  }

  return {
    hide: popover.hide,
    scheduleHide: popover.scheduleHide,
    updateFromEvent,
  };
}
