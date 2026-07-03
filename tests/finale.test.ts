import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureFinaleCheckpoint,
  restoreFinaleCheckpoint,
  shouldStartFinale,
} from '../src/game/systems/finale';
import {
  activeActor,
  createDayFlow,
  reduceDayFlow,
} from '../src/game/systems/dayFlow';
import {
  applyFlowEvent,
  buildHudSnapshot,
  collectKeepsakeEgg,
  continueFreePlay,
  createGameState,
  restoreFinaleState,
  startEpilogueMorning,
} from '../src/game/simulation/state';

test('only day fourteen starts the first-run finale', () => {
  assert.equal(shouldStartFinale(13, false), false);
  assert.equal(shouldStartFinale(14, false), true);
  assert.equal(shouldStartFinale(14, true), false);
});

test('checkpoint restore returns an independent clone without recursive checkpoint data', () => {
  const original = {
    day: 14,
    chicken: { x: 10, y: 20 },
    caughtToday: false,
    finaleCheckpointJson: 'old',
  };
  const checkpoint = captureFinaleCheckpoint(original);
  original.chicken.x = 99;
  const restored = restoreFinaleCheckpoint<typeof original>(checkpoint);
  assert.deepEqual(restored, {
    day: 14,
    chicken: { x: 10, y: 20 },
    caughtToday: false,
    finaleCheckpointJson: null,
  });
});

test('epilogue and free play use the normal day loop states', () => {
  let flow = createDayFlow({ day: 14, phase: 'night-result' });
  flow = reduceDayFlow(flow, { type: 'start-epilogue' });
  assert.equal(flow.day, 15);
  assert.equal(flow.phase, 'epilogue-human');
  assert.equal(activeActor(flow.phase), 'human');

  flow = reduceDayFlow(flow, { type: 'keepsake-found' });
  assert.equal(flow.phase, 'ending');

  flow = reduceDayFlow(flow, { type: 'continue-free-play' });
  assert.equal(flow.phase, 'morning-human');
  assert.equal(flow.morningEggFound, true);
  assert.equal(flow.day, 15);
});

test('entering day fourteen dusk captures a reusable checkpoint', () => {
  const state = createGameState();
  state.day = 14;
  state.flow = createDayFlow({
    day: 14,
    phase: 'chicken-day',
    clock: 0.64,
    morningEggFound: true,
  });
  state.mode = 'chicken';
  applyFlowEvent(state, { type: 'tick', amount: 0.02 });

  assert.equal(state.flow.phase, 'chicken-dusk');
  assert.equal(state.stormActive, true);
  assert.ok(state.finaleCheckpointJson);

  const checkpoint = state.finaleCheckpointJson!;
  const restored = restoreFinaleState(checkpoint);
  assert.equal(restored.flow.phase, 'chicken-dusk');
  assert.equal(restored.stormActive, true);
  assert.equal(restored.finaleCheckpointJson, checkpoint);
});

test('final safe close starts the keepsake morning and preserves pending wood', () => {
  const state = createGameState();
  state.day = 14;
  state.flow = createDayFlow({
    day: 14,
    phase: 'night-result',
    chickenInCoop: true,
    coopDoorClosed: true,
  });
  state.yard.wood = 0;
  state.yard.pendingWood = 1;

  startEpilogueMorning(state);

  assert.equal(state.day, 15);
  assert.equal(state.flow.phase, 'epilogue-human');
  assert.equal(state.mode, 'human');
  assert.equal(state.yard.wood, 1);
  assert.equal(state.yard.pendingWood, 0);
  assert.equal(state.eggSearch.spotId, 'far-hedge');
  assert.equal(state.egg?.name, '温热的纪念蛋');

  assert.equal(collectKeepsakeEgg(state), true);
  assert.equal(state.flow.phase, 'ending');
  assert.equal(state.endingSeen, true);
  assert.equal(buildHudSnapshot(state, false).endingMemories.length, 6);

  assert.equal(continueFreePlay(state), true);
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.freePlay, true);
  assert.equal(state.flow.morningEggFound, true);
});
