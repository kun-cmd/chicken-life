import assert from 'node:assert/strict';
import test from 'node:test';
import { KEEPER_ROUTE, isOnPath } from '../src/game/content/yard';
import {
  createGameState,
  isGoodFoodSpot,
  updateKeeper,
} from '../src/game/simulation/state';

test('keeper sunflower seeds fall at the keeper position even on paths', () => {
  const state = createGameState();
  const pathPoint = KEEPER_ROUTE[1];
  assert.ok(isOnPath(pathPoint));

  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.2;
  state.keeper = {
    ...state.keeper,
    active: true,
    returning: false,
    doneFeeding: false,
    rescuing: false,
    routeIndex: 1,
    scatterCooldown: 0,
    x: pathPoint.x,
    y: pathPoint.y,
  };

  const seed = updateKeeper(state, 0, 0.1);

  assert.ok(seed);
  assert.equal(seed.type, 'sunflower');
  assert.equal(seed.fromKeeper, true);
  assert.deepEqual({ x: seed.x, y: seed.y }, pathPoint);
});

test('keeper waits before entering for daytime feeding', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.24;
  state.keeper = {
    ...state.keeper,
    active: false,
    returning: false,
    doneFeeding: false,
    rescuing: false,
    routeIndex: 1,
    scatterCooldown: 10,
  };

  assert.equal(updateKeeper(state, 1, 1), null);
  assert.equal(state.keeper.active, false);

  assert.equal(updateKeeper(state, 0, 10), null);
  assert.equal(state.keeper.active, true);
  assert.equal(state.foods.some((food) => food.type === 'sunflower'), false);
});

test('keeper daytime sunflower feeding stays limited', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
  state.eaten.sunflower = 3;
  state.keeper = {
    ...state.keeper,
    active: true,
    returning: false,
    doneFeeding: false,
    rescuing: false,
    routeIndex: 1,
    scatterCooldown: 0,
    x: KEEPER_ROUTE[1].x,
    y: KEEPER_ROUTE[1].y,
  };

  assert.equal(updateKeeper(state, 0, 1), null);
  assert.equal(state.keeper.returning, true);
  assert.equal(state.foods.some((food) => food.type === 'sunflower'), false);
});

test('non-keeper food starts on mud spots', () => {
  const state = createGameState();
  const naturalFoods = state.foods.filter((food) => !food.fromKeeper);

  assert.ok(naturalFoods.length > 0);
  assert.ok(naturalFoods.every(isGoodFoodSpot));
});
