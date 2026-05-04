/**
 * Запуск бесконечного цикла requestAnimationFrame.
 * @param {(nowMs: number) => void} callback
 */
export function startAnimationLoop(callback) {
  function frame(nowMs) {
    callback(nowMs);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
