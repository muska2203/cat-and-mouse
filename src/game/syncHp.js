import { floorHp } from "../rules.js?v=0.5.5-pre-alpha";

export function syncPlayerHp(playerSheet, hpValue) {
  const h = floorHp(hpValue);
  playerSheet.stats.HP = h;
  playerSheet.baseStats.HP = h;
}
