export type CatPersonality = 'watcher' | 'lounger' | 'bold-kitten' | 'shy-kitten';

export type CatTrustMemory =
  | 'quiet-company'
  | 'gave-space'
  | 'cluck-conversation'
  | 'ball-play'
  | 'music-shared';

export type CatTrustStage = 'wary' | 'accepted' | 'familiar' | 'close' | 'family';

export interface CatFamilyState {
  met: boolean;
  trust: number;
  experienced: CatTrustMemory[];
  today: CatTrustMemory[];
  quietSeconds: number;
  musicSeconds: number;
}

const MEMORY_GAINS: Record<CatTrustMemory, number> = {
  'quiet-company': 1,
  'gave-space': 2,
  'cluck-conversation': 1,
  'ball-play': 2,
  'music-shared': 2,
};

const CAT_TRUST_MEMORIES = Object.keys(MEMORY_GAINS) as CatTrustMemory[];

export function createCatFamilyState(): CatFamilyState {
  return {
    met: false,
    trust: 0,
    experienced: [],
    today: [],
    quietSeconds: 0,
    musicSeconds: 0,
  };
}

export function restoreCatFamilyState(saved: Partial<CatFamilyState> | null | undefined) {
  const fresh = createCatFamilyState();
  if (!saved || typeof saved !== 'object') return fresh;
  return {
    met: Boolean(saved.met),
    trust: finiteNonNegative(saved.trust),
    experienced: uniqueMemories(saved.experienced),
    today: uniqueMemories(saved.today),
    quietSeconds: finiteNonNegative(saved.quietSeconds),
    musicSeconds: finiteNonNegative(saved.musicSeconds),
  };
}

export function resetCatFamilyDay(state: CatFamilyState) {
  state.today = [];
  state.quietSeconds = 0;
  state.musicSeconds = 0;
}

export function recordCatTrustMemory(state: CatFamilyState, memory: CatTrustMemory) {
  const previousStage = catTrustStage(state);
  if (state.today.includes(memory)) {
    return { recorded: false, previousStage, nextStage: previousStage };
  }

  state.today.push(memory);
  if (!state.experienced.includes(memory)) state.experienced.push(memory);
  state.trust += MEMORY_GAINS[memory];
  return {
    recorded: true,
    previousStage,
    nextStage: catTrustStage(state),
  };
}

export function catTrustStage(state: CatFamilyState): CatTrustStage {
  const variety = state.experienced.length;
  if (state.trust >= 18 && variety >= 4) return 'family';
  if (state.trust >= 11 && variety >= 3) return 'close';
  if (state.trust >= 6 && variety >= 2) return 'familiar';
  if (state.trust >= 2) return 'accepted';
  return 'wary';
}

export function catTrustStageRank(stage: CatTrustStage) {
  return ['wary', 'accepted', 'familiar', 'close', 'family'].indexOf(stage);
}

function uniqueMemories(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isCatTrustMemory))];
}

function isCatTrustMemory(value: unknown): value is CatTrustMemory {
  return typeof value === 'string' && CAT_TRUST_MEMORIES.includes(value as CatTrustMemory);
}

function finiteNonNegative(value: unknown) {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}
