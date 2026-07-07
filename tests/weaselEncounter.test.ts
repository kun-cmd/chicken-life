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

test('light slows the weasel instead of clearing the encounter', () => {
  const state = {
    ...createWeaselEncounter({ x: 100, y: 100 }),
    phase: 'chasing' as const,
    phaseSeconds: 1,
  };
  const dark = updateWeaselEncounter(state, {
    dt: 0.5,
    chicken: { x: 300, y: 100 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
  });
  const lit = updateWeaselEncounter(state, {
    dt: 0.5,
    chicken: { x: 300, y: 100 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: true,
    humanBlocking: false,
  });
  assert.equal(lit.outcome, 'active');
  assert.ok(lit.state.position.x < dark.state.position.x);
});

test('contact marks a hit from any active pursuit phase instead of ending the night', () => {
  const state = {
    ...createWeaselEncounter({ x: 100, y: 100 }),
    phase: 'chasing' as const,
    warningSeconds: 0,
    phaseSeconds: 0.4,
    target: null,
  };
  const result = updateWeaselEncounter(state, {
    dt: 0.1,
    chicken: { x: 126, y: 100 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
  });
  assert.equal(result.outcome, 'caught');
  assert.equal(result.state.phase, 'panic');
});

test('a missed pounce becomes a short recovery before chasing again', () => {
  let state = {
    ...createWeaselEncounter({ x: 100, y: 100 }),
    phase: 'pouncing' as const,
    warningSeconds: 0,
    phaseSeconds: 0.12,
    target: { x: 230, y: 100 },
  };
  let result = updateWeaselEncounter(state, {
    dt: 0.2,
    chicken: { x: 430, y: 100 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
  });
  assert.equal(result.outcome, 'active');
  assert.equal(result.state.phase, 'panic');

  state = result.state;
  result = updateWeaselEncounter(state, {
    dt: 0.7,
    chicken: { x: 430, y: 100 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
  });
  assert.equal(result.state.phase, 'chasing');
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
  const state = {
    ...createWeaselEncounter({ x: 0, y: 0 }),
    phase: 'chasing' as const,
    warningSeconds: 0,
    phaseSeconds: 1,
  };
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
