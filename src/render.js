import { roundStat } from "./rules.js?v=0.4.8-pre-alpha";
import { getCanvasCameraOffset, getCanvasTileSize } from "./runtime/canvasCamera.js?v=0.4.8-pre-alpha";
import { ensureRunFxState } from "./runtime/runFxState.js?v=0.4.8-pre-alpha";

export function drawRunToCanvas(canvas, run, playerSheet, nowMs = performance.now(), zoomScale = 1, overlay = null) {
  if (!canvas || !run) {
    return;
  }
  ensureRunFxState(run);

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Темная подложка скрывает границы карты до исследования.
  ctx.fillStyle = "#01030a";
  ctx.fillRect(0, 0, width, height);

  const playerVisual = getPlayerVisual(run, nowMs);
  const tile = getCanvasTileSize(width, height, zoomScale);
  const cameraX = playerVisual.x + 0.5;
  const cameraY = playerVisual.y + 0.5;
  const shake = getScreenShakeOffset(run, nowMs);
  const baseCameraOffset = getCanvasCameraOffset(width, height, cameraX, cameraY, tile);
  const cameraOffsetX = baseCameraOffset.offsetX + shake.x;
  const cameraOffsetY = baseCameraOffset.offsetY + shake.y;

  const minX = Math.max(0, Math.floor((-cameraOffsetX) / tile) - 2);
  const minY = Math.max(0, Math.floor((-cameraOffsetY) / tile) - 2);
  const maxX = Math.min(run.width - 1, Math.ceil((width - cameraOffsetX) / tile) + 2);
  const maxY = Math.min(run.height - 1, Math.ceil((height - cameraOffsetY) / tile) + 2);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = Math.floor(cameraOffsetX + x * tile);
      const py = Math.floor(cameraOffsetY + y * tile);
      const cell = run.grid[y][x];
      const discovered = run.discovered?.[y]?.[x];

      if (!discovered) continue;

      ctx.fillStyle = cell === 1 ? "#1f2937" : "#0f172a";
      ctx.fillRect(px, py, tile, tile);

      ctx.strokeStyle = "rgba(148,163,184,0.22)";
      ctx.strokeRect(px, py, tile, tile);
    }
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(12, Math.floor(tile * 0.6))}px Arial`;

  drawPathPreview(ctx, run, cameraOffsetX, cameraOffsetY, tile, nowMs, overlay);

  if (Array.isArray(run.objects)) {
    const visibleObjects = run.objects.filter((object) => run.discovered?.[object.y]?.[object.x]);
    const regularObjects = visibleObjects.filter(
      (object) => object.type !== "enemy" && object.type !== "poison_cloud",
    );
    const poisonCloudObjects = visibleObjects.filter((object) => object.type === "poison_cloud");
    const enemies = visibleObjects.filter((object) => object.type === "enemy");

    for (const object of regularObjects) {
      drawObjectIcon(ctx, run, object, cameraOffsetX, cameraOffsetY, tile, nowMs);
    }

    for (const cloud of poisonCloudObjects) {
      const cloudVisual = getObjectVisualPosition(run, cloud, nowMs);
      drawPoisonCloud(ctx, cameraOffsetX, cameraOffsetY, tile, cloudVisual, nowMs, cloud.icon || "☠");
    }

    for (const enemy of enemies) {
      const enemyVisual = getObjectVisualPosition(run, enemy, nowMs);
      const cx = cameraOffsetX + enemyVisual.x * tile + tile / 2;
      const cy = cameraOffsetY + enemyVisual.y * tile + tile / 2;

      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(12, Math.floor(tile * 0.55))}px Arial`;
      ctx.fillText(enemy.icon || "?", cx, cy);

      // HP и урон привязаны к иконке врага, чтобы не "прыгали" при анимации.
      // HP справа сверху от иконки
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#ef4444";
      ctx.font = `${Math.max(10, Math.floor(tile * 0.28))}px Arial`;
      ctx.fillText(`${enemy.data.hp}`, cx + tile * 0.2, cy - tile * 0.12);
      // Урон слева снизу от иконки
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${enemy.data.damage}`, cx - tile * 0.2, cy + tile * 0.1);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }
  }

  const skillTargetCells = Array.isArray(overlay?.skillTargetCells) ? overlay.skillTargetCells : (run.skillTargetCells || []);
  if (Array.isArray(skillTargetCells) && skillTargetCells.length > 0) {
    for (const cell of skillTargetCells) {
      if (!run.discovered?.[cell.y]?.[cell.x]) continue;
      const px = Math.floor(cameraOffsetX + cell.x * tile);
      const py = Math.floor(cameraOffsetY + cell.y * tile);
      ctx.fillStyle = "rgba(96, 165, 250, 0.25)";
      ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
      ctx.strokeStyle = "rgba(147, 197, 253, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
    }
  }

  if (run.discovered?.[run.goal.y]?.[run.goal.x]) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(12, Math.floor(tile * 0.6))}px Arial`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      "🕳",
      cameraOffsetX + run.goal.x * tile + tile / 2,
      cameraOffsetY + run.goal.y * tile + tile / 2
    );
  }

  ctx.font = `${Math.max(12, Math.floor(tile * 0.62))}px Arial`;
  const mouseScreenX = cameraOffsetX + playerVisual.x * tile + tile / 2;
  const mouseScreenY = cameraOffsetY + playerVisual.y * tile + tile / 2;

  ctx.fillText(
    "🐭",
    mouseScreenX,
    mouseScreenY
  );

  const skillTargetingPreviews = Array.isArray(overlay?.skillTargetingPreviews)
    ? overlay.skillTargetingPreviews
    : (run.skillTargetingPreviews || []);
  if (Array.isArray(skillTargetingPreviews) && skillTargetingPreviews.length > 0) {
    const grouped = new Map();
    for (const entry of skillTargetingPreviews) {
      const isPlayerCell = entry.x === run.player?.x && entry.y === run.player?.y;
      if (!isPlayerCell && !run.discovered?.[entry.y]?.[entry.x]) continue;
      const key = `${entry.x}:${entry.y}`;
      const current = grouped.get(key) || [];
      current.push(entry);
      grouped.set(key, current);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [key, entries] of grouped.entries()) {
      const [xText, yText] = key.split(":");
      const x = Number(xText);
      const y = Number(yText);
      const baseX = cameraOffsetX + x * tile + tile / 2;
      const baseY = cameraOffsetY + y * tile + tile / 2;
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const offsetY = (index - (entries.length - 1) / 2) * (Math.max(12, Math.floor(tile * 0.22)));
        const text = String(entry.value || "");
        const fontSize = Math.max(12, Math.floor(tile * 0.34));
        ctx.font = `700 ${fontSize}px Arial`;
        const textWidth = ctx.measureText(text).width;
        const badgePadX = Math.max(4, Math.floor(tile * 0.08));
        const badgeH = Math.max(14, Math.floor(fontSize * 1.15));
        const badgeW = Math.max(18, Math.floor(textWidth + badgePadX * 2));
        const drawX = baseX - badgeW / 2;
        const drawY = baseY + offsetY - badgeH / 2;
        ctx.fillStyle = "rgba(15, 23, 42, 0.74)";
        ctx.fillRect(drawX, drawY, badgeW, badgeH);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, drawY, badgeW, badgeH);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(2, 6, 23, 0.95)";
        ctx.strokeText(text, baseX, baseY + offsetY);
        ctx.fillStyle = entry.color || "#ffffff";
        ctx.fillText(text, baseX, baseY + offsetY);
      }
    }
  }

  drawFloatingTexts(ctx, run, cameraOffsetX, cameraOffsetY, tile, nowMs);
  drawLevelTransitionOverlay(ctx, run, width, height, nowMs);
}

