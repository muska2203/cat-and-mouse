export function findNearestEnemy(run) {
  const enemies = run.objects.filter((object) => object.type === "enemy");
  if (enemies.length === 0) {
    return null;
  }

  let best = enemies[0];
  let bestDistance = Math.abs(best.x - run.player.x) + Math.abs(best.y - run.player.y);
  for (const enemy of enemies.slice(1)) {
    const distance = Math.abs(enemy.x - run.player.x) + Math.abs(enemy.y - run.player.y);
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

export function getEnemyById(run, enemyId) {
  return run.objects.find((object) => object.id === enemyId && object.type === "enemy") || null;
}
