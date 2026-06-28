import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceNightResult,
  applyFlowEvent,
  createGameState,
  debugJumpToDusk,
  finishNightResult,
} from '../src/game/simulation/state';

test('dusk call preserves chicken position for human collection', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'release-chicken' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  state.chicken = { x: 300, y: 600 };
  applyFlowEvent(state, { type: 'call-human' });
  assert.deepEqual(state.chicken, { x: 300, y: 600 });
  assert.equal(state.mode, 'human');
});

test('night result creates tomorrow egg before returning to morning human control', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'release-chicken' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  applyFlowEvent(state, { type: 'call-human' });
  applyFlowEvent(state, { type: 'chicken-entered-coop' });
  applyFlowEvent(state, { type: 'close-door' });

  finishNightResult(state);
  const tomorrowEgg = state.egg;
  assert.ok(tomorrowEgg);
  assert.equal(state.flow.phase, 'night-result');

  advanceNightResult(state);
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.mode, 'human');
  assert.equal(state.day, 2);
  assert.equal(state.egg, tomorrowEgg);
});

test('debug dusk jump advances the authoritative flow', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'release-chicken' });
  assert.equal(debugJumpToDusk(state), true);
  assert.equal(state.flow.phase, 'chicken-dusk');
});
