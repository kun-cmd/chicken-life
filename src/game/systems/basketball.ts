import type { Rect, Vec2 } from '../simulation/state';
import { distance, isInsideRect, WORLD_HEIGHT, WORLD_WIDTH } from '../content/yard';

export interface BasketballState extends Vec2 {
  vx: number;
  vy: number;
  z: number;
  vz: number;
  heldBy: 'human' | null;
  scoredCount: number;
}

export const BASKETBALL_START: Vec2 = { x: 1400, y: 600 };
export const BASKETBALL_HOOP_BASE: Vec2 = { x: 550, y: 800 };
export const BASKETBALL_HOOP_RIM: Vec2 = { x: 596, y: 708 };
export const BASKETBALL_BACKBOARD: Rect = { x: 538, y: 650, width: 18, height: 96 };
export const BASKETBALL_HOOP_DROP: Vec2 = { x: BASKETBALL_HOOP_RIM.x + 42, y: 850 };
export const BASKETBALL_RADIUS = 18;
export const BASKETBALL_GRAVITY = 1180;
export const BASKETBALL_THROW_POWER_MIN = 0.2;
export const BASKETBALL_THROW_POWER_MAX = 1.45;

const BALL_FRICTION = 2.35;
const BALL_RESTITUTION = 0.62;
const MIN_ROLL_SPEED = 8;
const THROW_BASE_SPEED = 250;
const THROW_POWER_SPEED = 125;
const THROW_BASE_LIFT = 500;
const THROW_POWER_LIFT = 200;
const SCORE_DROP_START_Y = BASKETBALL_HOOP_RIM.y + 20;
const SCORE_DROP_VZ = -80;
const COLLISION_UNSTICK_EPSILON = 0.5;
const COLLISION_UNSTICK_SPEED = 36;

export function createBasketballState(): BasketballState {
  return {
    ...BASKETBALL_START,
    vx: 0,
    vy: 0,
    z: 0,
    vz: 0,
    heldBy: null,
    scoredCount: 0,
  };
}

export function restoreBasketballState(saved: Partial<BasketballState> | null | undefined): BasketballState {
  const fresh = createBasketballState();
  if (!saved || typeof saved !== 'object') return fresh;
  return {
    x: finiteNumber(saved.x, fresh.x),
    y: finiteNumber(saved.y, fresh.y),
    vx: finiteNumber(saved.vx, 0),
    vy: finiteNumber(saved.vy, 0),
    z: Math.max(0, finiteNumber(saved.z, 0)),
    vz: finiteNumber(saved.vz, 0),
    heldBy: saved.heldBy === 'human' ? 'human' : null,
    scoredCount: Math.max(0, Math.floor(finiteNumber(saved.scoredCount, 0))),
  };
}

export function syncHeldBasketball(ball: BasketballState, holder: Vec2, facing: Vec2) {
  const side = Math.abs(facing.x) >= Math.abs(facing.y) ? Math.sign(facing.x || 1) : 0;
  ball.x = holder.x + side * 34;
  ball.y = holder.y + 24;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.z = 0;
}

export function kickBasketball(ball: BasketballState, facing: Vec2) {
  if (ball.heldBy) return false;
  const direction = normalize(facing.x, facing.y);
  ball.vx = direction.x * 520;
  ball.vy = direction.y * 520;
  ball.z = 0;
  ball.vz = 0;
  return true;
}

export function holdBasketball(ball: BasketballState) {
  if (ball.heldBy) return false;
  ball.heldBy = 'human';
  ball.vx = 0;
  ball.vy = 0;
  ball.z = 0;
  ball.vz = 0;
  return true;
}

export function throwBasketball(ball: BasketballState, facing: Vec2, power: number) {
  const direction = basketballThrowDirection(ball, facing);
  const { speed, lift } = basketballThrowVelocity(power);
  ball.heldBy = null;
  ball.vx = direction.x * speed;
  ball.vy = direction.y * speed;
  ball.z = 26;
  ball.vz = lift;
}

export function basketballThrowVelocity(power: number) {
  const clampedPower = Math.max(BASKETBALL_THROW_POWER_MIN, Math.min(BASKETBALL_THROW_POWER_MAX, power));
  return {
    speed: THROW_BASE_SPEED + clampedPower * THROW_POWER_SPEED,
    lift: THROW_BASE_LIFT + clampedPower * THROW_POWER_LIFT,
  };
}

export function basketballThrowDirection(ball: Vec2, facing: Vec2) {
  if (Math.abs(facing.x) >= Math.abs(facing.y)) {
    return { x: Math.sign(facing.x || ball.x - BASKETBALL_HOOP_RIM.x || 1), y: 0 };
  }
  return { x: 0, y: Math.sign(facing.y || 1) };
}

export function basketballDisplayPosition(ball: BasketballState): Vec2 {
  return { x: ball.x, y: ball.y - ball.z };
}

