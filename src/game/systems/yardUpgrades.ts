import { YARD_UPGRADES, type YardUpgradeId } from '../content/yardUpgrades';

export interface YardUpgradeState {
  wood: number;
  pendingWood: number;
  owned: YardUpgradeId[];
}

export function createYardUpgradeState(): YardUpgradeState {
  return { wood: 0, pendingWood: 0, owned: [] };
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
