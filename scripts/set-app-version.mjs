#!/usr/bin/env node
/**
 * Синхронизирует версию приложения: APP_VERSION в src/app-config.js,
 * query-параметр ?v= во всех ES-импортах под src/ и в index.html (стили + entry).
 *
 * Записи `version` в src/devlog.js не трогаются: новую версию там добавляют вручную
 * в начало массива после смены APP_VERSION (см. AGENTS.md).
 *
 * Использование:
 *   node scripts/set-app-version.mjs --current
 *   node scripts/set-app-version.mjs --suggest
 *   node scripts/set-app-version.mjs --verify
 *   node scripts/set-app-version.mjs 0.4.4-pre-alpha
 *   node scripts/set-app-version.mjs --dry-run 0.4.4-pre-alpha
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const APP_CONFIG = path.join(REPO_ROOT, "src", "app-config.js");
const INDEX_HTML = path.join(REPO_ROOT, "index.html");

const APP_VERSION_LINE = /export const APP_VERSION = "([^"]*)";/;

function readCurrentVersion() {
  const raw = fs.readFileSync(APP_CONFIG, "utf8");
  const m = raw.match(APP_VERSION_LINE);
  if (!m) {
    throw new Error(`Не найдена строка APP_VERSION в ${APP_CONFIG}`);
  }
  return m[1];
}

/** Простая подсказка: +1 к patch в semver-префиксе, суффикс сохраняется */
function suggestNextVersion(current) {
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (m) {
    const nextPatch = String(Number(m[3]) + 1);
    return `${m[1]}.${m[2]}.${nextPatch}${m[4]}`;
  }
  return `${current}+1`;
}

function* walkFiles(dir, extensions) {
  const skip = new Set(["node_modules", ".git", "dist", "build"]);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (skip.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walkFiles(full, extensions);
    } else if (extensions.some((ext) => ent.name.endsWith(ext))) {
      yield full;
    }
  }
}

/** Относительные import/export from в src/*.js должны заканчиваться на ?v=<APP_VERSION> */
const REL_FROM_RE = /\bfrom\s+["'](\.[^"']+)["']/g;

function verifyVersionConsistency(expectedV) {
  const expectedSuffix = `?v=${expectedV}`;
  const problems = [];

  for (const file of walkFiles(path.join(REPO_ROOT, "src"), [".js"])) {
    const raw = fs.readFileSync(file, "utf8");
    REL_FROM_RE.lastIndex = 0;
    let m;
    while ((m = REL_FROM_RE.exec(raw)) !== null) {
      const spec = m[1];
      if (!spec.endsWith(`?v=${expectedV}`)) {
        problems.push(`${path.relative(REPO_ROOT, file)}: from "${spec}"`);
      }
    }
  }

  const idxRaw = fs.readFileSync(INDEX_HTML, "utf8");
  for (const m of idxRaw.matchAll(/\b(?:href|src)="(\.\/[^"]+)"/g)) {
    const url = m[1];
    if (!url.match(/\.(?:css|js)(?:\?|$)/)) continue;
    if (!url.endsWith(expectedSuffix)) {
      problems.push(`${path.relative(REPO_ROOT, INDEX_HTML)}: ${url}`);
    }
  }

  if (problems.length > 0) {
    console.error("Несогласованность версии (?v= или index.html):\n");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(2);
  }
  console.log(`OK: импорты в src/ и ссылки в index.html согласованы с ${expectedV}`);
}

function applyReplacements(content, oldV, newV) {
  const needle = `?v=${oldV}`;
  const replacement = `?v=${newV}`;
  if (!content.includes(needle) && !content.match(APP_VERSION_LINE)) {
    return { next: content, changed: 0 };
  }
  let changed = 0;
  let next = content;
  const parts = next.split(needle);
  changed += parts.length - 1;
  next = parts.join(replacement);

  const verLine = new RegExp(
    `export const APP_VERSION = "${oldV.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`,
  );
  if (verLine.test(next)) {
    next = next.replace(verLine, `export const APP_VERSION = "${newV}";`);
    changed += 1;
  }
  return { next, changed };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filtered = args.filter((a) => a !== "--dry-run");

  if (filtered.length === 0 || filtered[0] === "--help" || filtered[0] === "-h") {
    console.log(`Синхронизация версии (корень репозитория: ${REPO_ROOT})

  node scripts/set-app-version.mjs --current     показать текущую версию
  node scripts/set-app-version.mjs --suggest     предложить следующую (эвристика)
  node scripts/set-app-version.mjs --verify      проверить ?v= в src/ и index.html
  node scripts/set-app-version.mjs <версия>     записать версию везде
  node scripts/set-app-version.mjs --dry-run <версия>   только отчёт, без записи
`);
    process.exit(filtered.length === 0 ? 1 : 0);
  }

  const current = readCurrentVersion();

  if (filtered[0] === "--verify") {
    verifyVersionConsistency(current);
    return;
  }

  if (filtered[0] === "--current") {
    console.log(current);
    return;
  }

  if (filtered[0] === "--suggest") {
    console.log(`Текущая версия: ${current}`);
    console.log(`Идея для следующего релиза: ${suggestNextVersion(current)}`);
    console.log("(Подставьте свой номер при необходимости и запустите без --suggest.)");
    return;
  }

  const newVersion = filtered[0];
  if (!newVersion || newVersion.startsWith("-")) {
    console.error("Укажите новую версию первым аргументом, например: 0.4.4-pre-alpha");
    process.exit(1);
  }

  if (newVersion === current) {
    console.log(`Версия уже ${current}, изменений не требуется.`);
    return;
  }

  const targets = [];
  targets.push(APP_CONFIG, INDEX_HTML);
  for (const ext of [".js", ".mjs"]) {
    for (const f of walkFiles(path.join(REPO_ROOT, "src"), [ext])) {
      targets.push(f);
    }
  }
  for (const f of walkFiles(path.join(REPO_ROOT, "scripts"), [".mjs"])) {
    targets.push(f);
  }

  const unique = [...new Set(targets)];
  let totalReplacements = 0;
  const report = [];

  for (const file of unique) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, "utf8");
    const { next, changed } = applyReplacements(content, current, newVersion);
    if (changed > 0) {
      report.push({ file, changed });
      totalReplacements += changed;
      if (!dryRun) {
        fs.writeFileSync(file, next, "utf8");
      }
    }
  }

  if (report.length === 0) {
    console.warn("Не найдено вхождений для замены. Проверьте app-config.js и импорты ?v=.");
    process.exit(2);
  }

  console.log(dryRun ? "[dry-run] Планируемые изменения:" : "Обновлено:");
  for (const { file, changed } of report) {
    console.log(`  ${path.relative(REPO_ROOT, file)}  (+${changed} замен)`);
  }
  console.log(`\n${current} → ${newVersion}  (всего замен: ${totalReplacements})`);
  if (dryRun) {
    console.log("\nПовторите без --dry-run, чтобы записать файлы.");
  }
}

main();
