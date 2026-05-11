/**
 * Генерирует простые болванки иконок скиллов (128×128, RGBA), пока нет финального арта.
 * Запуск: node scripts/gen-skill-placeholder-pngs.mjs
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, "../src/assets/sprites/skills");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePngRgba(width, height, getRgba) {
  const rawLines = [];
  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(1 + width * 4);
    line[0] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getRgba(x, y);
      const o = 1 + x * 4;
      line[o] = r & 255;
      line[o + 1] = g & 255;
      line[o + 2] = b & 255;
      line[o + 3] = a & 255;
    }
    rawLines.push(line);
  }
  const raw = Buffer.concat(rawLines);
  const compressed = zlib.deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}

function rgbaFromHex(hex, a = 255) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** Пиксельная сетка ~16×16, масштаб до 128 */
function scaledCell(x, y, step = 8) {
  return [Math.floor(x / step), Math.floor(y / step)];
}

const cx = 63.5;
const cy = 63.5;

const drawers = {
  ice_spike(x, y) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 58) return [0, 0, 0, 0];
    const ang = Math.atan2(y - cy, x - cx);
    const rays = 6;
    const wave = 0.5 + 0.5 * Math.cos(ang * rays + d * 0.25);
    const edge = smoothstep(52, 58, d);
    const [gx] = scaledCell(x, y, 8);
    const hatch = (gx & 1) === 0 ? 12 : 0;
    const r = Math.round(130 + hatch * wave * (1 - edge));
    const g = Math.round(210 + hatch * wave * (1 - edge));
    const b = 255;
    const a = Math.round(255 * (1 - edge));
    return [r, g, b, a];
  },

  stone_wall(x, y) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 56) return [0, 0, 0, 0];
    const [gx, gy] = scaledCell(x, y, 16);
    const mortar = (gx + gy) % 2 === 0 ? 1 : 0;
    const base = mortar ? rgbaFromHex("#7a7a7a") : rgbaFromHex("#5c5c5c");
    const noise = ((x ^ y) & 7) - 3;
    const edge = smoothstep(50, 56, d);
    const a = Math.round(255 * (1 - edge));
    return [
      Math.min(255, Math.max(0, base[0] + noise)),
      Math.min(255, Math.max(0, base[1] + noise)),
      Math.min(255, Math.max(0, base[2] + noise)),
      a,
    ];
  },

  shock_wave(x, y) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 58 || d < 8) return [0, 0, 0, 0];
    const rings = (Math.sin(d * 0.85 - 2) * 0.5 + 0.5) * smoothstep(58, 48, d);
    const warm = rgbaFromHex("#f4d03f");
    const edge = smoothstep(56, 58, d);
    const a = Math.round(220 * rings * (1 - edge));
    return [warm[0], warm[1], warm[2], a];
  },

  chain_lightning(x, y) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 56) return [0, 0, 0, 0];
    const ang = Math.atan2(y - cy, x - cx);
    const zig = Math.abs(Math.sin(ang * 9 + d * 0.35));
    const bolt = zig > 0.55 ? 1 : 0;
    const core = bolt ? rgbaFromHex("#fffef0") : rgbaFromHex("#3498db");
    const edge = smoothstep(50, 56, d);
    const a = Math.round((bolt ? 255 : 140) * (1 - edge));
    return [core[0], core[1], core[2], a];
  },

  steel_stance(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > 56) return [0, 0, 0, 0];
    const shield =
      Math.abs(dx) * 0.85 + Math.abs(dy) * 1.15 < 38 && dy > -12 ? 1 : 0;
    const col = shield ? rgbaFromHex("#85c1e9") : rgbaFromHex("#2e4057");
    const edge = smoothstep(50, 56, d);
    const a = Math.round((shield ? 230 : 90) * (1 - edge));
    return [col[0], col[1], col[2], a];
  },

  whirlwind(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > 56 || d < 6) return [0, 0, 0, 0];
    const ang = Math.atan2(dy, dx);
    const spiral = 0.5 + 0.5 * Math.sin(ang * 5 + d * 0.22);
    const dust = rgbaFromHex("#bdc3c7");
    const edge = smoothstep(54, 56, d);
    const a = Math.round(200 * spiral * smoothstep(10, 22, d) * (1 - edge));
    return [dust[0], dust[1], dust[2], a];
  },

  lunge(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > 56) return [0, 0, 0, 0];
    const blade = Math.abs(dx * 0.65 + dy * 0.85) < 9 && dx > -28 && dx < 36 ? 1 : 0;
    const glint = Math.abs(dx * 0.65 + dy * 0.85) < 3 ? 1 : 0;
    const col = glint ? rgbaFromHex("#ffffff") : blade ? rgbaFromHex("#aab7b8") : rgbaFromHex("#34495e");
    const edge = smoothstep(52, 56, d);
    const a = Math.round((glint ? 255 : blade ? 220 : 70) * (1 - edge));
    return [col[0], col[1], col[2], a];
  },

  cleave(x, y) {
    const dx = x - cx;
    const dy = y - cy + 6;
    const d = Math.hypot(dx, dy);
    if (d > 56) return [0, 0, 0, 0];
    const ang = Math.atan2(dy, dx);
    const arc = ang > -0.35 && ang < 1.2 && d > 14 && d < 48 ? 1 : 0;
    const hot = ang > 0.15 && ang < 0.85 && d > 28 ? 1 : 0;
    const col = hot ? rgbaFromHex("#f1948a") : arc ? rgbaFromHex("#cb4335") : rgbaFromHex("#641e16");
    const edge = smoothstep(52, 56, d);
    const a = Math.round((arc ? 230 : 55) * (1 - edge));
    return [col[0], col[1], col[2], a];
  },

  supremacy(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > 56) return [0, 0, 0, 0];
    const edge = smoothstep(52, 56, d);
    const gold = rgbaFromHex("#f7dc6f");
    const blood = rgbaFromHex("#7b241c");
    const aGold = Math.round(245 * (1 - edge));
    const tipY = -26;
    const baseY = -8;
    const peaks = [-22, 0, 22];
    for (const px of peaks) {
      const lx = dx - px;
      if (dy >= tipY && dy <= baseY) {
        const t = (dy - tipY) / (baseY - tipY || 1);
        const halfW = 7 + t * 13;
        if (Math.abs(lx) <= halfW) {
          return [gold[0], gold[1], gold[2], aGold];
        }
      }
    }
    if (dy > -8 && dy < 18 && Math.abs(dx) < 36) {
      return [gold[0], gold[1], gold[2], aGold];
    }
    const glow = smoothstep(56, 22, d);
    const a = Math.round(195 * glow * (1 - edge));
    return [blood[0], blood[1], blood[2], a];
  },
};

const IDS = Object.keys(drawers);

function main() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
  for (const id of IDS) {
    const fn = drawers[id];
    const png = encodePngRgba(128, 128, (x, y) => fn(x, y));
    const out = path.join(SKILLS_DIR, `${id}.png`);
    fs.writeFileSync(out, png);
    console.log("written", path.relative(process.cwd(), out));
  }
}

main();
