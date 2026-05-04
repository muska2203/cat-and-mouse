import { generateMazeRun } from "./maze.js?v=0.4.4-pre-alpha";
import { buildPathToCell as buildPathToCellNav } from "./nav/pathfinding.js?v=0.4.4-pre-alpha";
import { planStartAndGoalSpawn } from "./game/levelSpawn.js?v=0.4.4-pre-alpha";
import { generateObjects } from "./game/generateObjects.js?v=0.4.4-pre-alpha";
import { defaultCellBlocked } from "./game/cellBlocking.js?v=0.4.4-pre-alpha";
import { revealAroundPlayer } from "./game/fogReveal.js?v=0.4.4-pre-alpha";

function createMask(width, height, value = false) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => value));
}

export function buildPathToCell(run, start, target, options = {}) {
  const blockCell = options.isCellBlocked || ((x, y) => defaultCellBlocked(run, x, y, options));
  return buildPathToCellNav(run, start, target, blockCell);
}

export function buildPathToDiscoveredCell(run, start, target, options = {}) {
  const blockCell = (x, y) => {
    if (!run?.discovered?.[y]?.[x]) {
      return true;
    }
    if (options.isCellBlocked) {
      return options.isCellBlocked(x, y);
    }
    return defaultCellBlocked(run, x, y, options);
  };
  return buildPathToCellNav(run, start, target, blockCell);
}

export function createRunState(playerSheet, level = 1) {
  const maze = generateMazeRun();
  const spawnPlan = planStartAndGoalSpawn(maze);
  const mazeWithSpawn = {
    ...maze,
    start: { x: spawnPlan.start.x, y: spawnPlan.start.y },
    goal: { x: spawnPlan.goal.x, y: spawnPlan.goal.y },
  };
  const run = {
    ...mazeWithSpawn,
    player: { x: mazeWithSpawn.start.x, y: mazeWithSpawn.start.y },
    level,
    maxLevel: 10,
    turns: 0,
    status: "running",
    objects: generateObjects(mazeWithSpawn, level, { blockedSpawnKeys: spawnPlan.blockedSpawnKeys }),
    lastLog: level === 1 ? "Забег начался." : `Уровень ${level} начался.`,
    nextHitMultiplier: 1,
    visionRange: playerSheet?.stats?.VISION ?? 6,
    discovered: createMask(mazeWithSpawn.width, mazeWithSpawn.height, false),
    motion: null,
    floatingTexts: [],
    screenShake: null,
    overTimeEffects: [],
    turnPhase: "player",
    environmentActionQueue: [],
    environmentMotion: null,
    environmentNextStepAtMs: 0,
    playerStatus: {
      stunTurns: 0,
    },
  };
  revealAroundPlayer(run, run.visionRange);
  return run;
}

export function createNextLevelRun(previousRun, playerSheet) {
  const nextLevel = (previousRun?.level || 1) + 1;
  const nextRun = createRunState(playerSheet, nextLevel);
  nextRun.nextHitMultiplier = Math.max(1, previousRun?.nextHitMultiplier || 1);
  if (Array.isArray(previousRun?.overTimeEffects) && previousRun.overTimeEffects.length > 0) {
    nextRun.overTimeEffects = previousRun.overTimeEffects.map((effect) => ({ ...effect }));
  }
  if (previousRun?.playerStatus) {
    nextRun.playerStatus = {
      stunTurns: Math.max(0, previousRun.playerStatus.stunTurns || 0),
    };
  }
  return nextRun;
}

export { useSkill, getSkillTargetCells, useSkillAtCell } from "./game/runSkills.js?v=0.4.4-pre-alpha";
export { tryStep } from "./game/playerStep.js?v=0.4.4-pre-alpha";
export { beginEnvironmentTurn, stepEnvironmentTurn } from "./game/environmentTurn.js?v=0.4.4-pre-alpha";
