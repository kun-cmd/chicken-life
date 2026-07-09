import assert from 'node:assert/strict';
import test from 'node:test';
import { createChickenProfile } from '../src/game/profile/chickenProfile';
import { createGameState } from '../src/game/simulation/state';
import {
  createForagingState,
  foodPoolFor,
  foodPoolForFamiliarity,
} from '../src/game/systems/foraging';

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

test('familiarity food pool keeps low familiarity on the base pool', () => {
  const profile = createChickenProfile(1234);
  profile.awakenedAbilities.scratch = true;
  profile.awakenedAbilities.flutter = true;

  assert.deepEqual(
    foodPoolForFamiliarity({ profile, dusk: false, day: 1, familiarity: 10 }),
    ['grain', 'grass'],
  );
});

test('familiarity food pool can reveal wild foods before day gates when abilities allow it', () => {
  const profile = createChickenProfile(1234);
  profile.awakenedAbilities.scratch = true;
  profile.awakenedAbilities.flutter = true;

  const pool = foodPoolForFamiliarity({ profile, dusk: false, day: 1, familiarity: 80 });

  assert.equal(pool.includes('cricket'), true);
  assert.equal(pool.includes('worm'), true);
  assert.equal(pool.includes('beetle'), true);
  assert.equal(pool.includes('berry'), true);
});

test('familiarity food pool still respects ability gates', () => {
  const profile = createChickenProfile(1234);
  profile.awakenedAbilities.sprint = false;
  profile.awakenedAbilities.scratch = false;
  profile.awakenedAbilities.flutter = false;

  const pool = foodPoolForFamiliarity({ profile, dusk: false, day: 1, familiarity: 100 });

  assert.deepEqual(pool, ['grain', 'grass']);
});

test('familiarity food pool does not add daylight extras at dusk', () => {
  const profile = createChickenProfile(1234);
  profile.awakenedAbilities.scratch = true;
  profile.awakenedAbilities.flutter = true;

  const pool = foodPoolForFamiliarity({ profile, dusk: true, day: 4, familiarity: 100 });

  assert.equal(pool.includes('nightBug'), true);
  assert.equal(pool.includes('beetle'), false);
  assert.equal(pool.includes('berry'), false);
});

test('left tree region only adds low yield bugs at high familiarity', () => {
  const profile = createChickenProfile(1234);
  const low = foodPoolForFamiliarity({
    profile,
    dusk: false,
    day: 8,
    familiarity: 40,
    region: 'left-tree',
  });
  const high = foodPoolForFamiliarity({
    profile,
    dusk: false,
    day: 8,
    familiarity: 80,
    region: 'left-tree',
  });

  assert.deepEqual(low, ['grain', 'grass']);
  assert.deepEqual(high, ['grain', 'grass', 'cricket']);
});

test('upper wilds start with grass and crickets, then improve with familiarity', () => {
  const profile = createChickenProfile(1234);
  profile.awakenedAbilities.scratch = true;

  const low = foodPoolForFamiliarity({
    profile,
    dusk: false,
    day: 1,
    familiarity: 0,
    region: 'upper-wilds',
  });
  const high = foodPoolForFamiliarity({
    profile,
    dusk: false,
    day: 1,
    familiarity: 60,
    region: 'upper-wilds',
  });

  assert.deepEqual(low, ['grass', 'cricket']);
  assert.equal(high.includes('worm'), true);
  assert.equal(high.includes('beetle'), true);
  assert.equal(high.includes('berry'), false);
});
