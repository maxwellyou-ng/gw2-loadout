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
  useRef,
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
import type { Loadout } from '../data/loadout'
import { allocateProgress, computeProgress, isOwned } from '../engine'
import { syncAccount } from '../api/gw2'
import { STORAGE_KEYS, loadJSON, saveJSON, removeKey, onStorageError } from './storage'
import {
  emptyPlan,
  goalEntries,
  makeGoal,
  migrateLoadoutToPlan,
  normalizePlan,
  type Goal,
  type GoalState,
  type Plan,
} from './plan'

interface SyncState {
  snapshot: InventorySnapshot
  prices: PriceMap
  meta: SyncMeta
  warnings: string[]
}

/**
 * Completion detection (docs/REDESIGN.md §4.4): flip owned goals to done for a
 * sync the plan hasn't processed yet. The first sync a plan ever processes is
 * silent (celebrated: true) — no confetti for pieces finished before the
 * tracker knew about them; later syncs queue a one-time celebration. Pure:
 * called from the plan's initializer (stored sync) and the sync handler.
 */
function applyCompletions(plan: Plan, syncState: SyncState | null): Plan {
  const ts = syncState?.meta.lastSynced
  if (!ts || plan.lastProcessedSync === ts) return plan
  const firstEver = plan.lastProcessedSync == null
  const today = new Date().toISOString().slice(0, 10)
  return {
    ...plan,
    lastProcessedSync: ts,
    goals: plan.goals.map((g) => {
      if (g.pieceId == null || (g.state !== 'active' && g.state !== 'paused')) return g
      const piece = CATALOG_BY_ID[g.pieceId]
      if (!piece || !isOwned(piece, syncState.meta)) return g
      return {
        ...g,
        state: 'done' as const,
        completedAt: g.completedAt ?? today,
        celebrated: firstEver ? true : (g.celebrated ?? false),
      }
    }),
  }
}

/** One logged sync, for the snapshot-history momentum chart. */
export interface HistoryEntry {
  ts: string // ISO sync timestamp
  overall: number // mean completion across tracked+chosen slots (0..1)
  byPiece: Record<number, number> // pieceId -> completionScore
}

