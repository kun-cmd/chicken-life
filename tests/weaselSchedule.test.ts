import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeaselSchedule,
  hasWeaselEncounter,
} from '../src/game/systems/weaselSchedule';

test('always includes the teaching and finale days', () => {
  const schedule = createWeaselSchedule(1);
  assert.equal(hasWeaselEncounter(schedule, 8, 1), true);
  assert.equal(hasWeaselEncounter(schedule, 14, 1), true);
});

test('chooses exactly two nonconsecutive random days from nine through thirteen', () => {
  const middle = createWeaselSchedule(25).filter((day) => day >= 9 && day <= 13);
  assert.equal(middle.length, 2);
  assert.ok(Math.abs(middle[0] - middle[1]) > 1);
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
