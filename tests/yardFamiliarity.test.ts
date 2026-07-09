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
// COOP: { x: 1038, y: 245, width: 178, height: 132 }, center ~(1127, 311)
// MAIN_PATH: { x: 650, y: 322, width: 196, height: 658 }
// HOUSE_PATH: { x: 414, y: 318, width: 774, height: 104 }
// LEFT_TREE_AREA: { x: 72, y: 612, width: 360, height: 292 }
// PLANTING_ZONE: { x: 1040, y: 690, width: 286, height: 210 }

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
  assert.equal(state.regions['coop-yard'].familiarity, 0);
});

test('restore maps old pond and tree familiarity into new regions', () => {
  const state = restoreYardFamiliarityState({
    regions: {
      'pond-bank': { familiarity: 34, firstSeenDay: 2, tipShown: true },
      'tree-shade': { familiarity: 58, firstSeenDay: 3, tipShown: false },
    },
  });

  assert.equal(state.regions['upper-wilds'].familiarity, 34);
  assert.equal(state.regions['upper-wilds'].tipShown, true);
  assert.equal(state.regions['left-tree'].familiarity, 58);
});

test('restore clamps familiarity to [0, 100]', () => {
  const savedHigh = {
    regions: { 'main-path': { familiarity: 999, firstSeenDay: 1, tipShown: false } },
  };
  assert.equal(restoreYardFamiliarityState(savedHigh).regions['main-path'].familiarity, 100);

  const savedLow = {
    regions: { 'main-path': { familiarity: -5, firstSeenDay: 1, tipShown: false } },
  };
  assert.equal(restoreYardFamiliarityState(savedLow).regions['main-path'].familiarity, 0);

  const savedNaN = {
    regions: { 'main-path': { familiarity: NaN, firstSeenDay: 1, tipShown: false } },
  };
  assert.equal(restoreYardFamiliarityState(savedNaN).regions['main-path'].familiarity, 0);
});

test('recording exploration increases region familiarity', () => {
  const state = createYardFamiliarityState();
  const result = recordRegionExploration(state, { x: 246, y: 744 }, 2, 1);
  assert.equal(result.region, 'left-tree');
  assert.equal(result.firstSeen, true);
  assert.ok(state.regions['left-tree'].familiarity > 0);
  assert.equal(state.regions['left-tree'].firstSeenDay, 1);
});

test('familiarity does not exceed max', () => {
  const state = createYardFamiliarityState();
  for (let i = 0; i < 50; i++) {
    recordRegionExploration(state, { x: 246, y: 744 }, 3, 1);
  }
  assert.ok(state.regions['left-tree'].familiarity <= 100);
});

test('familiarity needs several active days to max out', () => {
  const state = createYardFamiliarityState();
  for (let day = 1; day <= 4; day++) {
    recordRegionExploration(state, { x: 246, y: 744 }, DAY_ACTIVE_SECONDS, day);
  }
  assert.ok(state.regions['left-tree'].familiarity < 100);
});

test('movement scale is lower for unfamiliar regions', () => {
  const state = createYardFamiliarityState();
  const lowScale = movementFamiliarityScale(state, { x: 750, y: 380 });
  assert.ok(lowScale < 1, 'low scale should be less than 1');
  assert.ok(lowScale > 0, 'low scale should be greater than 0');

  // Max out and verify scale reaches 1
  state.regions['main-path'].familiarity = 100;
  const highScale = movementFamiliarityScale(state, { x: 750, y: 380 });
  assert.equal(highScale, 1);
});

test('different coordinates resolve to different regions', () => {
  // Coop center area -> 'coop-yard'
  assert.equal(yardRegionFor({ x: 1127, y: 311 }), 'coop-yard');

  // Upper side area -> 'upper-wilds'
  assert.equal(yardRegionFor({ x: 164, y: 185 }), 'upper-wilds');

  // Main path -> 'main-path'
  assert.equal(yardRegionFor({ x: 750, y: 500 }), 'main-path');

  // Lower-left tree area -> 'left-tree'
  assert.equal(yardRegionFor({ x: 260, y: 748 }), 'left-tree');

  // Lower-right planting area -> 'planting-zone'
  assert.equal(yardRegionFor({ x: 1120, y: 780 }), 'planting-zone');
});

test('regionFamiliarityFor returns correct value for point', () => {
  const state = createYardFamiliarityState();
  state.regions['coop-yard'].familiarity = 75;
  assert.equal(regionFamiliarityFor(state, { x: 1127, y: 311 }), 75);
});

test('canShowTip is true for unseen region, false after tip shown', () => {
  const state = createYardFamiliarityState();
  const result = recordRegionExploration(state, { x: 164, y: 185 }, 1, 1);
  assert.equal(result.canShowTip, true);
  assert.equal(result.region, 'upper-wilds');

  markTipShownForRegion(state, 'upper-wilds');
  const result2 = recordRegionExploration(state, { x: 164, y: 185 }, 1, 1);
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
      'coop-yard': { familiarity: 30, firstSeenDay: 2, tipShown: true },
    },
  };
  const state = restoreYardFamiliarityState(saved);
  assert.equal(state.regions['coop-yard'].tipShown, true);
  assert.equal(state.regions['coop-yard'].familiarity, 30);
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
