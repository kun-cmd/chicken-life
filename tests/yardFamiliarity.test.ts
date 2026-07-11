import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createYardFamiliarityState,
  movementFamiliarityScale,
  recordRegionExploration,
  restoreYardFamiliarityState,
  yardRegionFor,
  regionFamiliarityFor,
  markTipShownForRegion,
} from '../src/game/systems/yardFamiliarity';
import { restoreGameState } from '../src/game/simulation/state';
import { DAY_ACTIVE_SECONDS } from '../src/game/systems/dayFlow';

// Yard coordinates to test against:
// left-tree: (0, 1200) to (660, 790)
// right-bottom: (830, 1200) to (1500, 900)
// upper-wilds: (0, 260) to (1500, 0)
// left-middle: x 0-660, y 260-790
// right-middle: x 830-1500, y 260-900

test('default state has all regions at zero', () => {
  const state = createYardFamiliarityState();
  for (const region of Object.keys(state.regions)) {
    assert.equal(state.regions[region as keyof typeof state.regions].familiarity, 0);
    assert.equal(state.regions[region as keyof typeof state.regions].firstSeenDay, 0);
    assert.equal(state.regions[region as keyof typeof state.regions].tipShown, false);
  }
});

test('restore yields default state for null input', () => {
  const state = restoreYardFamiliarityState(null);
  for (const region of Object.keys(state.regions)) {
    assert.equal(state.regions[region as keyof typeof state.regions].familiarity, 0);
  }
});

test('restore yields default state for empty object', () => {
  const state = restoreYardFamiliarityState({});
  for (const region of Object.keys(state.regions)) {
    assert.equal(state.regions[region as keyof typeof state.regions].familiarity, 0);
  }
});

test('restore recovers saved familiarity values', () => {
  const saved = {
    regions: {
      'upper-wilds': { familiarity: 42, firstSeenDay: 3, tipShown: true },
    },
  };
  const state = restoreYardFamiliarityState(saved);
  assert.equal(state.regions['upper-wilds'].familiarity, 42);
  assert.equal(state.regions['upper-wilds'].firstSeenDay, 3);
  assert.equal(state.regions['upper-wilds'].tipShown, true);
  // Other regions stay at default
  assert.equal(state.regions['right-bottom'].familiarity, 0);
});

test('restore maps old region familiarity into new regions', () => {
  const state = restoreYardFamiliarityState({
    regions: {
      'pond-bank': { familiarity: 34, firstSeenDay: 2, tipShown: true },
      'tree-shade': { familiarity: 58, firstSeenDay: 3, tipShown: false },
      'planting-zone': { familiarity: 46, firstSeenDay: 4, tipShown: true },
    },
  });

  assert.equal(state.regions['upper-wilds'].familiarity, 34);
  assert.equal(state.regions['upper-wilds'].tipShown, true);
  assert.equal(state.regions['left-tree'].familiarity, 58);
  assert.equal(state.regions['right-bottom'].familiarity, 46);
});

test('restore clamps familiarity to [0, 100]', () => {
  const savedHigh = {
    regions: { 'right-bottom': { familiarity: 999, firstSeenDay: 1, tipShown: false } },
  };
  assert.equal(restoreYardFamiliarityState(savedHigh).regions['right-bottom'].familiarity, 100);

  const savedLow = {
    regions: { 'right-bottom': { familiarity: -5, firstSeenDay: 1, tipShown: false } },
  };
  assert.equal(restoreYardFamiliarityState(savedLow).regions['right-bottom'].familiarity, 0);

  const savedNaN = {
    regions: { 'right-bottom': { familiarity: NaN, firstSeenDay: 1, tipShown: false } },
  };
  assert.equal(restoreYardFamiliarityState(savedNaN).regions['right-bottom'].familiarity, 0);
});

test('recording exploration increases region familiarity', () => {
  const state = createYardFamiliarityState();
  const result = recordRegionExploration(state, { x: 246, y: 964 }, 2, 1);
  assert.equal(result.region, 'left-tree');
  assert.equal(result.firstSeen, true);
  assert.ok(state.regions['left-tree'].familiarity > 0);
  assert.equal(state.regions['left-tree'].firstSeenDay, 1);
});

test('familiarity does not exceed max', () => {
  const state = createYardFamiliarityState();
  for (let i = 0; i < 50; i++) {
    recordRegionExploration(state, { x: 246, y: 964 }, 3, 1);
  }
  assert.ok(state.regions['left-tree'].familiarity <= 100);
});

