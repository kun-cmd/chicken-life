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
    id: 'coop-straw',
    position: { x: 205, y: 455 },
    cluePosition: { x: 232, y: 472 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'west-patch',
    position: { x: 310, y: 505 },
    cluePosition: { x: 280, y: 488 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'old-tree',
    position: { x: 142, y: 822 },
    cluePosition: { x: 170, y: 810 },
    unlockDay: 1,
    clueKind: 'feather',
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
    position: { x: 1100, y: 550 },
    cluePosition: { x: 1130, y: 566 },
    unlockDay: 4,
    clueKind: 'bent-grass',
  },
  {
    id: 'house-eaves',
    position: { x: 1235, y: 590 },
    cluePosition: { x: 1205, y: 574 },
    unlockDay: 10,
    clueKind: 'feather',
  },
  {
    id: 'south-path',
    position: { x: 1000, y: 810 },
    cluePosition: { x: 1030, y: 826 },
    unlockDay: 10,
    clueKind: 'bent-grass',
  },
  {
    id: 'far-hedge',
    position: { x: 1125, y: 835 },
    cluePosition: { x: 1095, y: 818 },
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
