import assert from 'node:assert/strict';
import test from 'node:test';
import { YARD_LAMP_POSITION } from '../src/game/content/yardUpgrades';
import {
  buildHudSnapshot,
  createGameState,
  isNearLight,
} from '../src/game/simulation/state';

test('HUD snapshot copies the album and yard state for the notebook', () => {
  const state = createGameState();
  state.yard.wood = 4;
  state.yard.pendingWood = 1;
  state.yard.owned.push('yard-lamp');
  state.eggArchive.push({
    type: 'balanced',
    name: '圆润蛋',
    budget: 3,
    count: 1,
  });

  const snapshot = buildHudSnapshot(state, false);
  assert.deepEqual(snapshot.yard, { wood: 4, pendingWood: 1, owned: ['yard-lamp'] });
  assert.equal(snapshot.eggArchive[0].name, '普通蛋');
  assert.equal(snapshot.eggArchive[0].budget, 3);

  snapshot.yard.owned.push('coop-ramp');
  snapshot.eggArchive[0].count = 9;
  assert.deepEqual(state.yard.owned, ['yard-lamp']);
  assert.equal(state.eggArchive[0].count, 1);
});

test('yard lamp only becomes a light source after it is built', () => {
  assert.equal(isNearLight(YARD_LAMP_POSITION, 0), false);
  assert.equal(isNearLight(YARD_LAMP_POSITION, 0, true), true);
});
