import type { Vec2 } from '../simulation/state';

export type WeaselPhase = 'stalking' | 'chasing' | 'repelled';
export type WeaselOutcome = 'active' | 'repelled' | 'caught' | 'safe';

export interface WeaselEncounterState {
  position: Vec2;
  phase: WeaselPhase;
  lightExposure: number;
}

export interface WeaselContext {
  dt: number;
  chicken: Vec2;
  chickenInCoop: boolean;
  coopDoorClosed: boolean;
  illuminated: boolean;
  humanBlocking: boolean;
  speedScale?: number;
}

export function createWeaselEncounter(position: Vec2): WeaselEncounterState {
  return { position: { ...position }, phase: 'stalking', lightExposure: 0 };
}

export function updateWeaselEncounter(
  state: WeaselEncounterState,
  context: WeaselContext,
): { state: WeaselEncounterState; outcome: WeaselOutcome } {
  if (state.phase === 'repelled') return { state, outcome: 'repelled' };
  if (context.chickenInCoop && context.coopDoorClosed) {
    return { state: { ...state, phase: 'repelled' }, outcome: 'safe' };
  }

  const dt = Math.max(0, context.dt);
  const lightExposure = context.illuminated
    ? state.lightExposure + dt
    : Math.max(0, state.lightExposure - dt * 0.5);
  if (lightExposure >= 1.5) {
    return {
      state: { ...state, phase: 'repelled', lightExposure },
      outcome: 'repelled',
    };
  }

  const dx = context.chicken.x - state.position.x;
  const dy = context.chicken.y - state.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 32 && !context.humanBlocking) {
    return { state: { ...state, lightExposure }, outcome: 'caught' };
  }

  const phase: WeaselPhase = distance < 240 ? 'chasing' : 'stalking';
  const speed =
    (phase === 'chasing' ? 112 : 62) *
    (context.illuminated ? 0.35 : 1) *
    (context.speedScale ?? 1);
  const length = Math.max(distance, 1);
  const position = {
    x: state.position.x + (dx / length) * speed * dt,
    y: state.position.y + (dy / length) * speed * dt,
  };
  return {
    state: { position, phase, lightExposure },
    outcome: 'active',
  };
}

export function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function isHumanBlocking(human: Vec2, chicken: Vec2, weasel: Vec2) {
  return distanceToSegment(human, chicken, weasel) <= 42;
}