function drawPathPreview(ctx, run, cameraOffsetX, cameraOffsetY, tile, nowMs, overlay = null) {
  const hoverCell = overlay?.hoverCell || run.hoverCell;
  const hoverCellEnemy = Boolean(overlay?.hoverCellEnemy ?? run.hoverCellEnemy);
  const previewCells = Array.isArray(overlay?.previewPathCells) ? overlay.previewPathCells : (run.previewPathCells || []);
  const lockedCells = Array.isArray(overlay?.lockedPathCells) ? overlay.lockedPathCells : (run.lockedPathCells || []);
  const lockedTarget = overlay?.lockedPathTarget || run.lockedPathTarget;
  const lockedPathEnemyId = overlay?.lockedPathEnemyId || run.lockedPathEnemyId;
  const lockedEnemyTarget = Boolean(lockedPathEnemyId);
  const lockedEnemy = lockedEnemyTarget
    ? run.objects?.find((object) => object.type === "enemy" && object.id === lockedPathEnemyId) || null
    : null;

  if (hoverCell && run.discovered?.[hoverCell.y]?.[hoverCell.x] && !lockedTarget) {
    const px = Math.floor(cameraOffsetX + hoverCell.x * tile);
    const py = Math.floor(cameraOffsetY + hoverCell.y * tile);
    ctx.strokeStyle = hoverCellEnemy ? "rgba(248, 113, 113, 0.9)" : "rgba(203, 213, 225, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
  }

  const pathForDraw = lockedCells.length > 0 ? lockedCells : previewCells;
  if (pathForDraw.length > 0) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = lockedCells.length > 0
      ? (lockedEnemyTarget ? "rgba(239, 68, 68, 0.95)" : "rgba(34, 197, 94, 0.95)")
      : "rgba(148, 163, 184, 0.9)";
    ctx.beginPath();
    ctx.moveTo(cameraOffsetX + run.player.x * tile + tile / 2, cameraOffsetY + run.player.y * tile + tile / 2);
    for (let i = 0; i < pathForDraw.length; i += 1) {
      const cell = pathForDraw[i];
      if (lockedEnemyTarget && lockedCells.length > 0 && i === pathForDraw.length - 1) {
        continue;
      }
      ctx.lineTo(cameraOffsetX + cell.x * tile + tile / 2, cameraOffsetY + cell.y * tile + tile / 2);
    }
    if (lockedEnemyTarget && lockedEnemy) {
      const enemyVisual = getObjectVisualPosition(run, lockedEnemy, nowMs);
      ctx.lineTo(
        cameraOffsetX + enemyVisual.x * tile + tile / 2,
        cameraOffsetY + enemyVisual.y * tile + tile / 2,
      );
    }
    ctx.stroke();
    ctx.restore();
  }

  if (lockedTarget && run.discovered?.[lockedTarget.y]?.[lockedTarget.x]) {
    let targetVisual = { x: lockedTarget.x, y: lockedTarget.y };
    if (lockedEnemyTarget) {
      if (lockedEnemy && run.discovered?.[lockedEnemy.y]?.[lockedEnemy.x]) {
        // Для автопути на врага привязываем рамку к визуальной позиции объекта (с анимацией).
        targetVisual = getObjectVisualPosition(run, lockedEnemy, nowMs);
      }
    }
    const px = Math.floor(cameraOffsetX + targetVisual.x * tile);
    const py = Math.floor(cameraOffsetY + targetVisual.y * tile);
    ctx.strokeStyle = lockedEnemyTarget ? "rgba(248, 113, 113, 0.98)" : "rgba(74, 222, 128, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
  }
}

