import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buyGardenSeed,
  createGameState,
  eatFood,
  eatGardenPlant,
  plantGardenSeed,
  waterGardenPlot,
  type FoodEntity,
} from '../src/game/simulation/state';
import { advanceGardenMorning } from '../src/game/systems/garden';

test('garden seeds are bought, planted, watered, and mature after enough watered mornings', () => {
  const state = createGameState();
  state.yard.wood = 2;

  assert.equal(buyGardenSeed(state, 'chive'), true);
  assert.equal(state.yard.wood, 1);
  assert.equal(state.garden.inventory.chive, 1);
  assert.equal(plantGardenSeed(state, 'plot-left', 'chive'), true);
  assert.equal(state.garden.inventory.chive, 0);

  const plot = state.garden.plots[0];
  assert.equal(waterGardenPlot(state, plot.id), true);
  advanceGardenMorning(state.garden);
  assert.equal(plot.growth, 1);
  assert.equal(plot.mature, false);

  assert.equal(waterGardenPlot(state, plot.id), true);
  advanceGardenMorning(state.garden);
  assert.equal(plot.growth, 2);
  assert.equal(plot.mature, true);
});

test('mature plant waits for dropped food to be eaten before the whole plant can be eaten', () => {
  const state = createGameState();
  const plot = state.garden.plots[0];
  plot.seed = 'cucumber';
  plot.growth = 4;
  plot.mature = true;
  plot.producedDay = state.day;
  plot.produceFoodId = 88;

  const food: FoodEntity = {
    id: 88,
    type: 'cucumber',
    x: plot.x,
    y: plot.y,
    visibleAt: 0,
    fromGarden: true,
    gardenPlotId: plot.id,
  };
  state.foods = [food];

  assert.equal(eatGardenPlant(state, plot.id), false);
  eatFood(state, food);
  assert.equal(plot.produceFoodId, null);
  assert.equal(eatGardenPlant(state, plot.id), true);
  assert.equal(state.garden.plots[0].seed, null);
});
