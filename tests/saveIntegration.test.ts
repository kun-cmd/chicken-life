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

test('legacy saves shift yard entity coordinates after upper map expansion', () => {
  const restored = restoreGameState({
    flow: { day: 4, phase: 'chicken-day', morningEggFound: true, duskStarted: false },
    chicken: { x: 320, y: 640 },
    human: { x: 760, y: 448 },
    keeper: {
      x: 760,
      y: 448,
      active: false,
      returning: false,
      doneFeeding: true,
      rescuing: false,
      routeIndex: 0,
      scatterCooldown: 0,
      facing: 1,
    },
    weasel: { x: -80, y: 820, active: false, chasing: false, stunned: 0 },
    foods: [{ id: 99, type: 'grain', x: 400, y: 500, visibleAt: 0 }],
    holes: [
      {
        id: 7,
        x: 500,
        y: 660,
        dugDay: 3,
        lastUsedDay: 3,
        restPower: 12,
        depth: 2,
        moisture: 0.2,
        useSeconds: 8,
        kind: 'fresh',
      },
    ],
    animals: [
      {
        id: 8,
        type: 'sparrow',
        x: 600,
        y: 580,
        active: true,
        scared: false,
        phase: 'stealing',
        facing: 1,
      },
    ],
    weaselEncounter: {
      phase: 'lurking',
      position: { x: 1200, y: 700 },
      target: { x: 900, y: 640 },
      lightExposure: 0,
      warningSeconds: 0,
      phaseSeconds: 0,
    },
  });

  assert.equal(restored.yardMapRevision, 2);
  assert.equal(restored.chicken.y, 860);
  assert.equal(restored.human.y, 668);
  assert.equal(restored.keeper.y, 668);
  assert.equal(restored.weasel.y, 1040);
  assert.equal(restored.foods[0].y, 720);
  assert.equal(restored.holes[0].y, 880);
  assert.equal(restored.animals[0].y, 800);
  assert.equal(restored.weaselEncounter?.position.y, 920);
  assert.equal(restored.weaselEncounter?.target?.y, 860);
});