test('familiarity needs several active days to max out', () => {
  const state = createYardFamiliarityState();
  for (let day = 1; day <= 2; day++) {
    recordRegionExploration(state, { x: 246, y: 964 }, DAY_ACTIVE_SECONDS, day);
  }
  assert.ok(state.regions['left-tree'].familiarity < 100);
});

test('movement scale is lower for unfamiliar off-path regions', () => {
  const state = createYardFamiliarityState();
  const lowScale = movementFamiliarityScale(state, { x: 260, y: 968 });
  assert.ok(lowScale < 1, 'low scale should be less than 1');
  assert.ok(lowScale > 0, 'low scale should be greater than 0');

  // Max out and verify scale reaches 1
  state.regions['left-tree'].familiarity = 100;
  const highScale = movementFamiliarityScale(state, { x: 260, y: 968 });
  assert.equal(highScale, 1);
});

test('non-region movement scale is always 1', () => {
  const state = createYardFamiliarityState();
  assert.equal(movementFamiliarityScale(state, { x: 750, y: 720 }), 1);
});

test('different coordinates resolve to different regions', () => {
  // Center band is not a familiarity/food region.
  assert.equal(yardRegionFor({ x: 750, y: 720 }), null);
  assert.equal(yardRegionFor({ x: 760, y: 420 }), null);

  // Upper band above the house -> 'upper-wilds'
  assert.equal(yardRegionFor({ x: 760, y: 58 }), 'upper-wilds');

  // Lower-left shade area -> 'left-tree'
  assert.equal(yardRegionFor({ x: 260, y: 968 }), 'left-tree');

  // Lower-right area -> 'right-bottom'
  assert.equal(yardRegionFor({ x: 1120, y: 1000 }), 'right-bottom');

  // Middle side areas
  assert.equal(yardRegionFor({ x: 320, y: 520 }), 'left-middle');
  assert.equal(yardRegionFor({ x: 1120, y: 520 }), 'right-middle');
});

test('regionFamiliarityFor returns correct value for point', () => {
  const state = createYardFamiliarityState();
  state.regions['right-bottom'].familiarity = 75;
  assert.equal(regionFamiliarityFor(state, { x: 1127, y: 1000 }), 75);
  assert.equal(regionFamiliarityFor(state, { x: 750, y: 720 }), 0);
});

test('recording exploration ignores non-region points', () => {
  const state = createYardFamiliarityState();
  const result = recordRegionExploration(state, { x: 750, y: 720 }, 2, 1);
  assert.equal(result.region, null);
  assert.equal(result.firstSeen, false);
  assert.equal(result.canShowTip, false);
  assert.equal(state.regions['left-middle'].familiarity, 0);
});

test('canShowTip is true for unseen region, false after tip shown', () => {
  const state = createYardFamiliarityState();
  const result = recordRegionExploration(state, { x: 760, y: 58 }, 1, 1);
  assert.equal(result.canShowTip, true);
  assert.equal(result.region, 'upper-wilds');

  markTipShownForRegion(state, 'upper-wilds');
  const result2 = recordRegionExploration(state, { x: 760, y: 58 }, 1, 1);
  assert.equal(result2.canShowTip, false);
});

test('markTipShownForRegion sets tipShown to true', () => {
  const state = createYardFamiliarityState();
  assert.equal(state.regions['left-tree'].tipShown, false);
  markTipShownForRegion(state, 'left-tree');
  assert.equal(state.regions['left-tree'].tipShown, true);

  // other regions unaffected
  assert.equal(state.regions['upper-wilds'].tipShown, false);
});

test('restore preserves tipShown flag', () => {
  const saved = {
    regions: {
      'right-bottom': { familiarity: 30, firstSeenDay: 2, tipShown: true },
    },
  };
  const state = restoreYardFamiliarityState(saved);
  assert.equal(state.regions['right-bottom'].tipShown, true);
  assert.equal(state.regions['right-bottom'].familiarity, 30);
});

test('restoreGameState with missing yardFamiliarity defaults to zeros', () => {
  // Simulate old save without yardFamiliarity
  const state = restoreGameState({
    day: 2,
    phase: 'day',
    mode: 'chicken',
    time: 0.3,
    egg: null,
    profile: { name: 'test', named: true, awakenedAbilities: { sprint: true } },
  });
  const yf = state.yardFamiliarity;
  assert.ok(yf, 'yardFamiliarity should exist');
  assert.ok(yf.regions, 'regions should exist');
  for (const region of Object.keys(yf.regions)) {
    const entry = yf.regions[region as keyof typeof yf.regions];
    assert.equal(entry.familiarity, 0, 'familiarity should default to 0');
    assert.equal(entry.firstSeenDay, 0);
    assert.equal(entry.tipShown, false);
  }
});
