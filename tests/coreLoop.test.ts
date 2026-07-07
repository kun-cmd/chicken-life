import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BODY_COMFORT_TUNING,
  advanceHeat,
  sprintScaleForHeat,
} from '../src/game/systems/bodyComfort';
import {
  EGG_BUDGET,
  evaluateEggQuality,
} from '../src/game/systems/eggEconomy';
import {
  CORE_LOOP_TUNING,
  applyFlowEvent,
  buildHudSnapshot,
  createGameState,
  digHole,
  eatFood,
  restInHole,
  updateNightPressure,
} from '../src/game/simulation/state';
import { YARD_LAMP_POSITION } from '../src/game/content/yardUpgrades';
import {
  DAY_ACTIVE_SECONDS,
  DUSK_AT,
} from '../src/game/systems/dayFlow';

test('the active-time day keeps its original length and reveals night bugs at dusk', () => {
  const state = createGameState();
  const nightBugs = state.foods.filter((food) => food.type === 'nightBug');

  assert.equal(DAY_ACTIVE_SECONDS, 155);
  assert.equal(nightBugs.length, 2);
  assert.ok(nightBugs.every((food) => food.visibleAt === DUSK_AT));
});

test('sprinting heats the chicken while shade and water cool it', () => {
  const walking = advanceHeat(20, 1, {
    sprinting: false,
    moving: true,
    inShade: false,
    drinking: false,
    raining: false,
    night: false,
  });
  const exerting = advanceHeat(20, 1, {
    sprinting: false,
    moving: true,
    exertion: true,
    inShade: false,
    drinking: false,
    raining: false,
    night: false,
  });
  const hot = advanceHeat(20, 1, {
    sprinting: true,
    moving: true,
    inShade: false,
    drinking: false,
    raining: false,
    night: false,
  });
  const cooled = advanceHeat(hot, 1, {
    sprinting: false,
    moving: false,
    inShade: true,
    drinking: true,
    raining: false,
    night: false,
  });
  assert.ok(walking > 20);
  assert.ok(exerting > walking);
  assert.ok(hot - walking > 9);
  assert.ok(cooled < hot);
  assert.equal(sprintScaleForHeat(BODY_COMFORT_TUNING.maxHeat), BODY_COMFORT_TUNING.minimumSprintScale);
});

test('egg quality always has a budget floor and rewards wild food plus dry rest', () => {
  const poor = evaluateEggQuality({
    nutrition: 0,
    foodsEaten: [],
    dryRest: true,
  });
  const excellent = evaluateEggQuality({
    nutrition: 80,
    foodsEaten: ['worm', 'nightBug'],
    dryRest: true,
  });
  assert.equal(poor.budget, EGG_BUDGET.poor);
  assert.equal(poor.budget, 2);
  assert.equal(excellent.quality, 'excellent');
  assert.equal(excellent.budget, 5);
});

test('night pressure covers egg nutrition and does not rise just because time passes', () => {
  const state = createGameState();
  state.nutrition = 90;
  state.nightPressure = 42;
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 1 });

  const snapshot = buildHudSnapshot(state, false);
  assert.equal(snapshot.nutrition, 90);
  assert.equal(snapshot.effectiveNutrition, 58);

  updateNightPressure(state, {
    dt: 8,
    position: { x: 1200, y: 830 },
    staminaRatio: 0.05,
    inShadow: true,
    onPath: false,
    nearCoop: false,
    nearLight: false,
  });
  assert.equal(state.nightPressure, 42);
});

test('owned porch light reduces night pressure once per night by five or six', () => {
  const state = createGameState();
  state.yard.owned.push('yard-lamp');
  state.nightPressure = 40;
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'return-home' });
  applyFlowEvent(state, { type: 'tick', amount: 1 });

  const context = {
    dt: 0,
    position: YARD_LAMP_POSITION,
    staminaRatio: 1,
    inShadow: false,
    onPath: true,
    nearCoop: false,
    nearLight: true,
  };
  const first = updateNightPressure(state, context);
  const afterFirst = state.nightPressure;
  const second = updateNightPressure(state, context);

  assert.ok(first >= CORE_LOOP_TUNING.porchLightReliefMin);
  assert.ok(first <= CORE_LOOP_TUNING.porchLightReliefMax);
  assert.equal(second, 0);
  assert.equal(state.nightPressure, afterFirst);
});

test('scratching the same place deepens a remembered cooling hole', () => {
  const state = createGameState();
  state.weather = 'sunny';
  state.holesDugToday = 0;
  const first = digHole(state, { x: 310, y: 505 });
  assert.ok(first);
  const firstDepth = first.depth;

  state.holesDugToday = 0;
  const second = digHole(state, { x: 318, y: 512 });
  assert.ok(second);
  assert.equal(second?.id, first.id);
  assert.ok(second.depth > firstDepth);

  state.heat = 80;
  restInHole(state, second, 2);
  assert.ok(state.heat <= 69);
  assert.equal(state.holes.length, 1);
});

test('holes cool the same at night as they do in the day', () => {
  const makeRestingState = (night: boolean) => {
    const state = createGameState();
    state.weather = 'sunny';
    applyFlowEvent(state, { type: 'egg-found' });
    applyFlowEvent(state, { type: 'return-home' });
    if (night) applyFlowEvent(state, { type: 'tick', amount: 1 });
    const hole = digHole(state, { x: 430, y: 720 });
    assert.ok(hole);
    hole.depth = 3;
    hole.moisture = 0.55;
    state.heat = 80;
    restInHole(state, hole, 2.4);
    return state.heat;
  };

  const dayHeat = makeRestingState(false);
  const nightHeat = makeRestingState(true);

  assert.equal(nightHeat, dayHeat);
});

test('ordinary holes cool quickly while deep holes cool faster', () => {
  const restHeat = (depth: number) => {
    const state = createGameState();
    state.weather = 'sunny';
    const hole = digHole(state, { x: 900, y: 700 });
    assert.ok(hole);
    hole.depth = depth;
    hole.moisture = 0.16;
    state.heat = 80;
    restInHole(state, hole, 1);
    return state.heat;
  };

  const shallowHeat = restHeat(1);
  const deepHeat = restHeat(3);

  assert.ok(shallowHeat < 64);
  assert.ok(deepHeat < shallowHeat);
});

test('food raises egg momentum at the slower tuned rate', () => {
  const state = createGameState();
  state.nutrition = 0;
  const food = {
    id: 999,
    x: state.chicken.x,
    y: state.chicken.y,
    type: 'grain' as const,
    visibleAt: 0,
  };
  state.foods.push(food);

  eatFood(state, food);

  assert.equal(state.nutrition, 3);
});
