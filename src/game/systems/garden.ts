import { PLANTING_BED } from '../content/yard';
import type { Vec2 } from '../simulation/state';

export type SeedType = 'sunflower' | 'chive' | 'cucumber';
export type GardenPlotId = 'plot-left' | 'plot-mid' | 'plot-right';
export type GardenFoodType = 'sunflower' | 'chive' | 'cucumber';

export interface SeedDefinition {
  id: SeedType;
  name: string;
  cost: number;
  growDays: number;
  foodType: GardenFoodType;
  foodName: string;
  nutrition: number;
}

export interface GardenPlot extends Vec2 {
  id: GardenPlotId;
  seed: SeedType | null;
  plantedDay: number;
  growth: number;
  wateredToday: boolean;
  mature: boolean;
  producedDay: number;
  produceFoodId: number | null;
}

export interface GardenState {
  inventory: Record<SeedType, number>;
  plots: GardenPlot[];
}

export const SEED_DEFINITIONS: SeedDefinition[] = [
  {
    id: 'chive',
    name: '韭菜种子',
    cost: 1,
    growDays: 2,
    foodType: 'chive',
    foodName: '韭菜',
    nutrition: 4,
  },
  {
    id: 'sunflower',
    name: '向日葵种子',
    cost: 1,
    growDays: 3,
    foodType: 'sunflower',
    foodName: '葵花籽',
    nutrition: 6,
  },
  {
    id: 'cucumber',
    name: '黄瓜种子',
    cost: 2,
    growDays: 4,
    foodType: 'cucumber',
    foodName: '黄瓜',
    nutrition: 9,
  },
];

export const GARDEN_PLOTS: Pick<GardenPlot, 'id' | 'x' | 'y'>[] = [
  { id: 'plot-left', x: PLANTING_BED.x + 30, y: PLANTING_BED.y + 52 },
  { id: 'plot-mid', x: PLANTING_BED.x + 78, y: PLANTING_BED.y + 52 },
  { id: 'plot-right', x: PLANTING_BED.x + 126, y: PLANTING_BED.y + 52 },
];

export function createSeedInventory() {
  return {
    sunflower: 0,
    chive: 0,
    cucumber: 0,
  } satisfies Record<SeedType, number>;
}

export function createGardenState(): GardenState {
  return {
    inventory: createSeedInventory(),
    plots: GARDEN_PLOTS.map((plot) => createEmptyPlot(plot.id)),
  };
}

export function createEmptyPlot(id: GardenPlotId): GardenPlot {
  const position = GARDEN_PLOTS.find((plot) => plot.id === id) ?? GARDEN_PLOTS[0];
  return {
    ...position,
    seed: null,
    plantedDay: 0,
    growth: 0,
    wateredToday: false,
    mature: false,
    producedDay: 0,
    produceFoodId: null,
  };
}

export function seedDefinition(seed: SeedType) {
  return SEED_DEFINITIONS.find((definition) => definition.id === seed)!;
}

export function seedDefinitionByFood(food: GardenFoodType) {
  return SEED_DEFINITIONS.find((definition) => definition.foodType === food)!;
}

export function isSeedType(value: unknown): value is SeedType {
  return value === 'sunflower' || value === 'chive' || value === 'cucumber';
}

export function isGardenPlotId(value: unknown): value is GardenPlotId {
  return value === 'plot-left' || value === 'plot-mid' || value === 'plot-right';
}

export function gardenPlotById(garden: GardenState, plotId: GardenPlotId) {
  return garden.plots.find((plot) => plot.id === plotId) ?? null;
}

export function advanceGardenMorning(garden: GardenState) {
  for (const plot of garden.plots) {
    if (!plot.seed) continue;
    const definition = seedDefinition(plot.seed);
    if (!plot.mature && plot.wateredToday) {
      plot.growth = Math.min(definition.growDays, plot.growth + 1);
      plot.mature = plot.growth >= definition.growDays;
    }
    plot.wateredToday = false;
  }
}
