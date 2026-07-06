import assert from 'node:assert/strict';
import test from 'node:test';
import { createChickenProfile } from '../src/game/profile/chickenProfile';
import { createGameState } from '../src/game/simulation/state';
import { createForagingState, foodPoolFor } from '../src/game/systems/foraging';

test('natural food progression keeps sunflower seeds out of the yard pool', () => {
  const profile = createChickenProfile(1234);
  profile.awakenedAbilities.scratch = true;
  profile.awakenedAbilities.flutter = true;

  for (let day = 1; day <= 14; day += 1) {
    assert.equal(foodPoolFor(profile, false, day).includes('sunflower'), false);
    assert.equal(foodPoolFor(profile, true, day).includes('sunflower'), false);
  }
});

test('wild foods enter the natural pool gradually', () => {
  const profile = createChickenProfile(1234);
  profile.awakenedAbilities.scratch = true;
  profile.awakenedAbilities.flutter = true;

  assert.deepEqual(foodPoolFor(profile, false, 1), ['grain', 'grass']);
  assert.deepEqual(foodPoolFor(profile, false, 2), ['grain', 'grass']);
  assert.deepEqual(foodPoolFor(profile, false, 3), ['grain', 'grass', 'cricket']);
  assert.deepEqual(foodPoolFor(profile, false, 4), ['grain', 'grass', 'cricket', 'worm']);
  assert.deepEqual(foodPoolFor(profile, false, 6), [
    'grain',
    'grass',
    'cricket',
    'worm',
    'beetle',
  ]);
  assert.equal(foodPoolFor(profile, true, 3).includes('nightBug'), true);
});

test('a new game starts without naturally spawned sunflower seeds', () => {
  const state = createGameState();

  assert.equal(createForagingState().discoveredFoods.includes('sunflower'), false);
  assert.equal(state.foods.some((food) => food.type === 'sunflower' && !food.fromKeeper), false);
});
