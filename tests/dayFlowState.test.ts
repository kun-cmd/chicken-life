import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFlowEvent,
  buildHudSnapshot,
  createGameState,
  restoreGameState,
} from '../src/game/simulation/state';

test('game state derives actor and labels from day flow', () => {
  const state = createGameState();
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.mode, 'human');
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  assert.equal(state.mode, 'chicken');
  assert.equal(buildHudSnapshot(state, false).phaseLabel, '白天');
});

test('dusk and night prompts lean on environmental cues instead of escort chores', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  state.chicken = { x: 700, y: 700 };

  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  const duskPrompt = buildHudSnapshot(state, false).contextPrompt;
  assert.match(duskPrompt, /暖光/);
  assert.match(duskPrompt, /声响/);
  assert.doesNotMatch(duskPrompt, /撒瓜子|赶鸡|开门|关门/);

  applyFlowEvent(state, { type: 'tick', amount: 0.2 });
  const nightPrompt = buildHudSnapshot(state, false).contextPrompt;
  assert.match(nightPrompt, /暖光/);
  assert.doesNotMatch(nightPrompt, /撒瓜子|赶鸡|开门|关门/);
});

test('restores a pre-flow v3 save at the same day in morning human mode', () => {
  const state = restoreGameState({
    day: 3,
    phase: 'day',
    mode: 'chicken',
    time: 0.42,
    egg: null,
  });
  assert.equal(state.flow.day, 3);
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.day, 3);
  assert.equal(state.mode, 'human');
  assert.ok(state.egg);
});
