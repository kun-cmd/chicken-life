import assert from 'node:assert/strict';
import test from 'node:test';
import { EGG_SPOTS } from '../src/game/content/eggSpots';
import {
  advanceNightResult,
  applyFlowEvent,
  collectEgg,
  createGameState,
  finishNightResult,
  restoreGameState,
} from '../src/game/simulation/state';

test('day one has the tutorial egg and schedules one wood', () => {
  const state = createGameState();
  assert.equal(state.eggSearch.spotId, 'coop-straw');
  assert.equal(collectEgg(state), true);
  assert.equal(state.yard.wood, 0);
  assert.equal(state.yard.pendingWood, 1);
});

test('next morning delivers scheduled wood and uses another authored spot', () => {
  const state = createGameState();
  collectEgg(state);
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  applyFlowEvent(state, { type: 'call-human' });
  applyFlowEvent(state, { type: 'chicken-entered-coop' });
  applyFlowEvent(state, { type: 'close-door' });
  finishNightResult(state);
  advanceNightResult(state);

  assert.equal(state.yard.wood, 1);
  assert.equal(state.yard.pendingWood, 0);
  assert.notEqual(state.eggSearch.spotId, 'coop-straw');
  const spot = EGG_SPOTS.find((candidate) => candidate.id === state.eggSearch.spotId);
  assert.deepEqual({ x: state.egg!.x, y: state.egg!.y }, spot!.position);
});

test('restoring an old save migrates materials into yard wood', () => {
  const state = restoreGameState({ materials: 7 });
  assert.equal(state.yard.wood, 7);
});
