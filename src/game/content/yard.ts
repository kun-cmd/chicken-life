import type { Rect, Vec2 } from '../simulation/state';

export const WORLD_WIDTH = 1500;
export const WORLD_HEIGHT = 1200;

export const HOUSE: Rect = { x: 502, y: 302, width: 496, height: 258 };
export const COOP: Rect = { x: 1038, y: 465, width: 178, height: 132 };
export const COOP_DOOR: Vec2 = { x: 1068, y: 600 };

export const MAIN_PATH: Rect = { x: 650, y: 542, width: 196, height: 658 };
export const HOUSE_PATH: Rect = { x: 414, y: 538, width: 774, height: 104 };
export const LEFT_TREE_LAWN: Rect = { x: 42, y: 806, width: 416, height: 332 };
export const LEFT_TREE_AREA: Rect = LEFT_TREE_LAWN;
export const PLANTING_ZONE: Rect = { x: 1040, y: 910, width: 286, height: 210 };
export const PLANTING_BED: Rect = { x: 1104, y: 976, width: 156, height: 104 };
export const UPPER_WILD_AREAS: Rect[] = [
  { x: 72, y: 34, width: 1356, height: 190 },
];
export const LOWER_LEFT_SHADE_TREE: Vec2 = { x: 246, y: 964 };
export const LOWER_LEFT_SHADE_RADIUS = 148;

export const SAFE_LIGHTS: Vec2[] = [
  { x: 750, y: 580 },
  { x: 1072, y: 602 },
  { x: 540, y: 556 },
];

export const KEEPER_START: Vec2 = { x: 750, y: 606 };

export const FOOD_SPAWN_POINTS: Vec2[] = [
  { x: 96, y: 96 },
  { x: 245, y: 150 },
  { x: 430, y: 96 },
  { x: 610, y: 164 },
  { x: 788, y: 94 },
  { x: 972, y: 156 },
  { x: 1165, y: 98 },
  { x: 1368, y: 168 },
  { x: 74, y: 580 },
  { x: 82, y: 880 },
  { x: 122, y: 1018 },
  { x: 178, y: 1092 },
  { x: 172, y: 582 },
  { x: 292, y: 488 },
  { x: 305, y: 822 },
  { x: 365, y: 920 },
  { x: 398, y: 1055 },
  { x: 330, y: 660 },
  { x: 438, y: 768 },
  { x: 462, y: 1136 },
  { x: 535, y: 1035 },
  { x: 610, y: 785 },
  { x: 908, y: 1095 },
  { x: 930, y: 780 },
  { x: 1010, y: 910 },
  { x: 1188, y: 425 },
  { x: 1180, y: 1112 },
  { x: 1225, y: 650 },
  { x: 1290, y: 890 },
  { x: 1320, y: 524 },
  { x: 1360, y: 1080 },
  { x: 1426, y: 740 },
  { x: 1424, y: 960 },
];

export const FLUTTER_TARGETS: Vec2[] = [
  { x: 286, y: 920 },
  { x: 205, y: 550 },
  { x: 1125, y: 850 },
];

export const KEEPER_ROUTE: Vec2[] = [
  { x: 750, y: 606 },
  { x: 700, y: 720 },
  { x: 800, y: 835 },
  { x: 700, y: 950 },
  { x: 800, y: 1065 },
  { x: 700, y: 1150 },
];

export const TREE_POSITIONS: Vec2[] = [
  LOWER_LEFT_SHADE_TREE,
  { x: 1125, y: 805 },
];

export const PLANT_PATCHES: Rect[] = [
  LEFT_TREE_LAWN,
];

export const EGG_HIDE_AREAS: Rect[] = [
  { x: 82, y: 842, width: 78, height: 72 },
  { x: 186, y: 840, width: 82, height: 74 },
  { x: 302, y: 862, width: 86, height: 76 },
  { x: 98, y: 974, width: 84, height: 78 },
  { x: 222, y: 1000, width: 92, height: 80 },
  { x: 342, y: 988, width: 78, height: 74 },
  { x: 1076, y: 764, width: 86, height: 72 },
  { x: 1168, y: 804, width: 86, height: 72 },
  { x: 1062, y: 842, width: 84, height: 70 },
  { x: 1164, y: 884, width: 90, height: 72 },
];

export const BLOCKERS: Rect[] = [HOUSE, COOP];

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

export function isInLeftTreeArea(point: Vec2) {
  return isInsideRect(point, LEFT_TREE_AREA);
}

export function isInLowerLeftShade(point: Vec2) {
  return distance(point, LOWER_LEFT_SHADE_TREE) < LOWER_LEFT_SHADE_RADIUS;
}

export function isInPlantingZone(point: Vec2) {
  return isInsideRect(point, PLANTING_ZONE);
}

export function isInUpperWildArea(point: Vec2) {
  return UPPER_WILD_AREAS.some((area) => isInsideRect(point, area));
}

export function isInCoop(point: Vec2) {
  return isInsideRect(point, COOP, 10);
}

export function isInPond(point: Vec2) {
  return false;
}

export function isNearPond(point: Vec2) {
  return false;
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
