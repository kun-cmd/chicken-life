import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRelationshipState,
  recordTrustMemory,
  relationshipStage,
} from '../src/game/systems/relationship';

test('records each daily memory category only once', () => {
  const state = createRelationshipState();
  assert.equal(recordTrustMemory(state, 1, 'close-interaction'), true);
  assert.equal(recordTrustMemory(state, 1, 'close-interaction'), false);
  assert.equal(recordTrustMemory(state, 1, 'safe-close'), true);
  assert.equal(state.memories, 2);
});

test('applies both memory thresholds and day gates', () => {
  const state = createRelationshipState();
  state.memories = 19;
  assert.equal(relationshipStage(state, 2), 'wary');
  assert.equal(relationshipStage(state, 3), 'familiar');
  assert.equal(relationshipStage(state, 7), 'trusting');
  assert.equal(relationshipStage(state, 11), 'bonded');
});

test('rescue is a one-time bonus and failure never removes memories', () => {
  const state = createRelationshipState();
  assert.equal(recordTrustMemory(state, 8, 'first-rescue'), true);
  assert.equal(recordTrustMemory(state, 10, 'first-rescue'), false);
  assert.equal(state.memories, 1);
});
