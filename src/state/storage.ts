// Typed, namespaced localStorage helpers. The API key and last sync live here
// (brief: pure client-side, key never leaves the machine).

const PREFIX = 'gw2lt:'

export const STORAGE_KEYS = {
  settings: `${PREFIX}settings`,
  sync: `${PREFIX}sync`,
  loadout: `${PREFIX}loadout`,
  dailyLog: `${PREFIX}dailyLog`,
  paceOverrides: `${PREFIX}paceOverrides`,
  history: `${PREFIX}history`,
} as const

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

type StorageErrorListener = (key: string, error: unknown) => void
const errorListeners = new Set<StorageErrorListener>()

/** Notify when a save fails (quota exceeded / storage disabled), so the UI can
 *  warn that changes aren't persisting instead of failing silently. */
export function onStorageError(listener: StorageErrorListener): () => void {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // Quota / disabled storage — non-fatal, but the user must know their
    // edits won't survive a reload.
    for (const l of errorListeners) l(key, e)
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
