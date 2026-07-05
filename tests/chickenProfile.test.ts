import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CHICKEN_NAME,
  createChickenProfile,
  normalizeChickenName,
} from '../src/game/profile/chickenProfile';

test('trims and limits a chicken name to twelve code points', () => {
  assert.equal(normalizeChickenName('  小花  '), '小花');
  assert.equal(normalizeChickenName('一二三四五六七八九十甲乙丙'), '一二三四五六七八九十甲乙');
});

test('uses the default name for blank input', () => {
  assert.equal(normalizeChickenName('   '), DEFAULT_CHICKEN_NAME);
});

test('starts with peck, cluck, and sprint awakened', () => {
  const profile = createChickenProfile(1234);
  assert.deepEqual(profile.awakenedAbilities, {
    peck: true,
    cluck: true,
    scratch: false,
    sprint: true,
    flutter: false,
  });
  assert.equal(profile.runSeed, 1234);
  assert.equal(profile.named, false);
});
