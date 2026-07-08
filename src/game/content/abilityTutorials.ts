import type { AbilityId } from '../profile/chickenProfile';
import type { Vec2 } from '../simulation/state';

export interface AbilityTutorial {
  ability: AbilityId;
  day: number;
  position: Vec2;
  prompt: string;
}

export const ABILITY_TUTORIALS: AbilityTutorial[] = [
  {
    ability: 'scratch',
    day: 3,
    position: { x: 610, y: 565 },
    prompt: '松土下面有细响。靠近后按住 E 刨开泥土。',
  },
  {
    ability: 'sprint',
    day: 5,
    position: { x: 930, y: 560 },
    prompt: '虫子突然跑了！朝它移动并按住 Shift。',
  },
  {
    ability: 'flutter',
    day: 7,
    position: { x: 286, y: 700 },
    prompt: '树桩上有颗亮果子。靠近后按 F 扑翅跳起。',
  },
];

export function tutorialForDay(day: number, awakened: Record<AbilityId, boolean>) {
  return ABILITY_TUTORIALS.find(
    (tutorial) => tutorial.day <= day && !awakened[tutorial.ability],
  ) ?? null;
}

export function tutorialForAbility(ability: AbilityId | null) {
  return ABILITY_TUTORIALS.find((tutorial) => tutorial.ability === ability) ?? null;
}
