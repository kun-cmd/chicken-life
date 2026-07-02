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
    position: { x: 1005, y: 430 },
    cluePosition: { x: 970, y: 420 },
    unlockDay: 1,
    clueKind: 'feather',
  },
  {
    id: 'west-patch',
    position: { x: 305, y: 455 },
    cluePosition: { x: 340, y: 470 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'old-tree',
    position: { x: 285, y: 705 },
    cluePosition: { x: 320, y: 690 },
    unlockDay: 1,
    clueKind: 'scratched-soil',
  },
  {
    id: 'pond-reeds',
    position: { x: 245, y: 235 },
    cluePosition: { x: 270, y: 250 },
    unlockDay: 4,
    clueKind: 'shell-sound',
  },
  {
    id: 'east-garden',
    position: { x: 1295, y: 535 },
    cluePosition: { x: 1260, y: 550 },
    unlockDay: 4,
    clueKind: 'bent-grass',
  },
  {
    id: 'house-eaves',
    position: { x: 1010, y: 375 },
    cluePosition: { x: 980, y: 395 },
    unlockDay: 10,
    clueKind: 'feather',
  },
  {
    id: 'south-path',
    position: { x: 610, y: 790 },
    cluePosition: { x: 640, y: 770 },
    unlockDay: 10,
    clueKind: 'scratched-soil',
  },
  {
    id: 'far-hedge',
    position: { x: 1190, y: 835 },
    cluePosition: { x: 1160, y: 815 },
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
