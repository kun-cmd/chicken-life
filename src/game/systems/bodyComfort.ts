export interface HeatContext {
  sprinting: boolean;
  moving: boolean;
  inShade: boolean;
  drinking: boolean;
  raining: boolean;
  night: boolean;
}

export const BODY_COMFORT_TUNING = {
  maxHeat: 100,
  sunnyIdleHeatPerSecond: 1.2,
  movingHeatPerSecond: 1.8,
  sprintHeatPerSecond: 17,
  shadeCoolingPerSecond: 7,
  rainCoolingPerSecond: 4,
  waterCoolingPerSecond: 32,
  passiveCoolingPerSecond: 1.6,
  sprintPenaltyStartsAt: 65,
  minimumSprintScale: 0.55,
} as const;

export function advanceHeat(current: number, dt: number, context: HeatContext) {
  const seconds = Math.max(0, dt);
  let change = context.night ? 0 : BODY_COMFORT_TUNING.sunnyIdleHeatPerSecond;

  if (context.moving) change += BODY_COMFORT_TUNING.movingHeatPerSecond;
  if (context.sprinting) change += BODY_COMFORT_TUNING.sprintHeatPerSecond;
  if (!context.moving) change -= BODY_COMFORT_TUNING.passiveCoolingPerSecond;
  if (context.inShade) change -= BODY_COMFORT_TUNING.shadeCoolingPerSecond;
  if (context.raining) change -= BODY_COMFORT_TUNING.rainCoolingPerSecond;
  if (context.drinking) change -= BODY_COMFORT_TUNING.waterCoolingPerSecond;

  return clamp(current + change * seconds, 0, BODY_COMFORT_TUNING.maxHeat);
}

export function sprintScaleForHeat(heat: number) {
  const start = BODY_COMFORT_TUNING.sprintPenaltyStartsAt;
  if (heat <= start) return 1;
  const ratio = clamp(
    (heat - start) / (BODY_COMFORT_TUNING.maxHeat - start),
    0,
    1,
  );
  return 1 - ratio * (1 - BODY_COMFORT_TUNING.minimumSprintScale);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
