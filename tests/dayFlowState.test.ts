import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFlowEvent,
  buildHudSnapshot,
  createGameState,
} from '../src/game/simulation/state';

test('game state derives actor and labels from day flow', () => {
  const state = createGameState();
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.mode, 'human');
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'release-chicken' });
  assert.equal(state.mode, 'chicken');
  assert.equal(buildHudSnapshot(state, false).phaseLabel, '白天');
});