function getObjectVisualPosition(run, object, nowMs) {
  const motion = run?.fx?.environmentMotion;
  if (!motion) {
    return { x: object.x, y: object.y };
  }
  if (motion.kind === "object-move") {
    if (motion.actorId !== object.id) {
      return { x: object.x, y: object.y };
    }
    if (motion.startMs == null) return { x: motion.from.x, y: motion.from.y };
    const t = Math.min(1, (nowMs - motion.startMs) / Math.max(1, motion.durationMs || 1));
    const x = motion.from.x + (motion.to.x - motion.from.x) * t;
    const y = motion.from.y + (motion.to.y - motion.from.y) * t;
    return { x, y };
  }
  if (motion.kind === "object-move-batch") {
    const actorMotion = (motion.actors || []).find((entry) => entry.actorId === object.id);
    if (!actorMotion) {
      return { x: object.x, y: object.y };
    }
    if (motion.startMs == null) {
      if (actorMotion.kind === "bounce") {
        return { x: actorMotion.from.x, y: actorMotion.from.y };
      }
      return { x: actorMotion.from.x, y: actorMotion.from.y };
    }
    const t = Math.min(1, (nowMs - motion.startMs) / Math.max(1, motion.durationMs || 1));
    if (actorMotion.kind === "bounce") {
      const push = Math.sin(Math.PI * t) * 0.36;
      const dirX = actorMotion.target.x - actorMotion.from.x;
      const dirY = actorMotion.target.y - actorMotion.from.y;
      const x = actorMotion.from.x + dirX * push;
      const y = actorMotion.from.y + dirY * push;
      return { x, y };
    }
    const x = actorMotion.from.x + (actorMotion.to.x - actorMotion.from.x) * t;
    const y = actorMotion.from.y + (actorMotion.to.y - actorMotion.from.y) * t;
    return { x, y };
  }
  return { x: object.x, y: object.y };
}

