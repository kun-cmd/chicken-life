import assert from 'node:assert/strict';
import test from 'node:test';
import { KeyboardState } from '../src/game/input/keyboardState';

test('tracks held movement keys until they are released', () => {
  const keyboard = new KeyboardState();
  keyboard.keyDown('KeyD', false);
  assert.equal(keyboard.isDown('KeyD'), true);
  keyboard.keyUp('KeyD');
  assert.equal(keyboard.isDown('KeyD'), false);
});

test('consumes an action press only once and ignores key repeat', () => {
  const keyboard = new KeyboardState();
  keyboard.keyDown('KeyE', false);
  keyboard.keyDown('KeyE', true);
  assert.equal(keyboard.consumePress('KeyE'), true);
  assert.equal(keyboard.consumePress('KeyE'), false);
});

test('reset releases held keys and pending presses', () => {
  const keyboard = new KeyboardState();
  keyboard.keyDown('ShiftLeft', false);
  keyboard.keyDown('Space', false);
  keyboard.reset();
  assert.equal(keyboard.isDown('ShiftLeft'), false);
  assert.equal(keyboard.consumePress('Space'), false);
});
