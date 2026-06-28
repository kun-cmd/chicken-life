import type { Vec2 } from '../simulation/state';
import type { ChickenProfile } from '../profile/chickenProfile';
import { createSeededRandom } from './seededRandom';

export type ForagingFoodType =
  | 'grain'
  | 'grass'
  | 'sunflower'
  | 'worm'
  | 'cricket'
  | 'beetle'
  | 'berry'
  | 'nightBug';

export interface ForagingState {
  sprintEnergy: number;
  maxSprintEnergy: number;
  discoveredFoods: ForagingFoodType[];
  foodsEatenToday: ForagingFoodType[];
}

export interface DailyFoodSpawn extends Vec2 {
  type: ForagingFoodType;
}

const ENERGY: Record<ForagingFoodType, number> = {
  grain: 12,
  grass: 8,
  sunflower: 16,
  worm: 28,
  cricket: 30,
  beetle: 32,
  berry: 22,
  nightBug: 40,
};

export function createForagingState(): ForagingState {
  return {
    sprintEnergy: 100,
    maxSprintEnergy: 100,
    discoveredFoods: ['grain', 'sunflower'],
    foodsEatenToday: [],
  };
}

export function foodPoolFor(profile: ChickenProfile, dusk: boolean): ForagingFoodType[] {
  const pool: ForagingFoodType[] = ['grain', 'grass', 'sunflower'];
  if (profile.awakenedAbilities.scratch) pool.push('worm');
  if (profile.awakenedAbilities.sprint) pool.push('cricket', 'beetle');
  if (profile.awakenedAbilities.flutter) pool.push('berry');
  if (dusk && profile.awakenedAbilities.sprint) pool.push('nightBug');
  return pool;
}

export function consumeFood(state: ForagingState, type: ForagingFoodType) {
  const firstDiscovery = !state.discoveredFoods.includes(type);
  if (firstDiscovery) state.discoveredFoods.push(type);
  state.foodsEatenToday.push(type);
  state.sprintEnergy = Math.min(state.maxSprintEnergy, state.sprintEnergy + ENERGY[type]);
  return { firstDiscovery, restored: ENERGY[type] };
}

export function createDailyFoodPlan(
  runSeed: number,
  day: number,
  pool: readonly ForagingFoodType[],
  points: readonly Vec2[],
  count: number,
): DailyFoodSpawn[] {
  const random = createSeededRandom(runSeed ^ Math.imul(day, 0x9e3779b1));
  return Array.from({ length: count }, () => ({
    ...points[Math.floor(random() * points.length)],
    type: pool[Math.floor(random() * pool.length)],
  }));
}

export function foodDisplayName(type: ForagingFoodType) {
  return {
    grain: '米粒',
    grass: '嫩草',
    sunflower: '瓜子',
    worm: '蚯蚓',
    cricket: '蟋蟀',
    beetle: '甲虫',
    berry: '树莓',
    nightBug: '夜虫',
  }[type];
}

export function isForagingFood(type: string): type is ForagingFoodType {
  return ['grain', 'grass', 'sunflower', 'worm', 'cricket', 'beetle', 'berry', 'nightBug'].includes(type);
}