function drawObjectIcon(ctx, run, object, cameraOffsetX, cameraOffsetY, tile, nowMs) {
  const objectVisual = getObjectVisualPosition(run, object, nowMs);
  const px = cameraOffsetX + objectVisual.x * tile;
  const py = cameraOffsetY + objectVisual.y * tile;
  const cx = cameraOffsetX + objectVisual.x * tile + tile / 2;
  const cy = cameraOffsetY + objectVisual.y * tile + tile / 2;
  if (object.type === "ground_loot") {
    const icon = object?.data?.itemIcon || "?";
    const rarity = getItemRarityById(object?.data?.itemId);
    const rarityColors = getGroundLootRarityColors(rarity);
    ctx.save();
    if (rarityColors.glowBlur > 0) {
      ctx.shadowColor = rarityColors.glowColor;
      ctx.shadowBlur = rarityColors.glowBlur;
    }
    ctx.fillStyle = rarityColors.panelFill;
    ctx.strokeStyle = rarityColors.panelStroke;
    ctx.lineWidth = Math.max(1, Math.floor(tile * 0.04));
    const boxPad = Math.max(2, Math.floor(tile * 0.1));
    const boxSize = tile - boxPad * 2;
    ctx.fillRect(px + boxPad, py + boxPad, boxSize, boxSize);
    ctx.strokeRect(px + boxPad, py + boxPad, boxSize, boxSize);

    ctx.fillStyle = rarityColors.badgeFill;
    const badgeSize = Math.max(12, Math.floor(tile * 0.52));
    ctx.fillRect(cx - badgeSize / 2, cy - badgeSize / 2, badgeSize, badgeSize);
    ctx.strokeStyle = rarityColors.badgeStroke;
    ctx.strokeRect(cx - badgeSize / 2, cy - badgeSize / 2, badgeSize, badgeSize);

    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.max(11, Math.floor(tile * 0.42))}px Arial`;
    ctx.fillText(icon, cx, cy);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(12, Math.floor(tile * 0.55))}px Arial`;
  ctx.fillText(object.icon || "?", cx, cy);
}

function getItemRarityById(itemId) {
  const id = String(itemId || "");
  if (id.startsWith("unique_")) return "unique";
  if (id.startsWith("rare_")) return "rare";
  return "common";
}

function getGroundLootRarityColors(rarity) {
  if (rarity === "unique") {
    return {
      panelFill: "#2a1742",
      panelStroke: "#c445ff",
      badgeFill: "rgba(30, 18, 46, 0.88)",
      badgeStroke: "rgba(196, 69, 255, 0.42)",
      glowColor: "rgba(196, 69, 255, 0.5)",
      glowBlur: 14,
    };
  }
  if (rarity === "rare") {
    return {
      panelFill: "#0a2a33",
      panelStroke: "#00d2ff",
      badgeFill: "rgba(10, 42, 51, 0.84)",
      badgeStroke: "rgba(0, 210, 255, 0.44)",
      glowColor: "rgba(0, 210, 255, 0.35)",
      glowBlur: 10,
    };
  }
  return {
    panelFill: "#2a241e",
    panelStroke: "#7a6855",
    badgeFill: "rgba(42, 36, 30, 0.84)",
    badgeStroke: "rgba(122, 104, 85, 0.38)",
    glowColor: "rgba(122, 104, 85, 0.24)",
    glowBlur: 6,
  };
}

