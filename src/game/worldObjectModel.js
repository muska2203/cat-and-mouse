/**
 * Единая модель игровых объектов на поле.
 * Здесь храним JSDoc-контракт и фабрику с безопасными дефолтами.
 */

/**
 * @typedef {Object} WorldObjectActivation
 * @property {string[]} by
 * @property {string|null} effect
 */

/**
 * @typedef {Object} WorldObjectTurnTick
 * @property {string} effect
 */

/**
 * @typedef {Object} WorldObject
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} type
 * @property {string} purpose
 * @property {string} icon
 * @property {boolean} oneTime
 * @property {boolean} blocksMovement
 * @property {boolean} blocksEnemyMovement
 * @property {boolean} activateOnPathPass
 * @property {WorldObjectActivation} activation
 * @property {WorldObjectTurnTick|null} turnTick
 * @property {number} x
 * @property {number} y
 * @property {Object<string, any>} data
 */

/**
 * @param {Partial<WorldObjectActivation>|null|undefined} activation
 * @returns {WorldObjectActivation}
 */
function normalizeActivation(activation) {
  return {
    by: Array.isArray(activation?.by) ? [...activation.by] : [],
    effect: activation?.effect ? String(activation.effect) : null,
  };
}

/**
 * @param {Partial<WorldObjectTurnTick>|null|undefined} turnTick
 * @returns {WorldObjectTurnTick|null}
 */
function normalizeTurnTick(turnTick) {
  if (!turnTick?.effect) return null;
  return { effect: String(turnTick.effect) };
}

/**
 * @param {Partial<WorldObject>} raw
 * @returns {WorldObject}
 */
export function createWorldObject(raw) {
  const baseType = String(raw?.type || "object");
  return {
    id: String(raw?.id || ""),
    name: String(raw?.name || "Объект"),
    description: String(raw?.description || ""),
    type: baseType,
    purpose: String(raw?.purpose || baseType),
    icon: String(raw?.icon || "•"),
    oneTime: Boolean(raw?.oneTime),
    blocksMovement: raw?.blocksMovement !== false,
    blocksEnemyMovement: raw?.blocksEnemyMovement === true,
    activateOnPathPass: raw?.activateOnPathPass === true,
    activation: normalizeActivation(raw?.activation),
    turnTick: normalizeTurnTick(raw?.turnTick),
    x: Number(raw?.x || 0),
    y: Number(raw?.y || 0),
    data: raw?.data && typeof raw.data === "object" ? { ...raw.data } : {},
  };
}
