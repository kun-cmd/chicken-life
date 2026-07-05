import { createSeededRandom } from './seededRandom';

export function createWeaselSchedule(runSeed: number) {
  const random = createSeededRandom(runSeed ^ 0x51a5e1);
  const early = 4 + Math.floor(random() * 2);
  const middle = 7 + Math.floor(random() * 3);
  const late = 10 + Math.floor(random() * 3);
  return [2, early, middle, late, 14].sort((a, b) => a - b);
}

export function hasWeaselEncounter(schedule: number[], day: number, runSeed: number) {
  if (day <= 14) return schedule.includes(day);
  const freePlayIndex = day - 15;
  const block = Math.floor(freePlayIndex / 7);
  const dayInBlock = freePlayIndex % 7;
  const random = createSeededRandom(runSeed ^ Math.imul(block + 1, 0x27d4eb2d));
  return dayInBlock === Math.floor(random() * 7);
}
