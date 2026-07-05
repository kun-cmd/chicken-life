import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeaselSchedule,
  hasWeaselEncounter,
} from '../src/game/systems/weaselSchedule';

test('always includes an early encounter and the finale day', () => {
  const schedule = createWeaselSchedule(1);
  assert.equal(hasWeaselEncounter(schedule, 2, 1), true);
  assert.equal(hasWeaselEncounter(schedule, 14, 1), true);
});

test('spreads seeded encounters across early, middle, and late play', () => {
  const schedule = createWeaselSchedule(25);
  assert.equal(schedule.length, 5);
  assert.ok(schedule.some((day) => day >= 4 && day <= 5));
  assert.ok(schedule.some((day) => day >= 7 && day <= 9));
  assert.ok(schedule.some((day) => day >= 10 && day <= 12));
});

test('is stable for the same seed', () => {
  assert.deepEqual(createWeaselSchedule(99), createWeaselSchedule(99));
});

test('free play has one deterministic encounter per seven-day block', () => {
  const days = Array.from({ length: 7 }, (_, index) => index + 15);
  const first = days.filter((day) => hasWeaselEncounter([], day, 44));
  const second = days.filter((day) => hasWeaselEncounter([], day, 44));
  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
});
