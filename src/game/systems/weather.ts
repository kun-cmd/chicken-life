import { createSeededRandom } from './seededRandom';

export type Weather = 'sunny' | 'cloudy' | 'rain';

function fillCalendar(
  calendar: Weather[],
  remaining: Record<Weather, number>,
  random: () => number,
): boolean {
  if (calendar.length === 14) return true;
  const blocked =
    calendar.length >= 2 && calendar.at(-1) === calendar.at(-2)
      ? calendar.at(-1)
      : null;
  const candidates = (Object.keys(remaining) as Weather[])
    .filter((weather) => remaining[weather] > 0 && weather !== blocked)
    .map((weather) => ({ weather, order: random() }))
    .sort((a, b) => a.order - b.order);

  for (const { weather } of candidates) {
    remaining[weather] -= 1;
    calendar.push(weather);
    if (fillCalendar(calendar, remaining, random)) return true;
    calendar.pop();
    remaining[weather] += 1;
  }
  return false;
}

export function createWeatherCalendar(runSeed: number): Weather[] {
  const calendar: Weather[] = [];
  fillCalendar(calendar, { sunny: 7, cloudy: 4, rain: 3 }, createSeededRandom(runSeed ^ 0x77ea7e));
  return calendar;
}

export function weatherForDay(runSeed: number, day: number): Weather {
  const zeroBased = Math.max(0, day - 1);
  const block = Math.floor(zeroBased / 14);
  return createWeatherCalendar(runSeed ^ Math.imul(block, 0x45d9f3b))[zeroBased % 14];
}

export function isWeather(value: unknown): value is Weather {
  return value === 'sunny' || value === 'cloudy' || value === 'rain';
}
