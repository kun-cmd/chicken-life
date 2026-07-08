import { YARD_UPGRADES, type YardUpgradeId } from '../content/yardUpgrades';
import type { Vec2 } from '../simulation/state';

export interface YardUpgradeState {
  wood: number;
  pendingWood: number;
  owned: YardUpgradeId[];
}

export type FacilityId = Extract<YardUpgradeId, 'shade-shelter' | 'low-perch'>;
export type FacilityActivity = 'dust-bath' | 'shade-rest' | 'perch-idle' | 'hole-rest';

export interface FacilityLifeState {
  idleSeconds: number;
  activity: FacilityActivity | null;
  activitySeconds: number;
  dustBathReady: boolean;
  restedToday: boolean;
  needsMovement: boolean;
}

export const FACILITY_ZONE_RADIUS = 72;
export const FACILITY_IDLE_SECONDS = 2.5;
export const FACILITY_ACTIVITY_SECONDS = 4;

export function createYardUpgradeState(): YardUpgradeState {
  return { wood: 0, pendingWood: 0, owned: [] };
}

export function createFacilityLifeState(): FacilityLifeState {
  return {
    idleSeconds: 0,
    activity: null,
    activitySeconds: 0,
    dustBathReady: false,
    restedToday: false,
    needsMovement: false,
  };
}

export function deliverPendingWood(state: YardUpgradeState) {
  const delivered = state.pendingWood;
  state.wood += delivered;
  state.pendingWood = 0;
  return delivered;
}

export function buyUpgrade(state: YardUpgradeState, id: YardUpgradeId) {
  if (state.owned.includes(id)) return false;
  const definition = YARD_UPGRADES.find((item) => item.id === id);
  if (!definition || state.wood < definition.cost) return false;
  state.wood -= definition.cost;
  state.owned.push(id);
  return true;
}

export function coopEntryRadius(state: YardUpgradeState) {
  return state.owned.includes('coop-ramp') ? 56 : 34;
}

export function doorCloseDurationMs(state: YardUpgradeState) {
  return state.owned.includes('door-latch') ? 300 : 850;
}

export function ownedFacilityAt(
  yard: YardUpgradeState,
  point: Vec2,
  radius = FACILITY_ZONE_RADIUS,
): FacilityId | null {
  for (const id of ['shade-shelter', 'low-perch'] as const) {
    if (!yard.owned.includes(id)) continue;
    const facility = YARD_UPGRADES.find((upgrade) => upgrade.id === id)!;
    if (Math.hypot(point.x - facility.position.x, point.y - facility.position.y) <= radius) {
      return id;
    }
  }
  return null;
}

export function startFacilityActivity(state: FacilityLifeState, activity: FacilityActivity) {
  if (state.activity) return false;
  state.activity = activity;
  state.activitySeconds = FACILITY_ACTIVITY_SECONDS;
  state.idleSeconds = 0;
  state.dustBathReady = false;
  return true;
}

export function advanceFacilityActivity(state: FacilityLifeState, dt: number) {
  if (!state.activity) return null;
  state.activitySeconds = Math.max(0, state.activitySeconds - Math.max(0, dt));
  if (state.activitySeconds > 0.0001) return null;
  state.activitySeconds = 0;
  const activity = state.activity;
  const firstToday = !state.restedToday;
  state.activity = null;
  state.restedToday = true;
  state.needsMovement = true;
  return { activity, firstToday };
}

export function resetFacilityLifeDay(state: FacilityLifeState) {
  Object.assign(state, createFacilityLifeState());
}
