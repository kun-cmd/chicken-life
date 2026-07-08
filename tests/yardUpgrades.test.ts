import assert from 'node:assert/strict';
import test from 'node:test';
import { YARD_UPGRADES } from '../src/game/content/yardUpgrades';
import {
  advanceFacilityActivity,
  buyUpgrade,
  coopEntryRadius,
  createFacilityLifeState,
  createYardUpgradeState,
  deliverPendingWood,
  doorCloseDurationMs,
  ownedFacilityAt,
  resetFacilityLifeDay,
  startFacilityActivity,
} from '../src/game/systems/yardUpgrades';

test('core-loop upgrades use the approved dynamic-budget prices', () => {
  assert.equal(YARD_UPGRADES.find((item) => item.id === 'yard-lamp')?.cost, 2);
  assert.equal(YARD_UPGRADES.find((item) => item.id === 'water-basin')?.cost, 3);
  assert.equal(YARD_UPGRADES.find((item) => item.id === 'coop-roof')?.cost, 5);
});

test('delivers pending wood at the next morning', () => {
  const state = createYardUpgradeState();
  state.pendingWood = 2;
  assert.equal(deliverPendingWood(state), 2);
  assert.deepEqual(state, { wood: 2, pendingWood: 0, owned: [] });
});

test('buys each upgrade once without negative wood', () => {
  const state = createYardUpgradeState();
  state.wood = 3;
  assert.equal(buyUpgrade(state, 'yard-lamp'), true);
  assert.equal(buyUpgrade(state, 'yard-lamp'), false);
  assert.equal(buyUpgrade(state, 'water-basin'), false);
  assert.equal(state.wood, 1);
});

test('coop upgrades ease the dusk ritual without replacing it', () => {
  const state = createYardUpgradeState();
  assert.equal(coopEntryRadius(state), 34);
  assert.equal(doorCloseDurationMs(state), 850);
  state.owned.push('coop-ramp', 'door-latch');
  assert.equal(coopEntryRadius(state), 56);
  assert.equal(doorCloseDurationMs(state), 300);
});

test('owned life facilities expose their world zones', () => {
  const yard = createYardUpgradeState();
  assert.equal(ownedFacilityAt(yard, { x: 610, y: 565 }), null);
  yard.owned.push('shade-shelter');
  assert.equal(ownedFacilityAt(yard, { x: 610, y: 565 }), null);
  assert.equal(ownedFacilityAt(yard, { x: 930, y: 600 }), 'shade-shelter');
});

test('facility activity lasts four seconds and records progress once per day', () => {
  const life = createFacilityLifeState();
  assert.equal(startFacilityActivity(life, 'shade-rest'), true);
  assert.equal(advanceFacilityActivity(life, 3.9), null);
  assert.deepEqual(advanceFacilityActivity(life, 0.1), {
    activity: 'shade-rest',
    firstToday: true,
  });

  life.needsMovement = false;
  assert.equal(startFacilityActivity(life, 'perch-idle'), true);
  assert.equal(advanceFacilityActivity(life, 4)?.firstToday, false);
  resetFacilityLifeDay(life);
  assert.equal(life.restedToday, false);
});
