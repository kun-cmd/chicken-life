import assert from 'node:assert/strict';
import test from 'node:test';
import { EGG_SPOTS, selectEggSpot } from '../src/game/content/eggSpots';
import { isBlocked } from '../src/game/content/yard';
import { createSeededRandom } from '../src/game/systems/seededRandom';

test('opens three, five, and eight egg spots by story chapter', () => {
  assert.equal(EGG_SPOTS.filter((spot) => spot.unlockDay <= 1).length, 3);
  assert.equal(EGG_SPOTS.filter((spot) => spot.unlockDay <= 4).length, 5);
  assert.equal(EGG_SPOTS.filter((spot) => spot.unlockDay <= 10).length, 8);
});

test('never selects yesterday spot when another valid spot exists', () => {
  const random = createSeededRandom(42);
  let previous: string | null = null;
  for (let day = 1; day <= 14; day += 1) {
    const selected = selectEggSpot(day, previous, random);
    assert.notEqual(selected.id, previous);
    previous = selected.id;
  }
});

test('same seed produces the same spot sequence', () => {
  const sequence = (seed: number) => {
    const random = createSeededRandom(seed);
    let previous: string | null = null;
    return Array.from({ length: 14 }, (_, index) => {
      const spot = selectEggSpot(index + 1, previous, random);
      previous = spot.id;
      return spot.id;
    });
  };
  assert.deepEqual(sequence(9), sequence(9));
  assert.notDeepEqual(sequence(9), sequence(10));
});

test('egg and clue positions are reachable', () => {
  for (const spot of EGG_SPOTS) {
    assert.equal(isBlocked(spot.position, 12), false, `${spot.id} egg is blocked`);
    assert.equal(isBlocked(spot.cluePosition, 12), false, `${spot.id} clue is blocked`);
  }
});
