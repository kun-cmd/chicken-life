export function shouldStartFinale(day: number, endingSeen: boolean) {
  return day === 14 && !endingSeen;
}

export function captureFinaleCheckpoint<T extends { finaleCheckpointJson: string | null }>(
  state: T,
) {
  const copy = structuredClone(state);
  copy.finaleCheckpointJson = null;
  return JSON.stringify(copy);
}

export function restoreFinaleCheckpoint<T>(checkpointJson: string): T {
  return JSON.parse(checkpointJson) as T;
}
