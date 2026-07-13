import { startGame, applyAction, getWarpSkillProfile, createWarpAiPlayer, generateCoordinateSet, shuffleCoordinates } from 'warp12-engine';

const player = createWarpAiPlayer({
  skill: getWarpSkillProfile('commander', 'points', 4),
  objective: 'points',
  rng: () => Math.random(),
});

const shuffled = shuffleCoordinates(generateCoordinateSet(12), () => 0.5);

let state = startGame(
  {
    captains: [
      { id: 'p0', displayName: 'P0' },
      { id: 'p1', displayName: 'P1' },
      { id: 'p2', displayName: 'P2' },
      { id: 'p3', displayName: 'P3' },
    ],
    turnOrder: ['p0', 'p1', 'p2', 'p3'],
    objective: 'points',
    maxPip: 12,
    modules: {
      drafting: true,
    },
  },
  { shuffledCoordinates: shuffled }
);

console.log(`Initial phase: ${state.round?.phase}`);
console.log(`Draft state exists: ${!!state.round?.draftState}`);
console.log(`Active player: ${state.round?.activePlayerId}`);

let steps = 0;
while (state.phase === 'active' && state.round && steps < 100) {
  const round = state.round;
  if (round.phase === 'ended') break;
  
  const activeId = round.activePlayerId;
  if (steps < 10 || steps % 10 === 0) {
    console.log(`Step ${steps}: phase=${round.phase}, active=${activeId}`);
  }
  
  const action = player.decideGameAction(state, activeId);
  if (!action) {
    console.log('No action returned');
    break;
  }
  
  if (steps < 10) {
    console.log(`  Action: ${action.type}`);
  }
  
  const result = applyAction(state, action);
  if (!result.ok) {
    console.log(`  FAILED: ${result.violation}`);
    break;
  }
  
  state = result.state;
  steps++;
}

console.log(`\nStopped after ${steps} steps`);
console.log(`Final phase: ${state.round?.phase}`);
console.log(`Final round: ${state.round?.roundNumber}`);
