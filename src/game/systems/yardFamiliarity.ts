import type { Vec2 } from '../simulation/state';
import { isInsideRect } from '../content/yard';

export type YardRegionId =
  | 'left-tree'
  | 'right-bottom'
  | 'upper-wilds'
  | 'left-middle'
  | 'right-middle';

export interface YardRegionEntry {
  familiarity: number;
  firstSeenDay: number;
  tipShown: boolean;
}

export interface YardFamiliarityState {
  regions: Record<YardRegionId, YardRegionEntry>;
}

const MAX_FAMILIARITY = 100;
const FAMILIARITY_GAIN_PER_ACTIVE_SECOND = 0.24;
const REGION_RECTS = {
  'left-tree': { x: 0, y: 790, width: 660, height: 410 },
  'right-bottom': { x: 830, y: 900, width: 670, height: 300 },
  'upper-wilds': { x: 0, y: 0, width: 1500, height: 260 },
  'left-middle': { x: 0, y: 260, width: 660, height: 530 },
  'right-middle': { x: 830, y: 260, width: 670, height: 640 },
} satisfies Record<YardRegionId, { x: number; y: number; width: number; height: number }>;

export function createYardFamiliarityState(): YardFamiliarityState {
  return {
    regions: {
      'left-tree': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'right-bottom': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'upper-wilds': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'left-middle': { familiarity: 0, firstSeenDay: 0, tipShown: false },
      'right-middle': { familiarity: 0, firstSeenDay: 0, tipShown: false },
    },
  };
}

export function yardRegionFor(point: Vec2): YardRegionId | null {
  if (isInsideRect(point, REGION_RECTS['upper-wilds'])) {
    return 'upper-wilds';
  }
  if (isInsideRect(point, REGION_RECTS['left-tree'])) {
    return 'left-tree';
  }
  if (isInsideRect(point, REGION_RECTS['right-bottom'])) {
    return 'right-bottom';
  }
  if (isInsideRect(point, REGION_RECTS['left-middle'])) {
    return 'left-middle';
  }
  if (isInsideRect(point, REGION_RECTS['right-middle'])) {
    return 'right-middle';
  }

  return null;
}

export function recordRegionExploration(
  state: YardFamiliarityState,
  point: Vec2,
  activeSeconds: number,
  currentDay = 0,
): { region: YardRegionId | null; firstSeen: boolean; canShowTip: boolean } {
  const region = yardRegionFor(point);
  if (!region) {
    return { region, firstSeen: false, canShowTip: false };
  }
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
  if (!region) return 0;
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
  if (!yardRegionFor(point)) return 1;
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
    'left-tree': 'tree-shade',
    'right-bottom': 'planting-zone',
    'upper-wilds': 'pond-bank',
    'left-middle': 'left-middle',
    'right-middle': 'right-middle',
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
