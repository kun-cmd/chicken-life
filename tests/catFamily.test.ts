import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catTrustStage,
  createCatFamilyState,
  recordCatTrustMemory,
  resetCatFamilyDay,
  restoreCatFamilyState,
} from '../src/game/systems/catFamily';

test('cat trust only records the same kind of interaction once per day', () => {
  const family = createCatFamilyState();

  assert.equal(recordCatTrustMemory(family, 'quiet-company').recorded, true);
  assert.equal(recordCatTrustMemory(family, 'quiet-company').recorded, false);
  assert.equal(family.trust, 1);

  resetCatFamilyDay(family);
  assert.equal(recordCatTrustMemory(family, 'quiet-company').recorded, true);
  assert.equal(family.trust, 2);
  assert.equal(catTrustStage(family), 'accepted');
});

test('cat family status needs varied shared experiences before reaching family trust', () => {
  const family = createCatFamilyState();
  family.trust = 30;
  family.experienced = ['quiet-company'];
  assert.equal(catTrustStage(family), 'accepted');

  family.experienced = [
    'quiet-company',
    'gave-space',
    'cluck-conversation',
    'ball-play',
  ];
  assert.equal(catTrustStage(family), 'family');
});

test('cat family save restoration filters unknown memories and keeps daily progress', () => {
  const restored = restoreCatFamilyState({
    met: true,
    trust: 8,
    experienced: ['quiet-company', 'ball-play', 'unknown'] as never[],
    today: ['ball-play', 'ball-play'],
    quietSeconds: 2.5,
    musicSeconds: 1,
  });

  assert.deepEqual(restored.experienced, ['quiet-company', 'ball-play']);
  assert.equal(restored.met, true);
  assert.deepEqual(restored.today, ['ball-play']);
  assert.equal(restored.quietSeconds, 2.5);
});
