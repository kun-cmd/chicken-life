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
import { pendingAwakening } from '../src/game/systems/abilities';
import { tutorialForDay } from '../src/game/content/abilityTutorials';
import {
  CORE_LOOP_TUNING,
  applyFlowEvent,
  buildHudSnapshot,
  createGameState,
  digHole,
  eatFood,
  restInHole,
  servePremiumFeed,
  startNextDay,
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
  assert.ok(hot - walking > 9);
  assert.ok(cooled < hot);
  assert.equal(sprintScaleForHeat(BODY_COMFORT_TUNING.maxHeat), BODY_COMFORT_TUNING.minimumSprintScale);
});

test('egg quality follows potential tiers, wild food bonus, and wet downgrade', () => {
  const poor = evaluateEggQuality({
    nutrition: 39,
    foodsEaten: [],
    dryRest: true,
  });
  const ordinary = evaluateEggQuality({
    nutrition: 40,
    foodsEaten: [],
    dryRest: true,
  });
  const good = evaluateEggQuality({
    nutrition: 60,
    foodsEaten: [],
    dryRest: true,
  });
  const excellent = evaluateEggQuality({
    nutrition: 80,
    foodsEaten: [],
    dryRest: true,
  });
  const wildBoosted = evaluateEggQuality({
    nutrition: 52,
    foodsEaten: ['worm'],
    dryRest: true,
  });
  const wetDowngraded = evaluateEggQuality({
    nutrition: 80,
    foodsEaten: [],
    dryRest: false,
  });
  assert.equal(poor.quality, 'poor');
  assert.equal(poor.budget, EGG_BUDGET.poor);
  assert.equal(poor.budget, 2);
  assert.equal(ordinary.quality, 'ordinary');
  assert.equal(good.quality, 'good');
  assert.equal(excellent.quality, 'excellent');
  assert.equal(excellent.budget, 5);
  assert.equal(wildBoosted.score, 60);
  assert.equal(wildBoosted.quality, 'good');
  assert.equal(wetDowngraded.score, 80);
  assert.equal(wetDowngraded.quality, 'good');
});

test('premium feed pieces visibly count as richer grain nutrition', () => {
  const state = createGameState();
  state.mode = 'human';
  state.yard.owned.push('premium-feed');
  state.nutrition = 60;
  const served = servePremiumFeed(state);
  assert.equal(served.length, CORE_LOOP_TUNING.premiumFeedPieces);
  assert.ok(served.every((food) => food.type === 'grain' && food.fromKeeper));

  for (const food of served) {
    eatFood(state, food);
  }

  assert.equal(state.nutrition, 72);
});

test('scratch becomes the day three territory skill', () => {
  const state = createGameState();
  assert.equal(pendingAwakening(2, state.profile), null);
  assert.equal(pendingAwakening(3, state.profile), 'scratch');
  assert.equal(tutorialForDay(3, state.profile.awakenedAbilities)?.ability, 'scratch');
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

test('ordinary holes expire sooner while deep territory holes remain remembered', () => {
  const shallow = createGameState();
  shallow.weather = 'sunny';
  const shallowHole = digHole(shallow, { x: 320, y: 520 });
  assert.ok(shallowHole);
  advanceMornings(shallow, 3);
  assert.equal(shallow.holes.some((hole) => hole.id === shallowHole.id), false);

  const deep = createGameState();
  deep.weather = 'sunny';
  const deepHole = digHole(deep, { x: 430, y: 720 });
  assert.ok(deepHole);
  deep.holesDugToday = 0;
  const sameHole = digHole(deep, { x: 438, y: 724 });
  assert.equal(sameHole?.id, deepHole.id);
  advanceMornings(deep, 3);
  assert.equal(deep.holes.some((hole) => hole.id === deepHole.id), true);
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

function advanceMornings(state: ReturnType<typeof createGameState>, mornings: number) {
  for (let index = 0; index < mornings; index += 1) {
    if (state.flow.phase === 'morning-human') {
      applyFlowEvent(state, { type: 'egg-found' });
      applyFlowEvent(state, { type: 'return-home' });
    }
    applyFlowEvent(state, { type: 'tick', amount: 1 });
    applyFlowEvent(state, { type: 'settle-for-night' });
    startNextDay(state);
  }
}

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
