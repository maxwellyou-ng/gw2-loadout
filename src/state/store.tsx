// ---------------------------------------------------------------------------
// App store: settings + last sync + loadout, persisted to localStorage, plus
// derived per-piece progress recomputed whenever inputs change.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  DerivedProgress,
  InventorySnapshot,
  PriceMap,
  Settings,
  SyncMeta,
} from '../types'
import { DEFAULT_WEIGHTS } from '../types'
import { CATALOG, CATALOG_BY_ID } from '../data/recipes'
import {
  buildSeedLoadout,
  normalizeLoadout,
  type Loadout,
  type LoadoutSlot,
} from '../data/loadout'
import type { SlotKey } from '../types'
import { computeProgress } from '../engine'
import { syncAccount } from '../api/gw2'
import { STORAGE_KEYS, loadJSON, saveJSON } from './storage'

interface SyncState {
  snapshot: InventorySnapshot
  prices: PriceMap
  meta: SyncMeta
  warnings: string[]
}

interface AppState {
  settings: Settings
  loadout: Loadout
  sync: SyncState | null
  syncing: boolean
  syncMessage: string
  syncError: string | null
  progressByPiece: Record<number, DerivedProgress>
  setApiKey: (key: string) => void
  setWeights: (w: Settings['weights']) => void
  runSync: () => Promise<void>
  // Loadout mutators (pure/immutable; progress re-derives via the useMemo below).
  setLoadout: (loadout: Loadout) => void
  setSlotPiece: (key: SlotKey, pieceId: number | null) => void
  setSlotFlexible: (key: SlotKey, flexible: boolean) => void
  setSlotTracked: (key: SlotKey, tracked: boolean) => void
  setSlotPriority: (key: SlotKey, priority: number | 'defer') => void
  setSlotCandidates: (key: SlotKey, candidateIds: number[]) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    loadJSON<Settings>(STORAGE_KEYS.settings, { apiKey: '', weights: DEFAULT_WEIGHTS }),
  )
  const [loadout, setLoadout] = useState<Loadout>(() =>
    normalizeLoadout(loadJSON<Loadout>(STORAGE_KEYS.loadout, buildSeedLoadout())),
  )
  const [sync, setSync] = useState<SyncState | null>(() =>
    loadJSON<SyncState | null>(STORAGE_KEYS.sync, null),
  )
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => saveJSON(STORAGE_KEYS.settings, settings), [settings])
  useEffect(() => saveJSON(STORAGE_KEYS.loadout, loadout), [loadout])
  useEffect(() => {
    if (sync) saveJSON(STORAGE_KEYS.sync, sync)
  }, [sync])

  const setApiKey = useCallback((apiKey: string) => {
    setSettings((s) => ({ ...s, apiKey }))
  }, [])

  const setWeights = useCallback((weights: Settings['weights']) => {
    setSettings((s) => ({ ...s, weights }))
  }, [])

  // Immutable per-slot patch helper: replaces one slot, leaving the rest intact.
  const patchSlot = useCallback(
    (key: SlotKey, patch: (slot: LoadoutSlot) => LoadoutSlot) => {
      setLoadout((l) => ({
        ...l,
        slots: l.slots.map((s) => (s.key === key ? patch(s) : s)),
      }))
    },
    [],
  )

  const setSlotPiece = useCallback(
    (key: SlotKey, pieceId: number | null) =>
      patchSlot(key, (s) => ({ ...s, chosenPieceId: pieceId })),
    [patchSlot],
  )
  const setSlotFlexible = useCallback(
    (key: SlotKey, flexible: boolean) => patchSlot(key, (s) => ({ ...s, flexible })),
    [patchSlot],
  )
  const setSlotTracked = useCallback(
    (key: SlotKey, tracked: boolean) => patchSlot(key, (s) => ({ ...s, tracked })),
    [patchSlot],
  )
  const setSlotPriority = useCallback(
    (key: SlotKey, priority: number | 'defer') =>
      patchSlot(key, (s) => ({ ...s, priority })),
    [patchSlot],
  )
  const setSlotCandidates = useCallback(
    (key: SlotKey, candidateIds: number[]) =>
      patchSlot(key, (s) => ({ ...s, candidateIds })),
    [patchSlot],
  )

  const runSync = useCallback(async () => {
    if (!settings.apiKey.trim()) {
      setSyncError('Enter a GW2 API key first.')
      return
    }
    setSyncing(true)
    setSyncError(null)
    setSyncMessage('Starting sync…')
    try {
      const result = await syncAccount(settings.apiKey.trim(), setSyncMessage)
      setSync(result)
      setSyncMessage('')
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [settings.apiKey])

  const progressByPiece = useMemo(() => {
    const snapshot = sync?.snapshot ?? {}
    const prices = sync?.prices ?? {}
    const meta = sync?.meta
    const out: Record<number, DerivedProgress> = {}
    for (const piece of CATALOG) {
      out[piece.id] = computeProgress(piece, snapshot, prices, settings.weights, meta)
    }
    return out
  }, [sync, settings.weights])

  const value: AppState = {
    settings,
    loadout,
    sync,
    syncing,
    syncMessage,
    syncError,
    progressByPiece,
    setApiKey,
    setWeights,
    runSync,
    setLoadout,
    setSlotPiece,
    setSlotFlexible,
    setSlotTracked,
    setSlotPriority,
    setSlotCandidates,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { CATALOG_BY_ID }