export function advanceBasketball(
  ball: BasketballState,
  dt: number,
  blockers: readonly Rect[],
) {
  if (ball.heldBy) return { bounced: false, scored: false };

  let bounced = false;
  const previous = { x: ball.x, y: ball.y };
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.z > 0 || ball.vz !== 0) {
    ball.z += ball.vz * dt;
    ball.vz -= BASKETBALL_GRAVITY * dt;
    if (ball.z <= 0) {
      ball.z = 0;
      ball.vz = 0;
      ball.vx *= 0.72;
      ball.vy *= 0.72;
    }
  } else {
    const damp = Math.max(0, 1 - BALL_FRICTION * dt);
    ball.vx *= damp;
    ball.vy *= damp;
    if (Math.hypot(ball.vx, ball.vy) < MIN_ROLL_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }

  if (ball.x < BASKETBALL_RADIUS || ball.x > WORLD_WIDTH - BASKETBALL_RADIUS) {
    ball.x = Math.max(BASKETBALL_RADIUS, Math.min(WORLD_WIDTH - BASKETBALL_RADIUS, ball.x));
    ball.vx *= -BALL_RESTITUTION;
    bounced = true;
  }
  if (ball.y < BASKETBALL_RADIUS || ball.y > WORLD_HEIGHT - BASKETBALL_RADIUS) {
    ball.y = Math.max(BASKETBALL_RADIUS, Math.min(WORLD_HEIGHT - BASKETBALL_RADIUS, ball.y));
    ball.vy *= -BALL_RESTITUTION;
    bounced = true;
  }

  if (ball.z < 24) {
    for (const blocker of blockers) {
      if (!resolveRectCollision(ball, previous, blocker, BASKETBALL_RADIUS)) continue;
      bounced = true;
      break;
    }
  }

  if (
    ball.z >= 18 &&
    ball.z <= 180 &&
    isInsideRect(ball, BASKETBALL_BACKBOARD, BASKETBALL_RADIUS)
  ) {
    resolveRectCollision(ball, previous, BASKETBALL_BACKBOARD, BASKETBALL_RADIUS);
    ball.vz *= 0.86;
    bounced = true;
  }

  const scored =
    ball.z >= 58 &&
    ball.z <= 170 &&
    ball.vz < 140 &&
    distance(basketballDisplayPosition(ball), BASKETBALL_HOOP_RIM) < 30;
  if (scored) {
    ball.scoredCount += 1;
    ball.x = BASKETBALL_HOOP_DROP.x;
    ball.y = BASKETBALL_HOOP_DROP.y;
    ball.z = BASKETBALL_HOOP_DROP.y - SCORE_DROP_START_Y;
    ball.vz = SCORE_DROP_VZ;
    ball.vx = 0;
    ball.vy = 0;
  }

  return { bounced, scored };
}

function finiteNumber(value: unknown, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function resolveRectCollision(
  ball: BasketballState,
  previous: Vec2,
  rect: Rect,
  radius: number,
) {
  if (!isInsideRect(ball, rect, radius)) return false;

  const previousInside = isInsideRect(previous, rect);
  const xOnly = { x: previous.x, y: ball.y };
  const yOnly = { x: ball.x, y: previous.y };
  if (!previousInside && !isInsideRect(xOnly, rect, radius)) {
    ball.x = previous.x;
    ball.vx *= -BALL_RESTITUTION;
    return true;
  }
  if (!previousInside && !isInsideRect(yOnly, rect, radius)) {
    ball.y = previous.y;
    ball.vy *= -BALL_RESTITUTION;
    return true;
  }
  if (!previousInside) {
    ball.x = previous.x;
    ball.y = previous.y;
    ball.vx *= -BALL_RESTITUTION;
    ball.vy *= -BALL_RESTITUTION;
    return true;
  }

  pushBallOutOfRect(ball, rect, radius);
  return true;
}

function pushBallOutOfRect(ball: BasketballState, rect: Rect, radius: number) {
  const left = rect.x - radius;
  const right = rect.x + rect.width + radius;
  const top = rect.y - radius;
  const bottom = rect.y + rect.height + radius;
  const exits = [
    { axis: 'x' as const, side: -1, distance: Math.abs(ball.x - left), value: left - COLLISION_UNSTICK_EPSILON },
    { axis: 'x' as const, side: 1, distance: Math.abs(right - ball.x), value: right + COLLISION_UNSTICK_EPSILON },
    { axis: 'y' as const, side: -1, distance: Math.abs(ball.y - top), value: top - COLLISION_UNSTICK_EPSILON },
    { axis: 'y' as const, side: 1, distance: Math.abs(bottom - ball.y), value: bottom + COLLISION_UNSTICK_EPSILON },
  ];
  const exit = exits.reduce((best, next) => (next.distance < best.distance ? next : best));
  const speed = Math.max(
    Math.abs(exit.axis === 'x' ? ball.vx : ball.vy) * BALL_RESTITUTION,
    COLLISION_UNSTICK_SPEED,
  );
  if (exit.axis === 'x') {
    ball.x = exit.value;
    ball.vx = exit.side * speed;
  } else {
    ball.y = exit.value;
    ball.vy = exit.side * speed;
  }
}

function normalize(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  if (!length) return { x: 1, y: 0 };
  return { x: x / length, y: y / length };
}
