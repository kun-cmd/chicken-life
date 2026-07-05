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
  createGameState,
  updateNightPressure,
} from '../src/game/simulation/state';
import { YARD_LAMP_POSITION } from '../src/game/content/yardUpgrades';

test('sprinting heats the chicken while shade and water cool it', () => {
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
  assert.ok(hot > 20);
  assert.ok(cooled < hot);
  assert.equal(sprintScaleForHeat(BODY_COMFORT_TUNING.maxHeat), BODY_COMFORT_TUNING.minimumSprintScale);
});

test('egg quality always has a budget floor and rewards wild food plus dry rest', () => {
  const poor = evaluateEggQuality({
    fullness: 0,
    foodsEaten: [],
    dryRest: true,
    caught: false,
  });
  const excellent = evaluateEggQuality({
    fullness: 80,
    foodsEaten: ['worm', 'nightBug'],
    dryRest: true,
    caught: false,
  });
  assert.equal(poor.budget, EGG_BUDGET.poor);
  assert.equal(poor.budget, 2);
  assert.equal(excellent.quality, 'excellent');
  assert.equal(excellent.budget, 5);
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
