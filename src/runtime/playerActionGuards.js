export function canAcceptPlayerAction(state) {
  if (!state) return false;
  return Boolean(
    state.screen === "game"
    && state.run
    && state.playerSheet
    && state.run.status === "running"
    && state.run.turnPhase === "player"
  );
}

export function canStartEnvironmentTurn(run) {
  return Boolean(run && run.status === "running" && run.turnPhase === "player");
}
