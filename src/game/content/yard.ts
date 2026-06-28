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

export const KEEPER_ROUTE: Vec2[] = [
  { x: 750, y: 386 },
  { x: 750, y: 520 },
  { x: 704, y: 650 },
  { x: 806, y: 770 },
  { x: 748, y: 884 },
  { x: 548, y: 398 },
  { x: 950, y: 398 },
  { x: 1074, y: 414 },
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
