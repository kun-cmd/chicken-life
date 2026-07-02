export type HomeCallEvent = 'cluck' | 'heard' | 'door-open' | 'reset';
export type DuskEscortPhase = 'escorting' | 'coop-open' | 'inside';

export interface LureSeed {
  id: number;
  x: number;
  y: number;
}

export interface HomeCallState {
  count: number;
  lastCluckAt: number;
  heardInside: boolean;
}

export interface DuskCollectionState {
  phase: DuskEscortPhase;
  homeCall: HomeCallState;
  seeds: LureSeed[];
  nextSeedId: number;
  targetSeedId: number | null;
  scatterCooldown: number;
  eatPause: number;
  doorSeedPlaced: boolean;
}

export const HOME_CALL_HEARD_COUNT = 2;
export const HOME_CALL_OPEN_COUNT = 5;
export const HOME_CALL_MAX_GAP = 2.2;
export const HOME_CALL_HOLD_INTERVAL = 0.72;
export const DUSK_PRESSURE_TIME_SCALE = 0.28;
export const LURE_SEED_DROP_INTERVAL = 0.7;
export const LURE_SEED_EAT_PAUSE = 1;
export const LURE_SEED_MOVE_SPEED = 92;
export const COOP_FINAL_SEED_RANGE = 58;

export function createDuskCollectionState(): DuskCollectionState {
  return {
    phase: 'escorting',
    homeCall: {
      count: 0,
      lastCluckAt: Number.NEGATIVE_INFINITY,
      heardInside: false,
    },
    seeds: [],
    nextSeedId: 1,
    targetSeedId: null,
    scatterCooldown: 0,
    eatPause: 0,
    doorSeedPlaced: false,
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

export function visionRadiusFor(affection: number) {
  if (affection >= 85) return 330;
  if (affection >= 60) return 250;
  if (affection >= 35) return 180;
  return 120;
}

export function advanceDuskCollection(state: DuskCollectionState, dt: number) {
  state.scatterCooldown = Math.max(0, state.scatterCooldown - dt);
  state.eatPause = Math.max(0, state.eatPause - dt);
}

export function placeLureSeed(
  state: DuskCollectionState,
  position: { x: number; y: number },
  atCoopDoor = false,
) {
  if (state.phase !== 'escorting' || state.scatterCooldown > 0) return null;
  const seed = { id: state.nextSeedId++, x: position.x, y: position.y };
  state.seeds.push(seed);
  state.scatterCooldown = LURE_SEED_DROP_INTERVAL;
  if (atCoopDoor) state.doorSeedPlaced = true;
  return seed;
}

export function findLureSeedTarget(
  state: DuskCollectionState,
  chicken: { x: number; y: number },
  visionRadius: number,
) {
  const remembered = state.seeds.find((seed) => seed.id === state.targetSeedId);
  if (remembered) return remembered;

  let nearest: LureSeed | null = null;
  let nearestDistanceSquared = visionRadius * visionRadius;
  for (const seed of state.seeds) {
    const dx = seed.x - chicken.x;
    const dy = seed.y - chicken.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared <= nearestDistanceSquared) {
      nearest = seed;
      nearestDistanceSquared = distanceSquared;
    }
  }
  state.targetSeedId = nearest?.id ?? null;
  return nearest;
}

export function eatLureSeed(state: DuskCollectionState, seedId: number) {
  const index = state.seeds.findIndex((seed) => seed.id === seedId);
  if (index < 0) return false;
  state.seeds.splice(index, 1);
  state.targetSeedId = null;
  state.eatPause = LURE_SEED_EAT_PAUSE;
  return true;
}

export function openCoopDoor(state: DuskCollectionState) {
  if (state.phase !== 'escorting' || !state.doorSeedPlaced) return false;
  state.phase = 'coop-open';
  state.targetSeedId = null;
  return true;
}

export function markChickenInside(state: DuskCollectionState) {
  if (state.phase !== 'coop-open') return false;
  state.phase = 'inside';
  return true;
}

export function canCloseCoopDoor(state: DuskCollectionState) {
  return state.phase === 'inside';
}
