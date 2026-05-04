/** Коды клавиш → индекс быстрого слота 0..8 (`state.uiHud.quickbarSlots`). */

const QUICKBAR_SLOT_BY_CODE = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Digit7: 6,
  Digit8: 7,
  Digit9: 8,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
  Numpad7: 6,
  Numpad8: 7,
  Numpad9: 8,
};

export function resolveQuickbarSlotIndexFromKeyboardEvent(event) {
  if (!event?.code) {
    return null;
  }
  const slot = QUICKBAR_SLOT_BY_CODE[event.code];
  return slot == null ? null : slot;
}
