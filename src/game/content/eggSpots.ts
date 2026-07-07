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
    id: 'west-patch',
    position: { x: 245, y: 470 },
    cluePosition: { x: 214, y: 448 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'old-tree',
    position: { x: 154, y: 820 },
    cluePosition: { x: 184, y: 808 },
    unlockDay: 1,
    clueKind: 'feather',
  },
  {
    id: 'north-tree-bush',
    position: { x: 205, y: 338 },
    cluePosition: { x: 230, y: 326 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'pond-reeds',
    position: { x: 430, y: 720 },
    cluePosition: { x: 458, y: 738 },
    unlockDay: 4,
    clueKind: 'bent-grass',
  },
  {
    id: 'east-garden',
    position: { x: 1120, y: 555 },
    cluePosition: { x: 1150, y: 572 },
    unlockDay: 4,
    clueKind: 'bent-grass',
  },
  {
    id: 'northeast-shade',
    position: { x: 1338, y: 205 },
    cluePosition: { x: 1308, y: 192 },
    unlockDay: 4,
    clueKind: 'feather',
  },
  {
    id: 'south-path',
    position: { x: 1025, y: 805 },
    cluePosition: { x: 1055, y: 822 },
    unlockDay: 10,
    clueKind: 'bent-grass',
  },
  {
    id: 'west-tree-bush',
    position: { x: 270, y: 748 },
    cluePosition: { x: 244, y: 734 },
    unlockDay: 10,
    clueKind: 'scratched-soil',
  },
  {
    id: 'house-eaves',
    position: { x: 1125, y: 650 },
    cluePosition: { x: 1150, y: 635 },
    unlockDay: 10,
    clueKind: 'feather',
  },
  {
    id: 'far-hedge',
    position: { x: 1238, y: 818 },
    cluePosition: { x: 1210, y: 804 },
    unlockDay: 10,
    clueKind: 'shell-sound',
  },
];

export function selectEggSpot(
  day: number,
  previousId: string | null,
  random: RandomSource,
) {
  const open = EGG_SPOTS.filter((spot) => spot.unlockDay <= day);
  const alternatives = open.filter((spot) => spot.id !== previousId);
  const candidates = alternatives.length > 0 ? alternatives : open;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}
