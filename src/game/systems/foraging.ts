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
  refillWave: number;
}

export interface DailyFoodSpawn extends Vec2 {
  type: ForagingFoodType;
}

const ENERGY: Record<ForagingFoodType, number> = {
  grain: 8,
  grass: 5,
  sunflower: 18,
  worm: 16,
  cricket: 18,
  beetle: 14,
  berry: 10,
  nightBug: 22,
};

export function createForagingState(): ForagingState {
  return {
    sprintEnergy: 100,
    maxSprintEnergy: 100,
    discoveredFoods: ['grain'],
    foodsEatenToday: [],
    refillWave: 0,
  };
}

export function foodPoolFor(
  profile: ChickenProfile,
  dusk: boolean,
  day = 1,
): ForagingFoodType[] {
  const pool: ForagingFoodType[] = ['grain', 'grass'];
  if (profile.awakenedAbilities.sprint && day >= 3) pool.push('cricket');
  if (profile.awakenedAbilities.scratch && day >= 4) pool.push('worm');
  if (profile.awakenedAbilities.sprint && day >= 6) pool.push('beetle');
  if (profile.awakenedAbilities.flutter && day >= 7) pool.push('berry');
  if (dusk && profile.awakenedAbilities.sprint && day >= 3) pool.push('nightBug');
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
  if (pool.length === 0 || points.length === 0 || count <= 0) return [];
  const shuffledPoints = [...points];
  for (let index = shuffledPoints.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffledPoints[index], shuffledPoints[swapIndex]] = [
      shuffledPoints[swapIndex],
      shuffledPoints[index],
    ];
  }
  return Array.from({ length: Math.min(count, shuffledPoints.length) }, (_, index) => ({
    ...shuffledPoints[index],
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
