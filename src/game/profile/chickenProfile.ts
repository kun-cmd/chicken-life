export type AbilityId = 'peck' | 'cluck' | 'scratch' | 'sprint' | 'flutter';
export type AbilityFlags = Record<AbilityId, boolean>;

export interface ChickenProfile {
  name: string;
  named: boolean;
  runSeed: number;
  awakenedAbilities: AbilityFlags;
}

export const DEFAULT_CHICKEN_NAME = '小鸡';
export const MAX_CHICKEN_NAME_LENGTH = 12;

export function normalizeChickenName(input: string) {
  const trimmed = input.trim();
  const visible = Array.from(trimmed).slice(0, MAX_CHICKEN_NAME_LENGTH).join('');
  return visible || DEFAULT_CHICKEN_NAME;
}

export function createChickenProfile(runSeed = Date.now()): ChickenProfile {
  return {
    name: DEFAULT_CHICKEN_NAME,
    named: false,
    runSeed,
    awakenedAbilities: {
      peck: true,
      cluck: true,
      scratch: false,
      sprint: true,
      flutter: false,
    },
  };
}
