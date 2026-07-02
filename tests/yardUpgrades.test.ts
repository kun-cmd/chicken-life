import assert from 'node:assert/strict';
import test from 'node:test';
import { YARD_UPGRADES } from '../src/game/content/yardUpgrades';
import {
  buyUpgrade,
  coopEntryRadius,
  createYardUpgradeState,
  deliverPendingWood,
  doorCloseDurationMs,
} from '../src/game/systems/yardUpgrades';

test('all six upgrades cost twelve wood in total', () => {
  assert.equal(YARD_UPGRADES.length, 6);
  assert.equal(YARD_UPGRADES.reduce((sum, item) => sum + item.cost, 0), 12);
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
  assert.equal(buyUpgrade(state, 'door-latch'), false);
  assert.equal(state.wood, 0);
});

test('coop upgrades ease the dusk ritual without replacing it', () => {
  const state = createYardUpgradeState();
  assert.equal(coopEntryRadius(state), 34);
  assert.equal(doorCloseDurationMs(state), 850);
  state.owned.push('coop-ramp', 'door-latch');
  assert.equal(coopEntryRadius(state), 56);
  assert.equal(doorCloseDurationMs(state), 300);
});