function drawPoisonCloud(ctx, cameraOffsetX, cameraOffsetY, tile, cloudVisual, nowMs, icon) {
  const px = cameraOffsetX + cloudVisual.x * tile;
  const py = cameraOffsetY + cloudVisual.y * tile;
  const cx = px + tile / 2;
  const cy = py + tile / 2;
  const pulse = (Math.sin(nowMs * 0.006 + cloudVisual.x * 0.8 + cloudVisual.y * 1.1) + 1) / 2;

  ctx.fillStyle = `rgba(110, 231, 183, ${0.13 + pulse * 0.08})`;
  ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);

  const puffs = [
    { ox: -0.22, oy: -0.12, base: 0.2, speed: 0.004, alpha: 0.2 },
    { ox: 0.18, oy: -0.18, base: 0.16, speed: 0.005, alpha: 0.16 },
    { ox: -0.02, oy: 0.14, base: 0.22, speed: 0.0036, alpha: 0.18 },
    { ox: 0.26, oy: 0.08, base: 0.14, speed: 0.0048, alpha: 0.14 },
  ];

  for (let i = 0; i < puffs.length; i += 1) {
    const puff = puffs[i];
    const phase = nowMs * puff.speed + i * 1.7 + cloudVisual.x * 0.9 + cloudVisual.y * 0.5;
    const driftX = Math.sin(phase) * tile * 0.06;
    const driftY = Math.cos(phase * 1.2) * tile * 0.05;
    const radius = tile * (puff.base + (Math.sin(phase * 0.9) + 1) * 0.04);
    ctx.fillStyle = `rgba(74, 222, 128, ${puff.alpha})`;
    ctx.beginPath();
    ctx.arc(cx + puff.ox * tile + driftX, cy + puff.oy * tile + driftY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = `rgba(240, 253, 250, ${0.62 + pulse * 0.18})`;
  ctx.font = `${Math.max(11, Math.floor(tile * 0.42))}px Arial`;
  ctx.fillText(icon, cx, cy);
}

function getPlayerVisual(run, nowMs) {
  const motion = run?.fx?.motion;
  if (!motion) {
    return { x: run.player.x, y: run.player.y };
  }
  if (motion.startMs == null) return { x: motion.from.x, y: motion.from.y };
  const t = Math.min(1, (nowMs - motion.startMs) / motion.durationMs);

  if (motion.kind === "move") {
    const x = motion.from.x + (motion.to.x - motion.from.x) * t;
    const y = motion.from.y + (motion.to.y - motion.from.y) * t;
    return { x, y };
  }

  if (motion.kind === "bounce") {
    const push = Math.sin(Math.PI * t) * 0.36;
    const dirX = motion.target.x - motion.from.x;
    const dirY = motion.target.y - motion.from.y;
    const x = motion.from.x + dirX * push;
    const y = motion.from.y + dirY * push;
    return { x, y };
  }

  return { x: run.player.x, y: run.player.y };
}

function drawFloatingTexts(ctx, run, cameraOffsetX, cameraOffsetY, tile, nowMs) {
  const floatingTexts = run?.fx?.floatingTexts || [];
  if (!Array.isArray(floatingTexts) || floatingTexts.length === 0) {
    return;
  }

  for (const text of floatingTexts) {
    if (text.startMs == null) continue;
    const t = (nowMs - text.startMs) / text.durationMs;
    if (t >= 1) {
      continue;
    }

    const baseX = cameraOffsetX + text.x * tile + tile / 2;
    const baseY = cameraOffsetY + text.y * tile + tile / 2;
    const y = baseY - t * tile * 0.7;
    const alpha = 1 - t;

    ctx.fillStyle = withAlpha(text.color || "#ffffff", alpha);
    const scale = Math.max(0.8, text.scale || 1);
    const fontWeight = text.isCrit ? "700 " : "";
    ctx.font = `${fontWeight}${Math.max(11, Math.floor(tile * 0.3 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.value, baseX, y);
  }
}

function getScreenShakeOffset(run, nowMs) {
  const shake = run?.fx?.screenShake;
  if (!shake) {
    return { x: 0, y: 0 };
  }
  if (shake.startMs == null) return { x: 0, y: 0 };
  const t = (nowMs - shake.startMs) / Math.max(1, shake.durationMs || 1);
  if (t >= 1) return { x: 0, y: 0 };

  const fade = 1 - t;
  const amplitude = (shake.amplitudePx || 4) * fade;
  const randomFloat = run?.rng && typeof run.rng.nextFloat === "function"
    ? () => run.rng.nextFloat()
    : () => Math.random();
  return {
    x: (randomFloat() * 2 - 1) * amplitude,
    y: (randomFloat() * 2 - 1) * amplitude,
  };
}

function withAlpha(hexOrColor, alpha) {
  if (!hexOrColor.startsWith("#")) {
    return `rgba(255,255,255,${alpha})`;
  }
  const hex = hexOrColor.slice(1);
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawLevelTransitionOverlay(ctx, run, width, height, nowMs) {
  const transition = run?.fx?.levelTransition;
  if (run.status !== "level_complete" || !transition) {
    return;
  }

  if (transition.startedMs == null) return;
  const duration = Math.max(1, transition.durationMs || 420);
  const t = Math.max(0, Math.min(1, (nowMs - transition.startedMs) / duration));
  const alpha = Math.min(0.8, t * 0.9);

  ctx.fillStyle = `rgba(2, 6, 23, ${alpha})`;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(241, 245, 249, ${Math.max(0.25, t)})`;
  ctx.font = "700 32px Arial";
  ctx.fillText(`Уровень ${run.level + 1}`, width / 2, height / 2 - 8);
  ctx.font = "400 16px Arial";
  ctx.fillText("Подземный ход перестраивается...", width / 2, height / 2 + 24);
}

