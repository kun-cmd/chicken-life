import type { ForagingFoodType } from './foraging';

export type EggQuality = 'poor' | 'ordinary' | 'good' | 'excellent';

export interface EggQualityInput {
  nutrition: number;
  foodsEaten: readonly ForagingFoodType[];
  dryRest: boolean;
}

export const EGG_BUDGET: Record<EggQuality, number> = {
  poor: 2,
  ordinary: 3,
  good: 4,
  excellent: 5,
};

const WILD_FOODS = new Set<ForagingFoodType>([
  'worm',
  'cricket',
  'beetle',
  'berry',
  'nightBug',
]);

export function evaluateEggQuality(input: EggQualityInput) {
  const wildKinds = new Set(input.foodsEaten.filter((food) => WILD_FOODS.has(food))).size;
  let score = 0;

  if (input.nutrition >= 35) score += 1;
  if (input.nutrition >= 70) score += 1;
  if (wildKinds >= 1) score += 1;
  if (input.dryRest) score += 1;

  const quality: EggQuality =
    score >= 4 ? 'excellent' : score === 3 ? 'good' : score === 2 ? 'ordinary' : 'poor';
  return {
    quality,
    budget: EGG_BUDGET[quality],
    score,
    wildKinds,
  };
}

export function eggQualityLabel(quality: EggQuality) {
  if (quality === 'excellent') return '好蛋';
  if (quality === 'good') return '较好蛋';
  if (quality === 'ordinary') return '普通蛋';
  return '差蛋';
}