interface AppState {
  settings: Settings
  /** Goal-centric plan — the source of truth (docs/REDESIGN.md §5). */
  plan: Plan
  sync: SyncState | null
  syncing: boolean
  syncMessage: string
  syncError: string | null
  /** ISO timestamp of the previous visit (null on first ever load). */
  previousVisit: string | null
  /** Per-piece progress in isolation (each piece sees the full inventory). */
  progressByPiece: Record<number, DerivedProgress>
  /**
   * Consumption-correct per-goal progress, keyed by goal id: active goals in
   * ladder order against a depleting inventory, so one stack never satisfies
   * two pieces at once. Multi-goal views read this; Compare stays
   * isolation-based (candidates are alternatives).
   */
  allocatedByGoal: Record<string, DerivedProgress>
  /** TP prices present in the last sync — buy-out figures are only real then. */
  pricesLoaded: boolean
  /** A localStorage write failed (quota/blocked): edits aren't persisting. */
  storageFailing: boolean
  setApiKey: (key: string) => void
  /** Wipe the stored API key and all synced account data (key, snapshot, history). */
  forgetAccount: () => void
  runSync: () => Promise<void>
  /** Single-level undo for destructive plan mutations (remove/reorder/import). */
  undo: { label: string } | null
  performUndo: () => void
  dismissUndo: () => void
  // Plan (goal) mutators — the screens' write API.
  setPlanName: (name: string) => void
  /** Append an active goal for a piece (or a deciding goal when weighing). */
  addGoal: (init: Partial<Goal> & Pick<Goal, 'pieceId' | 'state'>) => void
  /** Remove a goal, capturing an undo snapshot. */
  removeGoal: (id: string) => void
  /** Reorder goals to the given id order, capturing an undo snapshot. */
  reorderGoals: (orderedIds: string[], label?: string) => void
  setGoalState: (id: string, state: GoalState) => void
  setGoalCandidates: (id: string, candidateIds: number[]) => void
  /** Resolve a deciding goal to a concrete piece (state → active). */
  chooseGoalPiece: (id: string, pieceId: number) => void
  /** Mark a done goal's celebration as shown. */
  markCelebrated: (id: string) => void
  /** Replace the whole plan (build-code import), capturing an undo snapshot. */
  importPlan: (next: Plan) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    loadJSON<Settings>(STORAGE_KEYS.settings, { apiKey: '', weights: DEFAULT_WEIGHTS }),
  )
  // Plan (goal-centric source of truth). First load migrates the legacy slot
  // model once; the old key stays in localStorage for rollback.
  const [plan, setPlan] = useState<Plan>(() => {
    const stored = loadJSON<Plan | null>(STORAGE_KEYS.plan, null)
    const base = (() => {
      if (stored && stored.version === 2) return normalizePlan(stored)
      const legacy = loadJSON<Loadout | null>(STORAGE_KEYS.loadout, null)
      return legacy ? migrateLoadoutToPlan(legacy) : emptyPlan()
    })()
    // A sync stored before this plan was created (or before this visit) may
    // already report goals unlocked — process it once, silently if first ever.
    return applyCompletions(base, loadJSON<SyncState | null>(STORAGE_KEYS.sync, null))
  })
  // Previous-visit marker for the welcome-back diff: read the old value once,
  // then stamp this visit.
  const [previousVisit] = useState<string | null>(() =>
    loadJSON<string | null>(STORAGE_KEYS.lastVisit, null),
  )
  useEffect(() => {
    saveJSON(STORAGE_KEYS.lastVisit, new Date().toISOString())
  }, [])
  const [sync, setSync] = useState<SyncState | null>(() =>
    loadJSON<SyncState | null>(STORAGE_KEYS.sync, null),
  )
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [storageFailing, setStorageFailing] = useState(false)

  useEffect(() => onStorageError(() => setStorageFailing(true)), [])

  useEffect(() => saveJSON(STORAGE_KEYS.settings, settings), [settings])
  useEffect(() => saveJSON(STORAGE_KEYS.plan, plan), [plan])
  useEffect(() => {
    if (sync) saveJSON(STORAGE_KEYS.sync, sync)
  }, [sync])

  const setApiKey = useCallback((apiKey: string) => {
    setSettings((s) => ({ ...s, apiKey }))
  }, [])

  const forgetAccount = useCallback(() => {
    setSettings((s) => ({ ...s, apiKey: '' }))
    setSync(null)
    setSyncError(null)
    setSyncMessage('')
    // setSettings persists via the settings effect; sync/history have no
    // clear-on-null effect, so remove them from localStorage directly. The
    // next sync carries a fresh timestamp, so the history-logging ref needs
    // no reset here.
    removeKey(STORAGE_KEYS.sync)
    removeKey(STORAGE_KEYS.history)
  }, [])

  // --- Single-level undo for destructive mutations --------------------------
  // Each destructive mutator captures a restore closure over the pre-mutation
  // state; Undo runs it. New captures replace the previous one (single level).
  const [undoEntry, setUndoEntry] = useState<{ label: string; restore: () => void } | null>(
    null,
  )

  const performUndo = useCallback(() => {
    if (!undoEntry) return
    undoEntry.restore()
    setUndoEntry(null)
  }, [undoEntry])

  const dismissUndo = useCallback(() => setUndoEntry(null), [])

  // --- Plan (goal) mutators --------------------------------------------------
  const setPlanName = useCallback(
    (name: string) => setPlan((p) => ({ ...p, name: name.trim() || 'My plan' })),
    [],
  )

  const addGoal = useCallback(
    (init: Partial<Goal> & Pick<Goal, 'pieceId' | 'state'>) =>
      setPlan((p) => ({ ...p, goals: [...p.goals, makeGoal(init)] })),
    [],
  )

  const removeGoal = useCallback(
    (id: string) => {
      const prev = plan
      const goal = prev.goals.find((g) => g.id === id)
      const name = goal?.pieceId != null ? CATALOG_BY_ID[goal.pieceId]?.name : undefined
      setUndoEntry({
        label: name ? `Removed ${name}` : 'Removed goal',
        restore: () => setPlan(prev),
      })
      setPlan((p) => ({ ...p, goals: p.goals.filter((g) => g.id !== id) }))
    },
    [plan],
  )

  const reorderGoals = useCallback(
    (orderedIds: string[], label = 'Reordered goals') => {
      const prev = plan
      setUndoEntry({ label, restore: () => setPlan(prev) })
      setPlan((p) => {
        const byId = new Map(p.goals.map((g) => [g.id, g]))
        const inOrder = orderedIds.map((id) => byId.get(id)).filter((g): g is Goal => !!g)
        const rest = p.goals.filter((g) => !orderedIds.includes(g.id))
        return { ...p, goals: [...inOrder, ...rest] }
      })
    },
    [plan],
  )

  const setGoalState = useCallback(
    (id: string, state: GoalState) =>
      setPlan((p) => ({
        ...p,
        goals: p.goals.map((g) => (g.id === id ? { ...g, state } : g)),
      })),
    [],
  )

  const setGoalCandidates = useCallback(
    (id: string, candidateIds: number[]) =>
      setPlan((p) => ({
        ...p,
        goals: p.goals.map((g) => (g.id === id ? { ...g, candidateIds } : g)),
      })),
    [],
  )

  const chooseGoalPiece = useCallback(
    (id: string, pieceId: number) =>
      setPlan((p) => ({
        ...p,
        goals: p.goals.map((g) =>
          g.id === id ? { ...g, pieceId, state: 'active' as const } : g,
        ),
      })),
    [],
  )

  const markCelebrated = useCallback(
    (id: string) =>
      setPlan((p) => ({
        ...p,
        goals: p.goals.map((g) => (g.id === id ? { ...g, celebrated: true } : g)),
      })),
    [],
  )

  const importPlan = useCallback(
    (next: Plan) => {
      const prev = plan
      setUndoEntry({ label: 'Imported build code', restore: () => setPlan(prev) })
      setPlan(normalizePlan(next))
    },
    [plan],
  )

  // Stable view of the undo entry (label only) so the toast's auto-dismiss
  // timer keys off capture identity, not store re-renders.
  const undoView = useMemo(
    () => (undoEntry ? { label: undoEntry.label } : null),
    [undoEntry],
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
      setPlan((p) => applyCompletions(p, result))
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

  // Plan-driven allocation: active goals in ladder order, keyed by goal id.
  const planEntries = useMemo(() => goalEntries(plan), [plan])
  const allocatedByGoal = useMemo(
    () =>
      allocateProgress(
        planEntries,
        sync?.snapshot ?? {},
        sync?.prices ?? {},
        settings.weights,
        sync?.meta,
      ),
    [planEntries, sync, settings.weights],
  )

  // Snapshot history: log one record per *new* sync timestamp, computed over
  // the plan's tracked goals (allocation-aware: shared stock credits one piece,
  // not several). Guarded by a ref so re-renders don't re-log the same sync.
  const lastLoggedTs = useRef<string | null>(
    loadJSON<HistoryEntry[]>(STORAGE_KEYS.history, []).at(-1)?.ts ?? null,
  )
  useEffect(() => {
    const ts = sync?.meta.lastSynced
    if (!ts || ts === lastLoggedTs.current) return
    const tracked = planEntries.filter((e) => e.tracked)
    const byPiece: Record<number, number> = {}
    let sum = 0
    let counted = 0
    for (const entry of tracked) {
      const p = allocatedByGoal[entry.key] ?? progressByPiece[entry.chosenPieceId!]
      if (!p) continue
      byPiece[p.pieceId] = p.completionScore
      sum += p.completionScore
      counted++
    }
    const overall = counted ? sum / counted : 0
    const hist = loadJSON<HistoryEntry[]>(STORAGE_KEYS.history, [])
    const next = [...hist.filter((h) => h.ts !== ts), { ts, overall, byPiece }].slice(-100)
    saveJSON(STORAGE_KEYS.history, next)
    lastLoggedTs.current = ts
  }, [sync, progressByPiece, allocatedByGoal, planEntries])

  const value: AppState = {
    settings,
    plan,
    sync,
    syncing,
    syncMessage,
    syncError,
    previousVisit,
    progressByPiece,
    allocatedByGoal,
    pricesLoaded: !!sync && Object.keys(sync.prices).length > 0,
    storageFailing,
    setApiKey,
    forgetAccount,
    runSync,
    undo: undoView,
    performUndo,
    dismissUndo,
    setPlanName,
    addGoal,
    removeGoal,
    reorderGoals,
    setGoalState,
    setGoalCandidates,
    chooseGoalPiece,
    markCelebrated,
    importPlan,
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
