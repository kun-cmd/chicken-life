export type EggQuality = 'poor' | 'ordinary' | 'good' | 'excellent';

export interface EggQualityInput {
  nutrition: number;
  dryRest: boolean;
}

export const EGG_BUDGET: Record<EggQuality, number> = {
  poor: 2,
  ordinary: 3,
  good: 4,
  excellent: 5,
};

export const EGG_QUALITY_THRESHOLDS = {
  ordinary: 40,
  good: 60,
  excellent: 80,
} as const;

export function evaluateEggQuality(input: EggQualityInput) {
  const score = Math.max(0, Math.round(input.nutrition));
  const baseQuality = eggQualityForPotential(score);
  const quality = input.dryRest ? baseQuality : downgradeEggQuality(baseQuality);
  return {
    quality,
    budget: EGG_BUDGET[quality],
    score,
  };
}

function eggQualityForPotential(score: number): EggQuality {
  if (score >= EGG_QUALITY_THRESHOLDS.excellent) return 'excellent';
  if (score >= EGG_QUALITY_THRESHOLDS.good) return 'good';
  if (score >= EGG_QUALITY_THRESHOLDS.ordinary) return 'ordinary';
  return 'poor';
}

function downgradeEggQuality(quality: EggQuality): EggQuality {
  if (quality === 'excellent') return 'good';
  if (quality === 'good') return 'ordinary';
  if (quality === 'ordinary') return 'poor';
  return 'poor';
}

export function eggQualityLabel(quality: EggQuality) {
  if (quality === 'excellent') return '金蛋';
  if (quality === 'good') return '较好蛋';
  if (quality === 'ordinary') return '普通蛋';
  return '差蛋';
}
