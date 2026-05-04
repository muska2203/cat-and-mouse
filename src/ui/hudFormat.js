export function formatHudStatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return String(value);
  }
  return Number(value.toFixed(2));
}
