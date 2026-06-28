import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  loadSaveEnvelope,
  writeSaveEnvelope,
} from '../src/game/persistence/saveGame';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('round trips a version three save envelope', () => {
  const storage = new MemoryStorage();
  const state = { profile: { name: '小花' }, day: 4 };
  assert.equal(writeSaveEnvelope(storage, state, 100), true);
  assert.deepEqual(loadSaveEnvelope(storage), {
    kind: 'loaded',
    state,
    savedAt: 100,
  });
});

test('reports a legacy prototype save without parsing it as v3', () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_SAVE_KEY, '{"version":2,"state":{"day":9}}');
  assert.deepEqual(loadSaveEnvelope(storage), { kind: 'legacy' });
});

test('treats malformed v3 JSON as empty', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, '{');
  assert.deepEqual(loadSaveEnvelope(storage), { kind: 'empty' });
});

test('treats blocked browser storage as empty', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(loadSaveEnvelope(storage), { kind: 'empty' });
  assert.equal(writeSaveEnvelope(storage, {}), false);
});
