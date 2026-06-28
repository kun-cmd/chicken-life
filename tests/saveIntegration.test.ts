import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSaveEnvelope, writeSaveEnvelope } from '../src/game/persistence/saveGame';
import { createGameState, restoreGameState, setChickenName } from '../src/game/simulation/state';

class MemoryStorage {
  value: string | null = null;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    this.value = value;
  }
}

test('name survives save encoding and state restoration', () => {
  const storage = new MemoryStorage();
  const state = createGameState();
  setChickenName(state, '<小花>');
  writeSaveEnvelope(storage, state, 12);
  const loaded = loadSaveEnvelope(storage);
  assert.equal(loaded.kind, 'loaded');
  if (loaded.kind !== 'loaded') return;
  const restored = restoreGameState(loaded.state);
  assert.equal(restored.profile.name, '<小花>');
  assert.equal(restored.profile.named, true);
});
