import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceNightResult,
  applyFlowEvent,
  createGameState,
  debugJumpToDusk,
  debugSetDay,
  finishChickenNight,
  dryRainSoakedChicken,
  finishChickenRun,
} from '../src/game/simulation/state';

test('dusk keeps control on the chicken', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  state.chicken = { x: 300, y: 600 };
  assert.deepEqual(state.chicken, { x: 300, y: 600 });
  assert.equal(state.mode, 'chicken');
});

test('night result creates tomorrow egg before returning to morning human control', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  finishChickenNight(state);
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
  applyFlowEvent(state, { type: 'return-home' });
  assert.equal(debugJumpToDusk(state), true);
  assert.equal(state.flow.phase, 'chicken-dusk');
});

test('legacy chicken run ending settles without entering dusk human escort', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });

  assert.equal(finishChickenRun(state, false), true);
  assert.equal(state.flow.phase, 'night-result');
  assert.equal(state.mode, 'chicken');
  assert.equal(state.flow.chickenInCoop, true);
});

test('debug day adjustment starts the selected morning with matching story gates', () => {
  const state = createGameState();
  assert.equal(debugSetDay(state, 14), 14);
  assert.equal(state.day, 14);
  assert.equal(state.flow.day, 14);
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.mode, 'human');
  assert.equal(state.egg?.found, false);
  assert.equal(state.profile.awakenedAbilities.scratch, true);
  assert.equal(state.profile.awakenedAbilities.sprint, true);
  assert.equal(state.profile.awakenedAbilities.flutter, true);
  assert.equal(state.endingSeen, false);
  assert.equal(state.freePlay, false);
});

test('rain night without coop-roof leaves chicken wet next morning', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  state.weather = 'rain';
  state.yard.owned = [];
  finishChickenNight(state);
  assert.equal(state.dryRestTonight, false);
  const tomorrowEgg = state.egg;
  advanceNightResult(state);
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.day, 2);
  assert.equal(state.chickenWetFromRain, true);
  assert.equal(state.egg, tomorrowEgg);
});

test('rain night with coop-roof keeps chicken dry next morning', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  state.weather = 'rain';
  state.yard.owned = ['coop-roof'];
  finishChickenNight(state);
  assert.equal(state.dryRestTonight, true);
  advanceNightResult(state);
  assert.equal(state.chickenWetFromRain, false);
});

test('clear night does not make chicken wet', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  state.weather = 'sunny';
  state.yard.owned = [];
  finishChickenNight(state);
  assert.equal(state.dryRestTonight, true);
  advanceNightResult(state);
  assert.equal(state.chickenWetFromRain, false);
});

test('dryRainSoakedChicken succeeds in morning-human when wet and clears state', () => {
  const state = createGameState();
  state.chickenWetFromRain = true;
  const beforeAffection = state.affection;
  const result = dryRainSoakedChicken(state);
  assert.equal(result, true);
  assert.equal(state.chickenWetFromRain, false);
  assert.ok(state.affection > beforeAffection);
  assert.ok(state.message.includes('干爽'));
});

test('dryRainSoakedChicken fails when chicken is not wet', () => {
  const state = createGameState();
  state.chickenWetFromRain = false;
  const result = dryRainSoakedChicken(state);
  assert.equal(result, false);
});

test('dryRainSoakedChicken fails in non-morning phase', () => {
  const state = createGameState();
  state.chickenWetFromRain = true;
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  const result = dryRainSoakedChicken(state);
  assert.equal(result, false);
  assert.equal(state.chickenWetFromRain, true);
});
