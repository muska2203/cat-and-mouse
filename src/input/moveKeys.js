/** Клавиши / раскладки → направление шага (совпадает с delta-ключами в tryStep). */

export const MOVE_KEY_MAP = {
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right",
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
  w: "up",
  W: "up",
  a: "left",
  A: "left",
  s: "down",
  S: "down",
  d: "right",
  D: "right",
  ц: "up",
  Ц: "up",
  ф: "left",
  Ф: "left",
  ы: "down",
  Ы: "down",
  в: "right",
  В: "right",
  KeyQ: "up_left",
  KeyE: "up_right",
  KeyZ: "down_left",
  KeyC: "down_right",
  q: "up_left",
  Q: "up_left",
  e: "up_right",
  E: "up_right",
  z: "down_left",
  Z: "down_left",
  c: "down_right",
  C: "down_right",
};

export function resolveMoveDirectionFromEvent(event) {
  return MOVE_KEY_MAP[event.code] || MOVE_KEY_MAP[event.key] || null;
}
