import { createSeededRandom } from './seededRandom';

const MIDDLE_PAIRS: Array<[number, number]> = [
  [9, 11],
  [9, 12],
  [9, 13],
  [10, 12],
  [10, 13],
  [11, 13],
];

export function createWeaselSchedule(runSeed: number) {
  const random = createSeededRandom(runSeed ^ 0x51a5e1);
  const pair = MIDDLE_PAIRS[Math.floor(random() * MIDDLE_PAIRS.length)];
  return [8, ...pair, 14].sort((a, b) => a - b);
}

export function hasWeaselEncounter(schedule: number[], day: number, runSeed: number) {
  if (day <= 14) return schedule.includes(day);
  const freePlayIndex = day - 15;
  const block = Math.floor(freePlayIndex / 7);
  const dayInBlock = freePlayIndex % 7;
  const random = createSeededRandom(runSeed ^ Math.imul(block + 1, 0x27d4eb2d));
  return dayInBlock === Math.floor(random() * 7);
}
