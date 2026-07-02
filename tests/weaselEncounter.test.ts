import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeaselEncounter,
  isHumanBlocking,
  updateWeaselEncounter,
} from '../src/game/systems/weaselEncounter';

test('closed coop is absolutely safe', () => {
  const state = createWeaselEncounter({ x: 100, y: 100 });
  const result = updateWeaselEncounter(state, {
    dt: 1,
    chicken: { x: 100, y: 100 },
    chickenInCoop: true,
    coopDoorClosed: true,
    illuminated: false,
    humanBlocking: false,
  });
  assert.equal(result.outcome, 'safe');
  assert.equal(result.state.phase, 'repelled');
});

test('continuous light repels the weasel', () => {
  let state = createWeaselEncounter({ x: 100, y: 100 });
  let outcome = 'active';
  for (let index = 0; index < 4; index += 1) {
    const result = updateWeaselEncounter(state, {
      dt: 0.5,
      chicken: { x: 300, y: 100 },
      chickenInCoop: false,
      coopDoorClosed: false,
      illuminated: true,
      humanBlocking: false,
    });
    state = result.state;
    outcome = result.outcome;
  }
  assert.equal(outcome, 'repelled');
});

test('contact catches an unprotected chicken', () => {
  const result = updateWeaselEncounter(createWeaselEncounter({ x: 100, y: 100 }), {
    dt: 0.1,
    chicken: { x: 105, y: 100 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
  });
  assert.equal(result.outcome, 'caught');
});

test('detects a human standing between chicken and weasel', () => {
  assert.equal(
    isHumanBlocking(
      { x: 100, y: 100 },
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ),
    true,
  );
});

test('teaching encounter can run at reduced pursuit speed', () => {
  const state = createWeaselEncounter({ x: 0, y: 0 });
  const normal = updateWeaselEncounter(state, {
    dt: 1,
    chicken: { x: 500, y: 0 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
  });
  const teaching = updateWeaselEncounter(state, {
    dt: 1,
    chicken: { x: 500, y: 0 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
    speedScale: 0.75,
  });
  assert.equal(teaching.state.position.x, normal.state.position.x * 0.75);
});
