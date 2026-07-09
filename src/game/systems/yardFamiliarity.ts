import type { Vec2 } from '../simulation/state';
import {
  COOP,
  HOUSE_PATH,
  isInsideRect,
  isInLeftTreeArea,
  isInPlantingZone,
  isInUpperWildArea,
  MAIN_PATH,
} from '../content/yard';

export type YardRegionId =
  | 'house-yard'
  | 'main-path'
  | 'left-tree'
  | 'planting-zone'
  | 'upper-wilds'
  | 'coop-yard'
  | 'outer-growth';

export interface YardRegionEntry {
  familiarity: number;
  firstSeenDay: number;
  tipShown: boolean;
}

export interface YardFamiliarityState {
  regions: Record<YardRegionId, YardRegionEntry>;
}

const MAX_FAMILIARITY = 100;
const FAMILIARITY_GAIN_PER_ACTIVE_SECOND = 0.12;

export function createYardFamiliarityState(): YardFamiliarityState {
  return {
    regions: {
      'house-yard': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'main-path': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'left-tree': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'planting-zone': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'upper-wilds': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'coop-yard': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'outer-growth': { familiarity: 0, firstSeenDay: 0, tipShown: false },
    },
  };
}

function nearestCoopDistance(point: Vec2): number {
  return Math.hypot(point.x - (COOP.x + COOP.width / 2), point.y - (COOP.y + COOP.height / 2));
}

export function yardRegionFor(point: Vec2): YardRegionId {
  if (isInsideRect(point, MAIN_PATH) || isInsideRect(point, HOUSE_PATH)) {
    return 'main-path';
  }

  if (isInLeftTreeArea(point)) {
    return 'left-tree';
  }

  if (isInPlantingZone(point)) {
    return 'planting-zone';
  }

  if (isInUpperWildArea(point)) {
    return 'upper-wilds';
  }

  if (isInsideRect(point, COOP, 14)) {
    return 'coop-yard';
  }

  const coopDist = nearestCoopDistance(point);
  if (coopDist < 180) {
    return 'coop-yard';
  }

  if (point.x > 360 && point.x < 1140 && point.y < 620) {
    return 'house-yard';
  }

  return 'outer-growth';
}

export function recordRegionExploration(
  state: YardFamiliarityState,
  point: Vec2,
  activeSeconds: number,
  currentDay = 0,
): { region: YardRegionId; firstSeen: boolean; canShowTip: boolean } {
  const region = yardRegionFor(point);
  const entry = state.regions[region];
  const firstSeen = entry.firstSeenDay === 0;
  if (firstSeen && currentDay > 0) {
    entry.firstSeenDay = currentDay;
  }
  const canShowTip = !entry.tipShown;
  const gain = Math.min(
    activeSeconds * FAMILIARITY_GAIN_PER_ACTIVE_SECOND,
    MAX_FAMILIARITY - entry.familiarity,
  );
  entry.familiarity = Math.min(MAX_FAMILIARITY, entry.familiarity + gain);
  return { region, firstSeen, canShowTip };
}

export function regionFamiliarityFor(
  state: YardFamiliarityState,
  point: Vec2,
): number {
  const region = yardRegionFor(point);
  return state.regions[region].familiarity;
}

export function markTipShownForRegion(
  state: YardFamiliarityState,
  region: YardRegionId,
): void {
  state.regions[region].tipShown = true;
}

export function movementFamiliarityScale(
  state: YardFamiliarityState,
  point: Vec2,
): number {
  const familiarity = regionFamiliarityFor(state, point);
  const ratio = familiarity / MAX_FAMILIARITY;
  return 0.82 + ratio * (1 - 0.82);
}

function safeFamiliarity(saved: unknown, fresh: YardFamiliarityState): YardFamiliarityState {
  if (!saved || typeof saved !== 'object') return fresh;
  const input = saved as Record<string, unknown>;
  const inputRegions = input.regions;
  if (!inputRegions || typeof inputRegions !== 'object') return fresh;
  const restored = createYardFamiliarityState();
  for (const id of Object.keys(restored.regions) as YardRegionId[]) {
    const savedEntry =
      (inputRegions as Record<string, unknown>)[id] ??
      (inputRegions as Record<string, unknown>)[legacyRegionId(id)];
    if (savedEntry && typeof savedEntry === 'object') {
      const entry = savedEntry as Record<string, unknown>;
      restored.regions[id] = {
        familiarity: clampFamiliarity(Number(entry.familiarity ?? 0)),
        firstSeenDay: Math.max(0, Math.floor(Number(entry.firstSeenDay ?? 0))),
        tipShown: Boolean(entry.tipShown),
      };
    }
  }
  return restored;
}

function legacyRegionId(id: YardRegionId) {
  return {
    'house-yard': 'house-yard',
    'main-path': 'main-path',
    'left-tree': 'tree-shade',
    'planting-zone': 'outer-growth',
    'upper-wilds': 'pond-bank',
    'coop-yard': 'coop-yard',
    'outer-growth': 'outer-growth',
  }[id];
}

function clampFamiliarity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_FAMILIARITY, Math.round(value)));
}

export function restoreYardFamiliarityState(
  saved: unknown,
): YardFamiliarityState {
  return safeFamiliarity(saved, createYardFamiliarityState());
}
