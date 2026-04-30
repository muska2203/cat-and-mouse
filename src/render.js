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
  const cameraOffsetX = width / 2 - cameraX * tile;
  const cameraOffsetY = height / 2 - cameraY * tile;

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

  if (Array.isArray(run.objects)) {
    for (const object of run.objects) {
      if (!run.discovered?.[object.y]?.[object.x]) {
        continue;
      }
      const cx = cameraOffsetX + object.x * tile + tile / 2;
      const cy = cameraOffsetY + object.y * tile + tile / 2;
      ctx.font = `${Math.max(12, Math.floor(tile * 0.55))}px Arial`;
      ctx.fillText(object.icon || "?", cx, cy);

      if (object.type === "enemy") {
        // HP справа сверху
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#ef4444";
        ctx.font = `${Math.max(10, Math.floor(tile * 0.28))}px Arial`;
        ctx.fillText(`${object.data.hp}`, cameraOffsetX + (object.x + 1) * tile - 3, cameraOffsetY + object.y * tile + 2);
        // Урон слева снизу
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${object.data.damage}`, cameraOffsetX + object.x * tile + 3, cameraOffsetY + (object.y + 1) * tile - 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
      }
    }
  }

  ctx.font = `${Math.max(12, Math.floor(tile * 0.62))}px Arial`;
  const mouseScreenX = cameraOffsetX + playerVisual.x * tile + tile / 2;
  const mouseScreenY = cameraOffsetY + playerVisual.y * tile + tile / 2;
  ctx.fillText(
    "🐭",
    mouseScreenX,
    mouseScreenY
  );

  const mouseMaxDamage = Math.max(
    playerSheet?.derived?.ATK_PHYS || 1,
    playerSheet?.derived?.ATK_MAGIC || 1
  );
  // Урон мышки — подпись как у котов, рядом с иконкой мышки.
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(10, Math.floor(tile * 0.28))}px Arial`;
  ctx.fillText(
    `${mouseMaxDamage}`,
    mouseScreenX - tile * 0.36,
    mouseScreenY + tile * 0.24
  );

  drawFloatingTexts(ctx, run, cameraOffsetX, cameraOffsetY, tile, nowMs);
  drawLevelTransitionOverlay(ctx, run, width, height, nowMs);
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
    ctx.font = `${Math.max(11, Math.floor(tile * 0.3))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.value, baseX, y);
  }
  run.floatingTexts = alive;
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
