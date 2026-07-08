import type { AbilityId, ChickenProfile } from '../profile/chickenProfile';

const AWAKENING_DAY: Partial<Record<AbilityId, number>> = {
  scratch: 3,
  sprint: 5,
  flutter: 7,
};

export function canUseAbility(profile: ChickenProfile, ability: AbilityId) {
  return profile.awakenedAbilities[ability];
}

export function pendingAwakening(day: number, profile: ChickenProfile): AbilityId | null {
  for (const ability of ['scratch', 'sprint', 'flutter'] as const) {
    if (!profile.awakenedAbilities[ability] && day >= (AWAKENING_DAY[ability] ?? Infinity)) {
      return ability;
    }
  }
  return null;
}

export function awakenAbility(profile: ChickenProfile, ability: AbilityId) {
  profile.awakenedAbilities[ability] = true;
}
