import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LURE_SEED_DROP_INTERVAL,
  LURE_SEED_EAT_PAUSE,
  HOME_CALL_MAX_GAP,
  advanceDuskCollection,
  canCloseCoopDoor,
  createDuskCollectionState,
  eatLureSeed,
  expireHomeCall,
  findLureSeedTarget,
  markChickenInside,
  openCoopDoor,
  placeLureSeed,
  registerHomeCluck,
  visionRadiusFor,
} from '../src/game/systems/duskCollection';

test('the second continuous cluck gets an answer and the fifth opens the house door', () => {
  const state = createDuskCollectionState();
  assert.equal(registerHomeCluck(state.homeCall, 0), 'cluck');
  assert.equal(registerHomeCluck(state.homeCall, 0.7), 'heard');
  assert.equal(registerHomeCluck(state.homeCall, 1.4), 'cluck');
  assert.equal(registerHomeCluck(state.homeCall, 2.1), 'cluck');
  assert.equal(registerHomeCluck(state.homeCall, 2.8), 'door-open');
});

test('a long pause resets the unspoken home request', () => {
  const state = createDuskCollectionState();
  registerHomeCluck(state.homeCall, 0);
  registerHomeCluck(state.homeCall, 0.7);
  assert.equal(expireHomeCall(state.homeCall, HOME_CALL_MAX_GAP + 0.8), 'reset');
  assert.equal(state.homeCall.count, 0);
  assert.equal(registerHomeCluck(state.homeCall, 4), 'cluck');
});

test('lure seeds can be dropped only once every 0.7 seconds', () => {
  const state = createDuskCollectionState();
  assert.ok(placeLureSeed(state, { x: 10, y: 20 }));
  assert.equal(state.scatterCooldown, LURE_SEED_DROP_INTERVAL);
  assert.equal(placeLureSeed(state, { x: 20, y: 20 }), null);
  advanceDuskCollection(state, 0.69);
  assert.equal(placeLureSeed(state, { x: 20, y: 20 }), null);
  advanceDuskCollection(state, 0.02);
  assert.ok(placeLureSeed(state, { x: 20, y: 20 }));
});

test('affection expands the visible seed radius', () => {
  assert.equal(visionRadiusFor(20), 120);
  assert.equal(visionRadiusFor(90), 330);
});

test('the chicken notices only a visible seed and pauses one second after eating it', () => {
  const state = createDuskCollectionState();
  const seed = placeLureSeed(state, { x: 150, y: 0 })!;
  assert.equal(findLureSeedTarget(state, { x: 0, y: 0 }, visionRadiusFor(20)), null);
  assert.equal(findLureSeedTarget(state, { x: 0, y: 0 }, visionRadiusFor(90)), seed);
  assert.equal(eatLureSeed(state, seed.id), true);
  assert.equal(state.eatPause, LURE_SEED_EAT_PAUSE);
  advanceDuskCollection(state, 0.99);
  assert.ok(state.eatPause > 0);
  advanceDuskCollection(state, 0.02);
  assert.equal(state.eatPause, 0);
});

test('coop ritual requires a door seed, opening, chicken entry, then closing', () => {
  const state = createDuskCollectionState();
  assert.equal(openCoopDoor(state), false);
  placeLureSeed(state, { x: 10, y: 20 }, true);
  assert.equal(openCoopDoor(state), true);
  assert.equal(canCloseCoopDoor(state), false);
  assert.equal(markChickenInside(state), true);
  assert.equal(canCloseCoopDoor(state), true);
});
