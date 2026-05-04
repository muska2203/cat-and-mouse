/** Кто на клетке и кто блокирует ход для игрока / врага. */

export const ACTOR_KIND = {
  PLAYER: "player",
  ENEMY: "enemy",
};

export function isObjectBlockingForActor(object, actorKind) {
  if (!object) {
    return false;
  }
  if (actorKind === ACTOR_KIND.ENEMY) {
    if (object.type === "enemy") {
      return true;
    }
    return object.blocksEnemyMovement === true;
  }
  if (actorKind === ACTOR_KIND.PLAYER) {
    if (object.type === "enemy") {
      return true;
    }
    return object.blocksMovement !== false;
  }
  return object.blocksMovement !== false;
}

export function getObjectsAt(run, x, y) {
  return (run.objects || []).filter((object) => object.x === x && object.y === y);
}

export function getObjectAt(run, x, y) {
  return getObjectsAt(run, x, y)[0] || null;
}

export function getBlockingObjectAt(run, x, y, actorKind, ignoreObjectId = null) {
  const objects = getObjectsAt(run, x, y);
  if (actorKind === ACTOR_KIND.PLAYER) {
    const enemyFirst = objects.find((object) => {
      if (ignoreObjectId && object.id === ignoreObjectId) return false;
      return object.type === "enemy";
    });
    if (enemyFirst) {
      return enemyFirst;
    }
  }
  return objects.find((object) => {
    if (ignoreObjectId && object.id === ignoreObjectId) return false;
    return isObjectBlockingForActor(object, actorKind);
  }) || null;
}

export function canObjectBeActivatedBy(object, actorKind) {
  const allowed = object?.activation?.by;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return false;
  }
  return allowed.includes(actorKind) || allowed.includes("any");
}

export function removeObject(run, objectId) {
  run.objects = run.objects.filter((object) => object.id !== objectId);
}
