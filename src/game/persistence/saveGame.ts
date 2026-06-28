export const SAVE_VERSION = 3;
export const SAVE_KEY = 'chicken-life-save-v3';
export const LEGACY_SAVE_KEY = 'chicken-life-save-v2';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type SaveLoadResult =
  | { kind: 'empty' }
  | { kind: 'legacy' }
  | { kind: 'loaded'; state: unknown; savedAt: number };

export function loadSaveEnvelope(storage: StorageLike): SaveLoadResult {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) {
      return storage.getItem(LEGACY_SAVE_KEY) ? { kind: 'legacy' } : { kind: 'empty' };
    }
    const parsed = JSON.parse(raw) as { version?: unknown; savedAt?: unknown; state?: unknown };
    if (parsed.version !== SAVE_VERSION || !parsed.state || typeof parsed.state !== 'object') {
      return { kind: 'empty' };
    }
    return {
      kind: 'loaded',
      state: parsed.state,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return { kind: 'empty' };
  }
}

export function writeSaveEnvelope(storage: StorageLike, state: unknown, savedAt = Date.now()) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt, state }));
    return true;
  } catch {
    return false;
  }
}
