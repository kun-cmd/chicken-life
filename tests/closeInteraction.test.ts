import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTasteProfile,
  resolveFoodOffer,
  touchOptionsFor,
} from '../src/game/systems/closeInteraction';

test('creates stable taste preferences from the run seed', () => {
  assert.deepEqual(createTasteProfile(20), createTasteProfile(20));
  assert.notDeepEqual(createTasteProfile(20), createTasteProfile(21));
});

test('favorite food gives an eager response', () => {
  const taste = createTasteProfile(20);
  const result = resolveFoodOffer(taste.favorite, taste, 'familiar');
  assert.equal(result.reaction, 'eager');
  assert.equal(result.accepted, true);
});

test('touch options grow with relationship stage', () => {
  assert.deepEqual(touchOptionsFor('wary'), []);
  assert.deepEqual(touchOptionsFor('familiar'), ['head']);
  assert.deepEqual(touchOptionsFor('trusting'), ['head', 'back', 'hold']);
  assert.deepEqual(touchOptionsFor('bonded'), ['head', 'back', 'hold']);
});
