import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeatherCalendar,
  weatherForDay,
} from '../src/game/systems/weather';
import {
  createGameState,
  updateWeatherExposure,
} from '../src/game/simulation/state';

test('weather calendar is deterministic, bounded, and has no three-day repeat', () => {
  const first = createWeatherCalendar(12);
  assert.deepEqual(first, createWeatherCalendar(12));
  assert.equal(first.filter((weather) => weather === 'sunny').length, 7);
  assert.equal(first.filter((weather) => weather === 'cloudy').length, 4);
  assert.equal(first.filter((weather) => weather === 'rain').length, 3);
  assert.equal(first.slice(0, 4).includes('rain'), false);
  assert.equal(first[6], 'rain');
  for (let index = 2; index < first.length; index += 1) {
    assert.equal(
      first[index] === first[index - 1] && first[index] === first[index - 2],
      false,
    );
  }
});

test('weather remains deterministic after the authored fourteen days', () => {
  assert.equal(weatherForDay(30, 43), weatherForDay(30, 43));
});

test('four continuous rainy seconds off path records muddy life', () => {
  const state = createGameState();
  state.weather = 'rain';
  state.chicken = { x: 300, y: 600 };
  assert.equal(updateWeatherExposure(state, 3.9), false);
  assert.equal(updateWeatherExposure(state, 0.1), true);
  assert.equal(state.muddyToday, true);

  state.offPathRainSeconds = 2;
  state.chicken = { x: 700, y: 500 };
  updateWeatherExposure(state, 1);
  assert.equal(state.offPathRainSeconds, 0);
});
