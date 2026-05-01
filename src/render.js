export function drawRunToCanvas(canvas, run, playerSheet, nowMs = performance.now()) {
  if (!canvas || !run) {
    return;
  }

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
  const tile = Math.max(24, Math.floor(Math.min(width, height) / 11));
  const cameraX = playerVisual.x + 0.5;
  const cameraY = playerVisual.y + 0.5;
  const shake = getScreenShakeOffset(run, nowMs);
  const cameraOffsetX = width / 2 - cameraX * tile + shake.x;
  const cameraOffsetY = height / 2 - cameraY * tile + shake.y;

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
  if (run.discovered?.[run.goal.y]?.[run.goal.x]) {
    ctx.fillText(
      "🕳",
      cameraOffsetX + run.goal.x * tile + tile / 2,
      cameraOffsetY + run.goal.y * tile + tile / 2
    );
  }

  drawPathPreview(ctx, run, cameraOffsetX, cameraOffsetY, tile);

  if (Array.isArray(run.objects)) {
    const visibleObjects = run.objects.filter((object) => run.discovered?.[object.y]?.[object.x]);
    const regularObjects = visibleObjects.filter((object) => object.type !== "enemy" && object.type !== "trap_cloud");
    const cloudObjects = visibleObjects.filter((object) => object.type === "trap_cloud");
    const enemies = visibleObjects.filter((object) => object.type === "enemy");

    for (const object of regularObjects) {
      drawObjectIcon(ctx, run, object, cameraOffsetX, cameraOffsetY, tile, nowMs);
    }

    for (const cloud of cloudObjects) {
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

  if (Array.isArray(run.skillTargetCells) && run.skillTargetCells.length > 0) {
    for (const cell of run.skillTargetCells) {
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

  ctx.font = `${Math.max(12, Math.floor(tile * 0.62))}px Arial`;
  const mouseScreenX = cameraOffsetX + playerVisual.x * tile + tile / 2;
  const mouseScreenY = cameraOffsetY + playerVisual.y * tile + tile / 2;

  if (run.mirrorVeil?.charges > 0) {
    const pulse = (Math.sin(nowMs * 0.012) + 1) / 2;
    const radius = Math.floor(tile * (0.36 + pulse * 0.1));
    const aura = ctx.createRadialGradient(mouseScreenX, mouseScreenY, 4, mouseScreenX, mouseScreenY, radius);
    aura.addColorStop(0, "rgba(147, 197, 253, 0.22)");
    aura.addColorStop(0.75, "rgba(125, 211, 252, 0.14)");
    aura.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(mouseScreenX, mouseScreenY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillText(
    "🐭",
    mouseScreenX,
    mouseScreenY
  );

  const mouseBaseDamage = Math.max(
    playerSheet?.derived?.ATK_PHYS || 1,
    playerSheet?.derived?.ATK_MAGIC || 1
  );
  const mouseDamageMultiplier = Math.max(1, run?.nextHitMultiplier || 1);
  const mouseShownDamage = Math.max(1, Math.floor(mouseBaseDamage * mouseDamageMultiplier));
  // Урон мышки — подпись как у котов, рядом с иконкой мышки.
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const preview = run?.skillTargetingPreview;
  const shownValue = preview?.value ?? mouseShownDamage;
  const shownColor = preview?.kind === "damage"
    ? "#ef4444"
    : preview?.kind === "heal"
      ? "#22c55e"
      : (mouseDamageMultiplier > 1 ? "#fde047" : "#ffffff");
  ctx.fillStyle = shownColor;
  ctx.font = `${Math.max(10, Math.floor(tile * 0.28))}px Arial`;
  ctx.fillText(
    `${shownValue}`,
    mouseScreenX - tile * 0.36,
    mouseScreenY + tile * 0.24
  );

  drawFloatingTexts(ctx, run, cameraOffsetX, cameraOffsetY, tile, nowMs);
  drawLevelTransitionOverlay(ctx, run, width, height, nowMs);
}

function drawPathPreview(ctx, run, cameraOffsetX, cameraOffsetY, tile) {
  const hoverCell = run.hoverCell;
  const previewCells = Array.isArray(run.previewPathCells) ? run.previewPathCells : [];
  const lockedCells = Array.isArray(run.lockedPathCells) ? run.lockedPathCells : [];
  const lockedTarget = run.lockedPathTarget;

  if (hoverCell && run.discovered?.[hoverCell.y]?.[hoverCell.x] && !lockedTarget) {
    const px = Math.floor(cameraOffsetX + hoverCell.x * tile);
    const py = Math.floor(cameraOffsetY + hoverCell.y * tile);
    ctx.strokeStyle = "rgba(203, 213, 225, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
  }

  const pathForDraw = lockedCells.length > 0 ? lockedCells : previewCells;
  if (pathForDraw.length > 0) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = lockedCells.length > 0 ? "rgba(34, 197, 94, 0.95)" : "rgba(148, 163, 184, 0.9)";
    ctx.beginPath();
    ctx.moveTo(cameraOffsetX + run.player.x * tile + tile / 2, cameraOffsetY + run.player.y * tile + tile / 2);
    for (let i = 0; i < pathForDraw.length; i += 1) {
      const cell = pathForDraw[i];
      ctx.lineTo(cameraOffsetX + cell.x * tile + tile / 2, cameraOffsetY + cell.y * tile + tile / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (lockedTarget && run.discovered?.[lockedTarget.y]?.[lockedTarget.x]) {
    const px = Math.floor(cameraOffsetX + lockedTarget.x * tile);
    const py = Math.floor(cameraOffsetY + lockedTarget.y * tile);
    ctx.strokeStyle = "rgba(74, 222, 128, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
  }
}

function getObjectVisualPosition(run, object, nowMs) {
  const motion = run?.environmentMotion;
  if (!motion) {
    return { x: object.x, y: object.y };
  }
  if (motion.kind === "object-move") {
    if (motion.actorId !== object.id) {
      return { x: object.x, y: object.y };
    }
    if (motion.startMs == null) {
      motion.startMs = nowMs;
    }
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
      motion.startMs = nowMs;
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
  const cx = cameraOffsetX + objectVisual.x * tile + tile / 2;
  const cy = cameraOffsetY + objectVisual.y * tile + tile / 2;
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(12, Math.floor(tile * 0.55))}px Arial`;
  ctx.fillText(object.icon || "?", cx, cy);
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
  if (!run.motion) {
    return { x: run.player.x, y: run.player.y };
  }

  const motion = run.motion;
  if (motion.startMs == null) {
    motion.startMs = nowMs;
  }
  const t = Math.min(1, (nowMs - motion.startMs) / motion.durationMs);

  if (motion.kind === "move") {
    const x = motion.from.x + (motion.to.x - motion.from.x) * t;
    const y = motion.from.y + (motion.to.y - motion.from.y) * t;
    if (t >= 1) run.motion = null;
    return { x, y };
  }

  if (motion.kind === "bounce") {
    const push = Math.sin(Math.PI * t) * 0.36;
    const dirX = motion.target.x - motion.from.x;
    const dirY = motion.target.y - motion.from.y;
    const x = motion.from.x + dirX * push;
    const y = motion.from.y + dirY * push;
    if (t >= 1) run.motion = null;
    return { x, y };
  }

  run.motion = null;
  return { x: run.player.x, y: run.player.y };
}

function drawFloatingTexts(ctx, run, cameraOffsetX, cameraOffsetY, tile, nowMs) {
  if (!Array.isArray(run.floatingTexts) || run.floatingTexts.length === 0) {
    return;
  }

  const alive = [];
  for (const text of run.floatingTexts) {
    if (text.startMs == null) {
      text.startMs = nowMs;
    }
    const t = (nowMs - text.startMs) / text.durationMs;
    if (t >= 1) {
      continue;
    }
    alive.push(text);

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
  run.floatingTexts = alive;
}

function getScreenShakeOffset(run, nowMs) {
  const shake = run?.screenShake;
  if (!shake) {
    return { x: 0, y: 0 };
  }
  if (shake.startMs == null) {
    shake.startMs = nowMs;
  }
  const t = (nowMs - shake.startMs) / Math.max(1, shake.durationMs || 1);
  if (t >= 1) {
    run.screenShake = null;
    return { x: 0, y: 0 };
  }

  const fade = 1 - t;
  const amplitude = (shake.amplitudePx || 4) * fade;
  return {
    x: (Math.random() * 2 - 1) * amplitude,
    y: (Math.random() * 2 - 1) * amplitude,
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
  if (run.status !== "level_complete" || !run.levelTransition) {
    return;
  }

  if (run.levelTransition.startedMs == null) {
    run.levelTransition.startedMs = nowMs;
  }
  const duration = Math.max(1, run.levelTransition.durationMs || 420);
  const t = Math.max(0, Math.min(1, (nowMs - run.levelTransition.startedMs) / duration));
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
