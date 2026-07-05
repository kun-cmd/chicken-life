import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHudSnapshot,
  createGameState,
  restoreGameState,
  setChickenName,
} from '../src/game/simulation/state';

test('new state requires naming', () => {
  const state = createGameState();
  assert.equal(state.profile.named, false);
  assert.equal(buildHudSnapshot(state, false).requiresNaming, true);
});

test('setting the chicken name updates state and hud', () => {
  const state = createGameState();
  setChickenName(state, ' 小花 ');
  assert.equal(state.profile.name, '小花');
  assert.equal(state.profile.named, true);
  assert.equal(buildHudSnapshot(state, false).chickenName, '小花');
});

test('restore fills missing profile fields safely', () => {
  const restored = restoreGameState({ day: 3, profile: { name: '点点', named: true } });
  assert.equal(restored.profile.name, '点点');
  assert.equal(restored.profile.awakenedAbilities.peck, true);
  assert.equal(restored.profile.awakenedAbilities.sprint, true);
});
