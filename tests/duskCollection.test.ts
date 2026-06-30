import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOME_CALL_MAX_GAP,
  canCloseCoopDoor,
  createDuskCollectionState,
  escortBehaviorFor,
  expireHomeCall,
  markChickenInside,
  openCoopDoor,
  placeCoopFeed,
  registerHomeCluck,
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

test('coop ritual requires opening, threshold feed, chicken entry, then closing', () => {
  const state = createDuskCollectionState();
  assert.equal(placeCoopFeed(state), false);
  assert.equal(openCoopDoor(state), true);
  assert.equal(placeCoopFeed(state), true);
  assert.equal(canCloseCoopDoor(state), false);
  assert.equal(markChickenInside(state), true);
  assert.equal(canCloseCoopDoor(state), true);
});

test('affection increases how confidently the chicken accompanies the keeper', () => {
  const wary = escortBehaviorFor(20);
  const bonded = escortBehaviorFor(90);
  assert.ok(bonded.followRange > wary.followRange);
  assert.ok(bonded.speed > wary.speed);
  assert.ok(bonded.homeBias > wary.homeBias);
});
