import assert from 'node:assert/strict';
import test from 'node:test';
import { KEEPER_ROUTE, MAIN_PATH, isOnPath } from '../src/game/content/yard';
import {
  createGameState,
  expireFoods,
  isGoodFoodSpot,
  updateKeeper,
  visibleFoods,
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
  assert.ok(seed.freshUntil !== undefined);
  assert.ok(seed.expiresAt !== undefined);
  assert.ok(seed.freshUntil - state.time >= 0.22);
  assert.equal(seed.expiresAt, seed.freshUntil);
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

test('keeper daytime sunflower feeding allows five seeds then returns', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
  state.eaten.sunflower = 5;
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

test('keeper daytime route stays on paved paths', () => {
  for (const point of KEEPER_ROUTE) {
    assert.equal(isOnPath(point), true);
    assert.ok(point.x >= MAIN_PATH.x);
    assert.ok(point.x <= MAIN_PATH.x + MAIN_PATH.width);
  }

  for (let index = 1; index < KEEPER_ROUTE.length; index += 1) {
    const from = KEEPER_ROUTE[index - 1];
    const to = KEEPER_ROUTE[index];
    for (let step = 0; step <= 8; step += 1) {
      const ratio = step / 8;
      assert.equal(
        isOnPath({
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio,
        }),
        true,
      );
    }
  }
});

test('keeper waits at the end of one S route until five seeds are fed', () => {
  const state = createGameState();
  const lastPoint = KEEPER_ROUTE[KEEPER_ROUTE.length - 1];
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
  state.keeper = {
    ...state.keeper,
    active: true,
    returning: false,
    doneFeeding: false,
    rescuing: false,
    routeIndex: KEEPER_ROUTE.length - 1,
    scatterCooldown: 99,
    x: lastPoint.x,
    y: lastPoint.y,
  };

  assert.equal(updateKeeper(state, 0, 0.1), null);
  assert.equal(state.keeper.returning, false);
  assert.equal(state.keeper.routeIndex, KEEPER_ROUTE.length - 1);

  state.eaten.sunflower = 5;
  assert.equal(updateKeeper(state, 0, 0.1), null);
  assert.equal(state.keeper.returning, true);
  assert.equal(state.keeper.routeIndex, KEEPER_ROUTE.length - 1);
});

test('expired keeper sunflower seeds are removed from the yard', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
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

  const seed = updateKeeper(state, 0, 0.1);
  assert.ok(seed);
  state.time = seed.freshUntil! + 0.01;
  assert.equal(visibleFoods(state).some((food) => food.id === seed.id), false);

  const expired = expireFoods(state);
  assert.deepEqual(expired.expiredIds, [seed.id]);
  assert.equal(state.foods.some((food) => food.id === seed.id), false);
});

test('expired keeper sunflower seeds do not count against the daily feed limit', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.4;
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
  state.foods = Array.from({ length: 5 }, (_, index) => ({
    id: index + 100,
    x: KEEPER_ROUTE[1].x,
    y: KEEPER_ROUTE[1].y,
    type: 'sunflower' as const,
    visibleAt: 0.1,
    expiresAt: 0.2,
    freshUntil: 0.2,
    fromKeeper: true,
  }));

  const seed = updateKeeper(state, 0, 0.1);

  assert.ok(seed);
  assert.equal(seed.type, 'sunflower');
  assert.equal(state.keeper.returning, false);
});

test('non-keeper food starts on mud spots', () => {
  const state = createGameState();
  const naturalFoods = state.foods.filter((food) => !food.fromKeeper);

  assert.ok(naturalFoods.length > 0);
  assert.ok(naturalFoods.every(isGoodFoodSpot));
});
