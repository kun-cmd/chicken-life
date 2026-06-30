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

test('moves from chicken day into dusk and hands control to the human', () => {
  let state = transition(createDayFlow(), 'egg-found');
  state = transition(state, 'return-home');
  state = reduceDayFlow(state, { type: 'tick', amount: 0.7 });
  assert.equal(state.phase, 'chicken-dusk');
  state = transition(state, 'call-human');
  assert.equal(state.phase, 'dusk-human');
});

test('only closes the night after the chicken is inside', () => {
  let state = createDayFlow({
    phase: 'dusk-human',
    chickenInCoop: false,
    coopDoorClosed: false,
  });
  assert.throws(() => transition(state, 'close-door'), /inside/i);
  state = transition(state, 'chicken-entered-coop');
  state = transition(state, 'close-door');
  assert.equal(state.phase, 'night-result');
  assert.equal(state.coopDoorClosed, true);
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
