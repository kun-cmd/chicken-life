import type { Vec2 } from '../simulation/state';
import type { RandomSource } from '../systems/seededRandom';

export interface EggSpot {
  id: string;
  position: Vec2;
  cluePosition: Vec2;
  unlockDay: 1 | 4 | 10;
  clueKind: 'feather' | 'bent-grass' | 'scratched-soil' | 'shell-sound';
}

export const EGG_SPOTS: EggSpot[] = [
  {
    id: 'tree-lawn-west',
    position: { x: 120, y: 872 },
    cluePosition: { x: 104, y: 852 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'tree-lawn-root',
    position: { x: 228, y: 872 },
    cluePosition: { x: 250, y: 856 },
    unlockDay: 1,
    clueKind: 'feather',
  },
  {
    id: 'tree-lawn-east',
    position: { x: 346, y: 898 },
    cluePosition: { x: 364, y: 880 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'tree-lawn-southwest',
    position: { x: 138, y: 1012 },
    cluePosition: { x: 116, y: 992 },
    unlockDay: 4,
    clueKind: 'bent-grass',
  },
  {
    id: 'tree-lawn-south',
    position: { x: 268, y: 1038 },
    cluePosition: { x: 292, y: 1018 },
    unlockDay: 4,
    clueKind: 'bent-grass',
  },
  {
    id: 'tree-lawn-southeast',
    position: { x: 382, y: 1024 },
    cluePosition: { x: 400, y: 1008 },
    unlockDay: 4,
    clueKind: 'feather',
  },
  {
    id: 'small-shade-west',
    position: { x: 1114, y: 800 },
    cluePosition: { x: 1092, y: 784 },
    unlockDay: 10,
    clueKind: 'bent-grass',
  },
  {
    id: 'small-shade-east',
    position: { x: 1210, y: 838 },
    cluePosition: { x: 1192, y: 820 },
    unlockDay: 10,
    clueKind: 'feather',
  },
  {
    id: 'small-shade-low',
    position: { x: 1102, y: 876 },
    cluePosition: { x: 1084, y: 860 },
    unlockDay: 10,
    clueKind: 'feather',
  },
  {
    id: 'far-hedge',
    position: { x: 1206, y: 916 },
    cluePosition: { x: 1184, y: 900 },
    unlockDay: 10,
    clueKind: 'shell-sound',
  },
];

export function selectEggSpot(
  day: number,
  previousId: string | null,
  random: RandomSource,
  spots: readonly EggSpot[] = EGG_SPOTS,
) {
  const open = spots.filter((spot) => spot.unlockDay <= day);
  const alternatives = open.filter((spot) => spot.id !== previousId);
  const candidates = alternatives.length > 0 ? alternatives : open;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}
