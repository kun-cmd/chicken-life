import assert from 'node:assert/strict';
import test from 'node:test';
import { isInsideRect } from '../src/game/content/yard';
import {
  BASKETBALL_BACKBOARD,
  BASKETBALL_RADIUS,
  BASKETBALL_HOOP_DROP,
  BASKETBALL_HOOP_RIM,
  advanceBasketball,
  createBasketballState,
  holdBasketball,
  kickBasketball,
  syncHeldBasketball,
  throwBasketball,
} from '../src/game/systems/basketball';

test('basketball can be kicked in the facing direction and slows over time', () => {
  const ball = createBasketballState();
  assert.equal(kickBasketball(ball, { x: -1, y: 0 }), true);
  assert.ok(ball.vx < 0);

  const initialSpeed = Math.hypot(ball.vx, ball.vy);
  advanceBasketball(ball, 0.5, []);
  assert.ok(Math.hypot(ball.vx, ball.vy) < initialSpeed);
});

test('basketball can be kicked upward and downward', () => {
  const upward = createBasketballState();
  assert.equal(kickBasketball(upward, { x: 0, y: -1 }), true);
  assert.equal(upward.vx, 0);
  assert.ok(upward.vy < 0);

  const downward = createBasketballState();
  assert.equal(kickBasketball(downward, { x: 0, y: 1 }), true);
  assert.equal(downward.vx, 0);
  assert.ok(downward.vy > 0);
});

test('airborne basketball scores when it passes through the rim', () => {
  const ball = createBasketballState();
  ball.x = BASKETBALL_HOOP_RIM.x;
  ball.y = BASKETBALL_HOOP_RIM.y + 64;
  ball.z = 64;
  ball.vz = -20;

  const result = advanceBasketball(ball, 0.016, []);

  assert.equal(result.scored, true);
  assert.equal(ball.scoredCount, 1);
  assert.equal(ball.x, BASKETBALL_HOOP_DROP.x);
  assert.equal(ball.y, BASKETBALL_HOOP_DROP.y);
  assert.ok(ball.z > 0);

  for (let i = 0; i < 80; i += 1) {
    advanceBasketball(ball, 1 / 120, []);
    if (ball.z <= 0 && ball.vz === 0) break;
  }

  assert.equal(ball.y, 850);
  assert.equal(ball.z, 0);
});

test('horizontal throws keep their launch y and mirror left and right', () => {
  const left = createBasketballState();
  left.x = 900;
  left.y = 1050;
  throwBasketball(left, { x: -1, y: 0 }, 0.92);
  const leftLaunchY = left.y;

  const right = createBasketballState();
  right.x = 600;
  right.y = 1050;
  throwBasketball(right, { x: 1, y: 0 }, 0.92);
  const rightLaunchY = right.y;

  assert.equal(left.vy, 0);
  assert.equal(right.vy, 0);
  assert.equal(Math.abs(left.vx), Math.abs(right.vx));
  assert.equal(left.vz, right.vz);

  advanceUntilGround(left);
  advanceUntilGround(right);

  assert.equal(left.y, leftLaunchY);
  assert.equal(right.y, rightLaunchY);
  assert.equal(left.z, 0);
  assert.equal(right.z, 0);
});

test('vertical throws keep their launch x until landing', () => {
  const up = createBasketballState();
  up.x = 900;
  up.y = 700;
  throwBasketball(up, { x: 0, y: -1 }, 0.7);
  const upLaunchX = up.x;

  const down = createBasketballState();
  down.x = 900;
  down.y = 700;
  throwBasketball(down, { x: 0, y: 1 }, 0.7);
  const downLaunchX = down.x;

  assert.equal(up.vx, 0);
  assert.equal(down.vx, 0);

  advanceUntilGround(up);
  advanceUntilGround(down);

  assert.equal(up.x, upLaunchX);
  assert.equal(down.x, downLaunchX);
  assert.equal(up.z, 0);
  assert.equal(down.z, 0);
});

test('airborne basketball bounces off the backboard', () => {
  const ball = createBasketballState();
  ball.x = BASKETBALL_BACKBOARD.x + BASKETBALL_BACKBOARD.width + 12;
  ball.y = BASKETBALL_BACKBOARD.y + 40;
  ball.z = 80;
  ball.vx = -180;

  const result = advanceBasketball(ball, 0.12, []);

  assert.equal(result.bounced, true);
  assert.ok(ball.vx > 0);
});

test('grounded basketball unsticks itself from blockers', () => {
  const blocker = { x: 100, y: 100, width: 120, height: 90 };
  const ball = createBasketballState();
  ball.x = 150;
  ball.y = 140;
  ball.vx = 0;
  ball.vy = 0;
  ball.z = 0;

  const result = advanceBasketball(ball, 1 / 60, [blocker]);

  assert.equal(result.bounced, true);
  assert.equal(isInsideRect(ball, blocker, BASKETBALL_RADIUS), false);
});

test('airborne basketball unsticks itself from the backboard', () => {
  const ball = createBasketballState();
  ball.x = BASKETBALL_BACKBOARD.x + 8;
  ball.y = BASKETBALL_BACKBOARD.y + 40;
  ball.z = 80;
  ball.vx = 0;
  ball.vy = 0;

  const result = advanceBasketball(ball, 1 / 60, []);

  assert.equal(result.bounced, true);
  assert.equal(isInsideRect(ball, BASKETBALL_BACKBOARD, BASKETBALL_RADIUS), false);
});

test('basketball can be shot from the requested yard spot', () => {
  const ball = createBasketballState();
  const human = { x: 960, y: 850 };
  const facing = { x: -1, y: 0 };
  holdBasketball(ball);
  syncHeldBasketball(ball, human, facing);
  throwBasketball(ball, facing, 0.92);

  let scored = false;
  for (let i = 0; i < 240; i += 1) {
    const result = advanceBasketball(ball, 1 / 120, []);
    if (result.scored) {
      scored = true;
      break;
    }
    if (ball.z <= 0 && ball.vz === 0) break;
  }

  assert.equal(scored, true);
});

function advanceUntilGround(ball: ReturnType<typeof createBasketballState>) {
  for (let i = 0; i < 240; i += 1) {
    advanceBasketball(ball, 1 / 120, []);
    if (ball.z <= 0 && ball.vz === 0) break;
  }
}
