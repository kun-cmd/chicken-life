import type { ForagingFoodType } from './foraging';
import type { RelationshipStage } from './relationship';

const TREAT_FOODS: ForagingFoodType[] = ['grain', 'grass', 'sunflower', 'worm', 'berry'];

export interface TasteProfile {
  favorite: ForagingFoodType;
  disliked: ForagingFoodType;
}

export type TouchOption = 'head' | 'back' | 'hold';

export function createTasteProfile(runSeed: number): TasteProfile {
  const favoriteIndex = Math.abs(runSeed) % TREAT_FOODS.length;
  const dislikedIndex = (favoriteIndex + 2 + (Math.abs(runSeed) % 2)) % TREAT_FOODS.length;
  return {
    favorite: TREAT_FOODS[favoriteIndex],
    disliked: TREAT_FOODS[dislikedIndex],
  };
}

export function resolveFoodOffer(
  food: ForagingFoodType,
  taste: TasteProfile,
  stage: RelationshipStage,
) {
  if (food === taste.disliked && stage === 'wary') {
    return { accepted: false, reaction: 'retreat' as const };
  }
  if (food === taste.favorite) {
    return { accepted: true, reaction: 'eager' as const };
  }
  return {
    accepted: true,
    reaction: stage === 'wary' ? ('cautious' as const) : ('calm' as const),
  };
}

export function touchOptionsFor(stage: RelationshipStage): TouchOption[] {
  if (stage === 'wary') return [];
  if (stage === 'familiar') return ['head'];
  return ['head', 'back', 'hold'];
}
