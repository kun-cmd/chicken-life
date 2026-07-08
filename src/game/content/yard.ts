import type { Rect, Vec2 } from '../simulation/state';

export const WORLD_WIDTH = 1500;
export const WORLD_HEIGHT = 980;

export const HOUSE: Rect = { x: 502, y: 82, width: 496, height: 258 };
export const COOP: Rect = { x: 1038, y: 245, width: 178, height: 132 };
export const COOP_DOOR: Vec2 = { x: 1068, y: 380 };
export const POND: Rect = { x: 118, y: 154, width: 92, height: 62 };

export const MAIN_PATH: Rect = { x: 650, y: 322, width: 196, height: 658 };
export const HOUSE_PATH: Rect = { x: 414, y: 318, width: 774, height: 104 };

export const SAFE_LIGHTS: Vec2[] = [
  { x: 750, y: 360 },
  { x: 1072, y: 382 },
  { x: 540, y: 336 },
];

export const KEEPER_START: Vec2 = { x: 750, y: 386 };

export const FOOD_SPAWN_POINTS: Vec2[] = [
  { x: 74, y: 360 },
  { x: 82, y: 660 },
  { x: 172, y: 362 },
  { x: 292, y: 268 },
  { x: 305, y: 602 },
  { x: 330, y: 440 },
  { x: 438, y: 548 },
  { x: 462, y: 916 },
  { x: 535, y: 815 },
  { x: 610, y: 565 },
  { x: 908, y: 875 },
  { x: 930, y: 560 },
  { x: 1010, y: 690 },
  { x: 1188, y: 205 },
  { x: 1180, y: 892 },
  { x: 1225, y: 430 },
  { x: 1290, y: 670 },
  { x: 1320, y: 304 },
  { x: 1360, y: 860 },
  { x: 1426, y: 520 },
  { x: 1424, y: 740 },
];

export const FLUTTER_TARGETS: Vec2[] = [
  { x: 286, y: 700 },
  { x: 205, y: 330 },
  { x: 1125, y: 630 },
];

export const KEEPER_ROUTE: Vec2[] = [
  { x: 750, y: 386 },
  { x: 700, y: 500 },
  { x: 800, y: 615 },
  { x: 700, y: 730 },
  { x: 800, y: 845 },
  { x: 700, y: 930 },
  { x: 750, y: 386 },
];

export const TREE_POSITIONS: Vec2[] = [
  { x: 205, y: 286 },
  { x: 1335, y: 170 },
  { x: 260, y: 748 },
  { x: 1238, y: 742 },
  { x: 1125, y: 585 },
];

export const PLANT_PATCHES: Rect[] = [
  { x: 140, y: 410, width: 210, height: 120 },
  { x: 1040, y: 500, width: 240, height: 118 },
  { x: 372, y: 672, width: 188, height: 128 },
  { x: 952, y: 760, width: 206, height: 96 },
  { x: 92, y: 780, width: 126, height: 80 },
];

export const EGG_HIDE_AREAS: Rect[] = [
  ...PLANT_PATCHES,
  { x: 166, y: 308, width: 82, height: 58 },
  { x: 1290, y: 178, width: 96, height: 68 },
  { x: 226, y: 706, width: 88, height: 70 },
  { x: 1082, y: 620, width: 94, height: 66 },
  { x: 1195, y: 780, width: 112, height: 76 },
];

export const BLOCKERS: Rect[] = [HOUSE, COOP, POND];

export function isInsideRect(point: Vec2, rect: Rect, padding = 0) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

export function isOnPath(point: Vec2) {
  return isInsideRect(point, MAIN_PATH) || isInsideRect(point, HOUSE_PATH);
}

export function isInPlantPatch(point: Vec2) {
  return PLANT_PATCHES.some((patch) => isInsideRect(point, patch));
}

export function isInCoop(point: Vec2) {
  return isInsideRect(point, COOP, 10);
}

export function isInPond(point: Vec2) {
  return isInsideRect(point, POND);
}

export function isNearPond(point: Vec2) {
  return isInsideRect(point, POND, 54);
}

export function isBlocked(point: Vec2, radius = 18) {
  if (point.x < 32 || point.x > WORLD_WIDTH - 32 || point.y < 32 || point.y > WORLD_HEIGHT - 32) {
    return true;
  }

  return BLOCKERS.some((blocker) => isInsideRect(point, blocker, radius));
}

export function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
