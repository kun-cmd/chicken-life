import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceEggSearch,
  collectCurrentEgg,
  createEggSearchState,
} from '../src/game/systems/eggSearch';
import { collectEgg, createGameState } from '../src/game/simulation/state';

test('raises clue level at sixty and one hundred twenty seconds', () => {
  let state = createEggSearchState('coop-straw');
  state = advanceEggSearch(state, 59);
  assert.equal(state.clueLevel, 0);
  state = advanceEggSearch(state, 1);
  assert.equal(state.clueLevel, 1);
  state = advanceEggSearch(state, 60);
  assert.equal(state.clueLevel, 2);
});

test('collects the current hidden egg only once', () => {
  const state = createEggSearchState('coop-straw');
  assert.equal(collectCurrentEgg(state), true);
  assert.equal(collectCurrentEgg(state), false);
});

test('the existing egg album records one entry and ignores duplicate collection', () => {
  const state = createGameState();
  const eggType = state.egg!.type;
  collectEgg(state);
  collectEgg(state);
  assert.deepEqual(
    state.eggArchive.map(({ type, count }) => ({ type, count })),
    [{ type: eggType, count: 1 }],
  );
});
