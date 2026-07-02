export type EggClueLevel = 0 | 1 | 2;

export interface EggSearchState {
  spotId: string;
  seconds: number;
  clueLevel: EggClueLevel;
  found: boolean;
}

export const EGG_CLUE_SOFT_SECONDS = 60;
export const EGG_CLUE_STRONG_SECONDS = 120;

export function createEggSearchState(spotId: string): EggSearchState {
  return { spotId, seconds: 0, clueLevel: 0, found: false };
}

export function advanceEggSearch(state: EggSearchState, seconds: number): EggSearchState {
  const elapsed = state.seconds + Math.max(0, seconds);
  return {
    ...state,
    seconds: elapsed,
    clueLevel:
      elapsed >= EGG_CLUE_STRONG_SECONDS ? 2 : elapsed >= EGG_CLUE_SOFT_SECONDS ? 1 : 0,
  };
}

export function collectCurrentEgg(state: EggSearchState) {
  if (state.found) return false;
  state.found = true;
  return true;
}
