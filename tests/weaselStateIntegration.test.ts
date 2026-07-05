import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGameState,
  resolveWeaselOutcome,
  restoreGameState,
} from '../src/game/simulation/state';
import { createWeaselEncounter } from '../src/game/systems/weaselEncounter';
import { createWeaselSchedule } from '../src/game/systems/weaselSchedule';

test('caught outcome marks the day but does not remove wood or relationship', () => {
  const state = createGameState();
  state.yard.wood = 4;
  state.relationship.memories = 9;
  state.weaselEncounter = createWeaselEncounter({ x: 10, y: 10 });
  resolveWeaselOutcome(state, 'caught');
  assert.equal(state.caughtToday, true);
  assert.equal(state.yard.wood, 4);
  assert.equal(state.relationship.memories, 9);
  assert.equal(state.weaselEncounter, null);
  assert.equal(state.weaselEncounterDoneToday, true);
});

test('repelling the first encounter records one relationship memory', () => {
  const state = createGameState();
  state.weaselEncounter = createWeaselEncounter({ x: 10, y: 10 });
  resolveWeaselOutcome(state, 'repelled');
  assert.equal(state.relationship.memories, 1);
  assert.equal(state.relationship.rescueRecorded, true);
});

test('restores encounter position independently and restores schedule fallback', () => {
  const state = createGameState();
  state.weaselEncounter = createWeaselEncounter({ x: 40, y: 50 }, 1.2);
  const restored = restoreGameState({
    ...state,
    weaselSchedule: undefined,
  });
  assert.deepEqual(restored.weaselSchedule, createWeaselSchedule(state.profile.runSeed));
  assert.deepEqual(restored.weaselEncounter?.position, { x: 40, y: 50 });
  restored.weaselEncounter!.position.x = 99;
  assert.equal(state.weaselEncounter!.position.x, 40);
});
