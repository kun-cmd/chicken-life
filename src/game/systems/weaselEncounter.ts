import type { Vec2 } from '../simulation/state';

export type WeaselPhase = 'lurking' | 'pouncing' | 'panic' | 'retreating' | 'repelled';
export type WeaselOutcome = 'active' | 'repelled' | 'caught' | 'safe';

export interface WeaselEncounterState {
  position: Vec2;
  phase: WeaselPhase;
  lightExposure: number;
  warningSeconds: number;
  phaseSeconds: number;
  target: Vec2 | null;
}

export interface WeaselContext {
  dt: number;
  chicken: Vec2;
  chickenInCoop: boolean;
  coopDoorClosed: boolean;
  illuminated: boolean;
  humanBlocking: boolean;
  contactEnabled?: boolean;
  retreatTarget?: Vec2;
  speedScale?: number;
}

export function createWeaselEncounter(position: Vec2, warningSeconds = 0): WeaselEncounterState {
  return {
    position: { ...position },
    phase: 'lurking',
    lightExposure: 0,
    warningSeconds: Math.max(0, warningSeconds),
    phaseSeconds: 0,
    target: null,
  };
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
  if (state.warningSeconds > 0) {
    return {
      state: { ...state, warningSeconds: Math.max(0, state.warningSeconds - dt) },
      outcome: 'active',
    };
  }
  const lightExposure = context.illuminated
    ? Math.min(1.5, state.lightExposure + dt)
    : Math.max(0, state.lightExposure - dt * 0.5);

  const dx = context.chicken.x - state.position.x;
  const dy = context.chicken.y - state.position.y;
  const distance = Math.hypot(dx, dy);
  const speedScale = (context.speedScale ?? 1) * (context.illuminated ? 0.58 : 1);
  const canContact = (context.contactEnabled ?? true) && !context.humanBlocking;

  if (state.phase === 'lurking') {
    return {
      state: {
        ...state,
        phase: 'pouncing',
        lightExposure,
        phaseSeconds: 0.62 + lightExposure * 0.18,
        target: { ...context.chicken },
      },
      outcome: 'active',
    };
  }

  if ((state.phase === 'pouncing' || state.phase === 'panic') && distance <= 32 && canContact) {
    return {
      state: { ...state, phase: 'panic', lightExposure, phaseSeconds: 1, target: null },
      outcome: 'caught',
    };
  }

  if (state.phase === 'pouncing') {
    const target = state.target ?? context.chicken;
    const tx = target.x - state.position.x;
    const ty = target.y - state.position.y;
    const targetDistance = Math.hypot(tx, ty);
    const step = 430 * speedScale * dt;
    const reachedTarget = targetDistance <= Math.max(12, step);
    const position = reachedTarget
      ? { ...target }
      : moveToward(state.position, target, step);
    const phaseSeconds = state.phaseSeconds - dt;
    if (phaseSeconds <= 0 || reachedTarget) {
      return {
        state: { position, phase: 'panic', lightExposure, warningSeconds: 0, phaseSeconds: 1, target: null },
        outcome: 'active',
      };
    }
    return {
      state: { ...state, position, lightExposure, warningSeconds: 0, phaseSeconds },
      outcome: 'active',
    };
  }

  if (state.phase === 'panic') {
    const phaseSeconds = state.phaseSeconds - dt;
    const position = moveToward(state.position, context.chicken, 148 * speedScale * dt);
    if (phaseSeconds <= 0) {
      return {
        state: {
          position,
          phase: 'retreating',
          lightExposure,
          warningSeconds: 0,
          phaseSeconds: 0,
          target: context.retreatTarget ? { ...context.retreatTarget } : null,
        },
        outcome: 'active',
      };
    }
    return {
      state: { ...state, position, lightExposure, warningSeconds: 0, phaseSeconds, target: null },
      outcome: 'active',
    };
  }

  if (state.phase === 'retreating') {
    const target = state.target ?? context.retreatTarget;
    if (!target) {
      return {
        state: { ...state, phase: 'lurking', lightExposure, warningSeconds: 2.1, phaseSeconds: 0, target: null },
        outcome: 'active',
      };
    }
    const retreatDistance = Math.hypot(target.x - state.position.x, target.y - state.position.y);
    const step = 238 * speedScale * dt;
    if (retreatDistance <= Math.max(24, step)) {
      return {
        state: {
          position: { ...target },
          phase: 'lurking',
          lightExposure,
          warningSeconds: 2.1 + lightExposure * 0.8,
          phaseSeconds: 0,
          target: null,
        },
        outcome: 'active',
      };
    }
    return {
      state: { ...state, position: moveToward(state.position, target, step), lightExposure, target: { ...target } },
      outcome: 'active',
    };
  }

  return {
    state: { ...state, lightExposure, warningSeconds: 0 },
    outcome: 'active',
  };
}

function moveToward(from: Vec2, to: Vec2, step: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0 || step <= 0) return { ...from };
  const ratio = Math.min(1, step / length);
  return {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
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
