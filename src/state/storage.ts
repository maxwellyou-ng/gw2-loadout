// Typed, namespaced localStorage helpers. The API key and last sync live here
// (brief: pure client-side, key never leaves the machine).

const PREFIX = 'gw2lt:'

export const STORAGE_KEYS = {
  settings: `${PREFIX}settings`,
  sync: `${PREFIX}sync`,
  loadout: `${PREFIX}loadout`,
  dailyLog: `${PREFIX}dailyLog`,
} as const

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
