export type HomeCallEvent = 'cluck' | 'heard' | 'door-open' | 'reset';
export type DuskEscortPhase = 'escorting' | 'coop-open' | 'feed-placed' | 'inside';

export interface HomeCallState {
  count: number;
  lastCluckAt: number;
  heardInside: boolean;
}

export interface DuskCollectionState {
  phase: DuskEscortPhase;
  homeCall: HomeCallState;
}

export interface EscortBehavior {
  followRange: number;
  preferredDistance: number;
  speed: number;
  homeBias: number;
}

export const HOME_CALL_HEARD_COUNT = 2;
export const HOME_CALL_OPEN_COUNT = 5;
export const HOME_CALL_MAX_GAP = 2.2;
export const HOME_CALL_HOLD_INTERVAL = 0.72;
export const COOP_FEED_NOTICE_RANGE = 190;
export const DUSK_PRESSURE_TIME_SCALE = 0.28;

export function createDuskCollectionState(): DuskCollectionState {
  return {
    phase: 'escorting',
    homeCall: {
      count: 0,
      lastCluckAt: Number.NEGATIVE_INFINITY,
      heardInside: false,
    },
  };
}

export function registerHomeCluck(state: HomeCallState, nowSeconds: number): HomeCallEvent {
  const now = Number.isFinite(nowSeconds) ? nowSeconds : 0;
  if (now - state.lastCluckAt > HOME_CALL_MAX_GAP) {
    state.count = 0;
    state.heardInside = false;
  }

  state.lastCluckAt = now;
  state.count = Math.min(HOME_CALL_OPEN_COUNT, state.count + 1);

  if (state.count >= HOME_CALL_OPEN_COUNT) return 'door-open';
  if (state.count >= HOME_CALL_HEARD_COUNT && !state.heardInside) {
    state.heardInside = true;
    return 'heard';
  }
  return 'cluck';
}

export function expireHomeCall(state: HomeCallState, nowSeconds: number): HomeCallEvent | null {
  if (state.count === 0 || nowSeconds - state.lastCluckAt <= HOME_CALL_MAX_GAP) return null;
  state.count = 0;
  state.heardInside = false;
  return 'reset';
}

export function escortBehaviorFor(affection: number): EscortBehavior {
  if (affection >= 85) {
    return { followRange: 340, preferredDistance: 66, speed: 94, homeBias: 0.42 };
  }
  if (affection >= 60) {
    return { followRange: 275, preferredDistance: 70, speed: 86, homeBias: 0.2 };
  }
  if (affection >= 35) {
    return { followRange: 210, preferredDistance: 64, speed: 76, homeBias: 0.08 };
  }
  return { followRange: 150, preferredDistance: 58, speed: 66, homeBias: 0 };
}

export function openCoopDoor(state: DuskCollectionState) {
  if (state.phase !== 'escorting') return false;
  state.phase = 'coop-open';
  return true;
}

export function placeCoopFeed(state: DuskCollectionState) {
  if (state.phase !== 'coop-open') return false;
  state.phase = 'feed-placed';
  return true;
}

export function markChickenInside(state: DuskCollectionState) {
  if (state.phase !== 'feed-placed') return false;
  state.phase = 'inside';
  return true;
}

export function canCloseCoopDoor(state: DuskCollectionState) {
  return state.phase === 'inside';
}
