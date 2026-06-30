export type RelationshipStage = 'wary' | 'familiar' | 'trusting' | 'bonded';
export type TrustMemoryKind = 'close-interaction' | 'safe-close' | 'first-rescue';

export interface RelationshipState {
  memories: number;
  dailyKeys: string[];
  rescueRecorded: boolean;
}

export function createRelationshipState(): RelationshipState {
  return { memories: 0, dailyKeys: [], rescueRecorded: false };
}

export function recordTrustMemory(
  state: RelationshipState,
  day: number,
  kind: TrustMemoryKind,
) {
  if (kind === 'first-rescue') {
    if (state.rescueRecorded) return false;
    state.rescueRecorded = true;
    state.memories += 1;
    return true;
  }

  const key = `${day}:${kind}`;
  if (state.dailyKeys.includes(key)) return false;
  state.dailyKeys.push(key);
  state.memories += 1;
  return true;
}

export function relationshipStage(
  state: RelationshipState,
  day: number,
): RelationshipStage {
  if (day >= 11 && state.memories >= 19) return 'bonded';
  if (day >= 7 && state.memories >= 9) return 'trusting';
  if (day >= 3 && state.memories >= 3) return 'familiar';
  return 'wary';
}
