import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDayFlow,
  reduceDayFlow,
  type DayFlowEvent,
  type DayFlowState,
} from '../src/game/systems/dayFlow';

type InstantEvent = Exclude<DayFlowEvent, { type: 'tick' }>;

function transition(state: DayFlowState, type: InstantEvent['type']) {
  return reduceDayFlow(state, { type } as InstantEvent);
}

test('requires the morning egg before returning home to start chicken day', () => {
  const state = createDayFlow();
  assert.throws(() => transition(state, 'return-home'), /morning egg/i);
  const found = transition(state, 'egg-found');
  const returned = transition(found, 'return-home');
  assert.equal(returned.phase, 'chicken-day');
  assert.equal(returned.chickenInCoop, false);
});

test('moves from chicken day through dusk into a chicken-controlled night', () => {
  let state = transition(createDayFlow(), 'egg-found');
  state = transition(state, 'return-home');
  state = reduceDayFlow(state, { type: 'tick', amount: 0.6 });
  assert.equal(state.phase, 'chicken-dusk');
  state = reduceDayFlow(state, { type: 'tick', amount: 0.2 });
  assert.equal(state.phase, 'chicken-night');
});

test('lets the chicken settle from dusk or night without switching actor', () => {
  let state = createDayFlow({ phase: 'chicken-night', clock: 0.9 });
  state = transition(state, 'settle-for-night');
  assert.equal(state.phase, 'night-result');
  assert.equal(state.chickenInCoop, true);
  assert.equal(state.coopDoorClosed, true);
});

test('keeps legacy human call from starting a dusk escort chore', () => {
  let state = createDayFlow({ phase: 'chicken-dusk', clock: 0.7 });
  state = transition(state, 'call-human');
  assert.equal(state.phase, 'chicken-dusk');
  assert.equal(state.chickenInCoop, false);
  assert.equal(state.coopDoorClosed, false);
});

test('starts the next morning with a closed coop and a new egg requirement', () => {
  const state = createDayFlow({
    day: 3,
    phase: 'night-result',
    morningEggFound: true,
    chickenInCoop: true,
    coopDoorClosed: true,
  });
  const morning = transition(state, 'next-morning');
  assert.deepEqual(morning, {
    day: 4,
    phase: 'morning-human',
    clock: 0.08,
    morningEggFound: false,
    chickenInCoop: false,
    coopDoorClosed: false,
  });
});
