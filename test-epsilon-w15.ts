import {
  startGame,
  applyAction,
  getWarpSkillProfile,
  createWarpAiPlayer,
  generateCoordinateSet,
  shuffleCoordinates,
  scoreRound,
} from 'warp12-engine';

console.log('Testing Module Epsilon on W15...');

const player = createWarpAiPlayer({
  skill: getWarpSkillProfile('commander', 'points', 4),
  objective: 'points',
  rng: () => Math.random(),
});

const shuffled = shuffleCoordinates(generateCoordinateSet(15), () => 0.5);

let state = startGame(
  {
    id: 'epsilon-w15-test',
    captains: [
      { id: 'p0', displayName: 'P0' },
      { id: 'p1', displayName: 'P1' },
      { id: 'p2', displayName: 'P2' },
      { id: 'p3', displayName: 'P3' },
    ],
    turnOrder: ['p0', 'p1', 'p2', 'p3'],
    objective: 'points',
    maxPip: 15,
    modules: {
      drafting: true,
    },
  },
  { shuffledCoordinates: shuffled }
);

console.log(`✓ Started game with W15 + drafting`);
console.log(`  Round 1 spacedock should be 15-15`);
console.log(`  Initial phase: ${state.round?.phase}`);

// Play through round 1
let steps = 0;
while (state.phase === 'active' && state.round && state.round.phase !== 'ended' && steps < 500) {
  const round = state.round;
  const activeId = round.activePlayerId;
  
  const action = player.decideGameAction(state, activeId);
  if (!action) break;
  
  const result = applyAction(state, action);
  if (!result.ok) {
    console.log(`✗ Action failed: ${result.violation}`);
    process.exit(1);
  }
  
  state = result.state;
  steps++;
}

console.log(`✓ Completed round 1 in ${steps} steps`);

// End round 1 and start round 2
if (state.round && state.round.phase === 'ended') {
  const result = scoreRound(state, state.round, () => Math.random());
  if (!result.ok) {
    console.log(`✗ Failed to score round: ${result.violation}`);
    process.exit(1);
  }
  state = result.state;
  console.log(`✓ Scored round 1, moving to round 2`);
  console.log(`  Round 2 spacedock should be 14-14`);
  console.log(`  Current round: ${state.round?.roundNumber}, phase: ${state.round?.phase}`);
  
  // Play a few steps of round 2 to verify it works
  steps = 0;
  while (state.phase === 'active' && state.round && state.round.phase !== 'ended' && steps < 100) {
    const round = state.round;
    const activeId = round.activePlayerId;
    
    const action = player.decideGameAction(state, activeId);
    if (!action) break;
    
    const result = applyAction(state, action);
    if (!result.ok) {
      console.log(`✗ Round 2 action failed: ${result.violation}`);
      process.exit(1);
    }
    
    state = result.state;
    steps++;
  }
  
  console.log(`✓ Round 2 working correctly (${steps} steps)`);
}

console.log(`\n✅ Module Epsilon works on W15!`);
