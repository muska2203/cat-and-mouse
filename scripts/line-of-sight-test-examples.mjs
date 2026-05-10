/**
 * Локальная проверка видимости (`src/nav/lineOfSightPermissive.js`).
 *
 * Алгоритм: пермиссивный LOS по отрезку внутри клеток + обход Amanatides–Woo.
 * Для проходимых клеток видимость симметрична (A→B то же, что B→A).
 *
 * Запуск из корня репозитория:
 *   node scripts/line-of-sight-test-examples.mjs
 */

import {
  hasLineOfSightOnGrid,
  hasStrictLineOfSightOnGrid,
} from "../src/nav/lineOfSightPermissive.js";

/** Строки одинаковой длины; [y][x]: '#' → 1, иначе 0 */
export function gridFromAscii(rows) {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const grid = [];
  for (let y = 0; y < h; y += 1) {
    const line = rows[y];
    if (line.length !== w) {
      throw new Error(`Строка ${y}: ожидалась длина ${w}, получено ${line.length}`);
    }
    const row = [];
    for (let x = 0; x < w; x += 1) {
      row.push(line[x] === "#" ? 1 : 0);
    }
    grid.push(row);
  }
  return grid;
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  ожидалось: ${expected}\n  получено: ${actual}`);
  }
}

/**
 * @param {number[][]} grid
 * @param {[number, number]} from - [x,y] наблюдатель
 * @param {[number, number]} to - [x,y] цель
 * @param {boolean} expected - ожидание для hasLineOfSightOnGrid
 * @param {string} name - подпись к кейсу
 */
export function testLos(grid, from, to, expected, name) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const got = hasLineOfSightOnGrid(grid, fx, fy, tx, ty);
  assertEqual(got, expected, `[LOS] ${name}: (${fx},${fy}) → (${tx},${ty})`);
}

/** Строгий центр→центр (один луч). */
export function testStrictLos(grid, from, to, expected, name) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const got = hasStrictLineOfSightOnGrid(grid, fx, fy, tx, ty);
  assertEqual(got, expected, `[strict] ${name}: (${fx},${fy}) → (${tx},${ty})`);
}

function runBlock(title, fn) {
  try {
    fn();
    console.log(`OK  ${title}`);
  } catch (e) {
    console.error(`FAIL ${title}`);
    console.error(e.message || e);
    process.exitCode = 1;
  }
}

runBlock("та же клетка всегда видна", () => {
  const g = gridFromAscii([
    "###",
    "#.#",
    "###",
  ]);
  testLos(g, [1, 1], [1, 1], true, "same cell");
});

runBlock("сплошная стена между соседними клетками по горизонтали", () => {
  const g = gridFromAscii([
    "#####",
    "#.#.#",
    "#####",
  ]);
  testStrictLos(g, [1, 1], [3, 1], false, "строго центр→центр через стену");
  testLos(g, [1, 1], [3, 1], false, "пермиссив: один проход «вровень», верх/низ закрыты");
});

runBlock("симметрия выглядывания по коридору", () => {
  const g = gridFromAscii([
    "#######",
    "#.#...#",
    "#.....#",
    "#.....#",
    "#######",
  ]);
  const A = [1, 1];
  const B = [5, 3];
  testLos(g, A, B, true, "A→B");
  testLos(g, B, A, true, "B→A");
});

runBlock("диагональный контакт симметричен", () => {
  const g = gridFromAscii([
    "#####",
    "#.#.#",
    "#...#",
    "#####",
  ]);
  testLos(g, [1, 1], [3, 2], true, "(1,1)→(3,2)");
  testLos(g, [3, 2], [1, 1], true, "(3,2)→(1,1)");
});

runBlock("открытый зал: противоположные углы", () => {
  const g = gridFromAscii([
    "...",
    "...",
    "...",
  ]);
  testLos(g, [0, 0], [2, 2], true, "углы");
  testStrictLos(g, [0, 0], [2, 2], true, "строго по центрам тоже");
});

runBlock("стена как видимая клетка (туман и объекты на стене)", () => {
  const g = gridFromAscii([
    "##",
    ".#",
  ]);
  testLos(g, [0, 1], [1, 1], true, "пол→стена соседняя");
  testStrictLos(g, [0, 1], [1, 1], true, "строго центр→центр на стену");
  testLos(g, [1, 1], [0, 1], false, "стена не может быть наблюдателем");
});

console.log(process.exitCode ? "\nЕсть падения." : "\nВсе заготовленные примеры прошли.");
