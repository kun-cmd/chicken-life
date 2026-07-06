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
  sunnyHeatPerActiveSecond: 0.8,
  movingHeatPerActiveSecond: 1.2,
  sprintHeatPerActiveSecond: 7,
  shadeCoolingPerActiveSecond: 4.5,
  rainCoolingPerActiveSecond: 2.4,
  waterCoolingPerActiveSecond: 24,
  passiveCoolingPerActiveSecond: 1.2,
  sprintPenaltyStartsAt: 65,
  minimumSprintScale: 0.55,
} as const;

export function advanceHeat(current: number, dt: number, context: HeatContext) {
  const seconds = Math.max(0, dt);
  let change = context.night ? 0 : BODY_COMFORT_TUNING.sunnyHeatPerActiveSecond;

  if (context.moving) change += BODY_COMFORT_TUNING.movingHeatPerActiveSecond;
  if (context.sprinting) change += BODY_COMFORT_TUNING.sprintHeatPerActiveSecond;
  if (!context.moving) change -= BODY_COMFORT_TUNING.passiveCoolingPerActiveSecond;
  if (context.inShade) change -= BODY_COMFORT_TUNING.shadeCoolingPerActiveSecond;
  if (context.raining) change -= BODY_COMFORT_TUNING.rainCoolingPerActiveSecond;
  if (context.drinking) change -= BODY_COMFORT_TUNING.waterCoolingPerActiveSecond;

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
