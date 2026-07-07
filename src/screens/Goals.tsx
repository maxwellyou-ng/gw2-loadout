// ---------------------------------------------------------------------------
// Goals — manage the wishlist (docs/REDESIGN.md §2). One surface for the whole
// goal lifecycle: reorder the ladder (drag, ↑/↓, or one-click sort-by-fastest
// with visible finish-date deltas + undo), pause, remove (undo), resolve
// deciding goals, and close the loop on the trophy shelf.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, CATALOG_BY_ID, type HistoryEntry } from '../state/store'
import { goalEntries, type Goal, type Plan } from '../state/plan'
import { allocateProgress, compareCandidates } from '../engine'
import type { DerivedProgress, SlotFamily } from '../types'
import {
  Badge,
  Card,
  EmptyState,
  InfoTooltip,
  ItemIcon,
  OverlayLink,
  PageHeader,
  ProgressBar,
  ScorePill,
} from '../components/ui'
import MomentumChart from '../components/MomentumChart'
import { STORAGE_KEYS, loadJSON } from '../state/storage'
import { formatDate, daysUntil } from '../lib/format'

/** Days between two ISO dates, floored at 1. */
const daysBetween = (fromISO: string, toISO: string) =>
  Math.max(1, Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86_400_000))

/** Inline-editable plan name (Enter/blur commits, Escape cancels). */
function PlanName({ name }: { name: string }) {
  const { setPlanName } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const commit = () => {
    setPlanName(draft)
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(name)
            setEditing(false)
          }
        }}
        aria-label="Plan name"
        className="min-w-0 rounded-lg border border-line bg-surface-2 px-2 py-1 text-lg font-semibold text-ink outline-none focus:border-accent"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      title="Rename plan"
      className="group flex items-center gap-1.5 text-lg font-semibold text-ink hover:text-accent"
    >
      <span className="truncate">{name}</span>
      <span aria-hidden className="text-xs text-muted group-hover:text-accent">
        ✎
      </span>
    </button>
  )
}

/** One-line derived armory coverage — a view, not a data model. */
function CoverageLine({ goals }: { goals: Goal[] }) {
  const pieces = goals
    .filter((g) => g.pieceId != null)
    .map((g) => CATALOG_BY_ID[g.pieceId!])
    .filter(Boolean)
  const count = (family: SlotFamily) => pieces.filter((p) => p.slot === family).length
  const armor = Math.min(6, count('armor'))
  const trinkets = Math.min(5, count('trinket'))
  const backs = Math.min(1, count('back'))
  return (
    <span className="text-xs text-muted">
      Covers: armor {armor}/6 · weapons {count('weapon')} · trinkets {trinkets}/5 · back{' '}
      {backs}/1
    </span>
  )
}

export default function Goals() {
  const {
    plan,
    sync,
    settings,
    progressByPiece,
    allocatedByGoal,
    removeGoal,
    reorderGoals,
    setGoalState,
    chooseGoalPiece,
  } = useApp()

  const resolvable = (g: Goal) => g.pieceId != null && CATALOG_BY_ID[g.pieceId] != null
  const active = plan.goals.filter((g) => g.state === 'active' && resolvable(g))
  const paused = plan.goals.filter((g) => g.state === 'paused' && resolvable(g))
  const deciding = plan.goals.filter((g) => g.state === 'deciding')
  const done = plan.goals.filter((g) => g.state === 'done' && resolvable(g))

  const progFor = (g: Goal): DerivedProgress | undefined =>
    allocatedByGoal[g.id] ?? (g.pieceId != null ? progressByPiece[g.pieceId] : undefined)

  // --- Sort by fastest finish (docs/UX-BEST-PRACTICES.md §4.4) --------------
  // Isolation signals rank the order (alternatives measured on a level field);
  // the allocation re-runs under the new order and the finish-date deltas are
  // shown per row so the trade-off is visible. Undo restores the old order.
  const [deltas, setDeltas] = useState<Record<string, number> | null>(null)
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sortByFastest = () => {
    const signalsFor = (g: Goal) => {
      const p = progressByPiece[g.pieceId!]
      return {
        timeGateDays: p?.timeGateDebt.reduce((mx, d) => Math.max(mx, d.days), 0) ?? 0,
        gold: p?.buyOutGold ?? 0,
        overlap: p?.remainingMaterials.filter((m) => m.owned > 0).length ?? 0,
      }
    }
    const ordered = [...active].sort((a, b) => compareCandidates(signalsFor(a), signalsFor(b)))
    if (ordered.every((g, i) => g.id === active[i].id)) return // already fastest-first

    // Compute the would-be allocation to show per-goal finish-date deltas.
    const reordered: Plan = {
      ...plan,
      goals: [...ordered, ...plan.goals.filter((g) => !ordered.includes(g))],
    }
    const nextAlloc = allocateProgress(
      goalEntries(reordered),
      sync?.snapshot ?? {},
      sync?.prices ?? {},
      settings.weights,
      sync?.meta,
    )
    const d: Record<string, number> = {}
    for (const g of ordered) {
      const before = daysUntil(progFor(g)?.earliestFinishDate ?? null)
      const after = daysUntil(nextAlloc[g.id]?.earliestFinishDate ?? null)
      if (before != null && after != null && before !== after) d[g.id] = after - before
    }
    reorderGoals(
      ordered.map((g) => g.id),
      'Sorted by fastest finish',
    )
    setDeltas(d)
    if (deltaTimer.current) clearTimeout(deltaTimer.current)
    deltaTimer.current = setTimeout(() => setDeltas(null), 12_000)
  }

  // --- Drag reorder ----------------------------------------------------------
  const [dragId, setDragId] = useState<string | null>(null)
  const activeIds = active.map((g) => g.id)
  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= activeIds.length || from === to) return
    const next = [...activeIds]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    reorderGoals(next)
  }
  const dropOn = (targetId: string) => {
    if (dragId == null || dragId === targetId) return
    reorder(activeIds.indexOf(dragId), activeIds.indexOf(targetId))
    setDragId(null)
  }

  const history = loadJSON<HistoryEntry[]>(STORAGE_KEYS.history, [])

  if (plan.goals.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Goals"
          subtitle="Nothing planned yet — browse the catalog and add your first legendary."
          actions={
            <Link
              to="/catalog"
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-canvas"
            >
              Browse legendaries →
            </Link>
          }
        />
        <EmptyState title="Your ladder is empty">
          Add a goal from the{' '}
          <Link to="/catalog" className="text-accent underline">
            catalog
          </Link>{' '}
          — cost and time-to-finish are shown for your account before you commit.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <PlanName name={plan.name} />
          <p className="mt-0.5 text-sm text-muted">
            {active.length} active · {done.length} done <CoverageLine goals={plan.goals} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={sortByFastest}
            disabled={active.length < 2}
            title="Reorder the ladder so the quickest finishes come first (undoable)"
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-accent"
          >
            Sort by fastest finish
          </button>
          <Link
            to="/catalog"
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-canvas"
          >
            Add legendary →
          </Link>
        </div>
      </div>

      {/* --- Active ladder --- */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Ladder</h3>
          <InfoTooltip label="Top of the ladder gets first claim on your owned materials — lower goals see what's left. Drag or use ↑/↓ to reprioritize." />
        </div>
        {active.length === 0 ? (
          <EmptyState title="No active goals">Resume a paused goal or add a new one.</EmptyState>
        ) : (
          <div className="space-y-2">
            {active.map((g, i) => {
              const piece = CATALOG_BY_ID[g.pieceId!]
              const prog = progFor(g)
              const delta = deltas?.[g.id]
              return (
                <Card
                  key={g.id}
                  draggable
                  onDragStart={() => setDragId(g.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(g.id)}
                  className={`flex items-center justify-between gap-3 cursor-grab ${
                    dragId === g.id ? 'opacity-50 ring-1 ring-accent' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <span aria-hidden className="shrink-0 select-none text-muted">
                      ⠿
                    </span>
                    <span className="w-5 shrink-0 text-center font-mono text-sm text-muted">
                      {i + 1}
                    </span>
                    <ItemIcon itemId={piece.id} name={piece.name} size={32} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <OverlayLink
                          to={`/piece/${piece.id}`}
                          draggable={false}
                          className="truncate font-medium text-ink hover:text-accent"
                        >
                          {piece.name}
                        </OverlayLink>
                        {delta != null && (
                          <Badge tone={delta > 0 ? 'warn' : 'good'}>
                            {delta > 0 ? `slips +${delta}d` : `${delta}d sooner`}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted">
                        {piece.type}
                        {prog?.earliestFinishDate &&
                          !prog.owned &&
                          ` · earliest ${formatDate(prog.earliestFinishDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ProgressBar
                      value={prog?.owned ? 1 : prog?.completionScore ?? 0}
                      className="hidden h-1.5 w-24 sm:block"
                    />
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => reorder(i, i - 1)}
                        disabled={i === 0}
                        aria-label={`Move ${piece.name} up`}
                        className="shrink-0 rounded border border-line px-1.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => reorder(i, i + 1)}
                        disabled={i === active.length - 1}
                        aria-label={`Move ${piece.name} down`}
                        className="shrink-0 rounded border border-line px-1.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGoalState(g.id, 'paused')}
                      title="Shelve without losing it — paused goals consume nothing"
                      className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-accent"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(g.id)}
                      aria-label={`Remove ${piece.name}`}
                      title="Remove from plan (undoable)"
                      className="shrink-0 rounded px-1.5 text-muted hover:text-bad"
                    >
                      ✕
                    </button>
                    <ScorePill value={prog?.completionScore ?? 0} done={prog?.owned} />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* --- Deciding --- */}
      {deciding.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Deciding</h3>
            <InfoTooltip label="Goals you're still weighing candidates for. Compare ranks them by remaining effort; choosing promotes the goal to the ladder." />
          </div>
          <div className="space-y-2">
            {deciding.map((g) => {
              const candidates = g.candidateIds
                .map((id) => CATALOG_BY_ID[id])
                .filter(Boolean)
              return (
                <Card key={g.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {candidates.length > 0
                        ? candidates.map((p) => p.name).slice(0, 4).join(' vs ')
                        : 'No candidates yet'}
                    </p>
                    <p className="text-xs text-muted">
                      {candidates.length} candidate{candidates.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {candidates.length === 1 && (
                      <button
                        type="button"
                        onClick={() => chooseGoalPiece(g.id, candidates[0].id)}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent"
                      >
                        Choose {candidates[0].name}
                      </button>
                    )}
                    <OverlayLink
                      to={`/compare?goal=${g.id}`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Compare →
                    </OverlayLink>
                    <button
                      type="button"
                      onClick={() => removeGoal(g.id)}
                      aria-label="Remove deciding goal"
                      className="rounded px-1.5 text-muted hover:text-bad"
                    >
                      ✕
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* --- Paused --- */}
      {paused.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Paused</h3>
          <div className="space-y-2">
            {paused.map((g) => {
              const piece = CATALOG_BY_ID[g.pieceId!]
              const prog = g.pieceId != null ? progressByPiece[g.pieceId] : undefined
              return (
                <Card key={g.id} className="flex items-center justify-between gap-3 opacity-60">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ItemIcon itemId={piece.id} name={piece.name} size={28} />
                    <OverlayLink
                      to={`/piece/${piece.id}`}
                      className="truncate text-sm font-medium text-ink hover:text-accent"
                    >
                      {piece.name}
                    </OverlayLink>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGoalState(g.id, 'active')}
                      className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-accent"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(g.id)}
                      aria-label={`Remove ${piece.name}`}
                      className="rounded px-1.5 text-muted hover:text-bad"
                    >
                      ✕
                    </button>
                    <ScorePill value={prog?.completionScore ?? 0} done={prog?.owned} />
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* --- Trophy shelf --- */}
      {(done.length > 0 || history.length >= 2) && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Trophy shelf
          </h3>
          {done.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {done.map((g) => {
                const piece = CATALOG_BY_ID[g.pieceId!]
                const took = g.completedAt ? daysBetween(g.addedAt, g.completedAt) : null
                return (
                  <Card key={g.id} className="border-accent/30 bg-accent-soft/40">
                    <div className="flex items-center gap-3">
                      <ItemIcon itemId={piece.id} name={piece.name} size={40} />
                      <div className="min-w-0">
                        <OverlayLink
                          to={`/piece/${piece.id}`}
                          className="block truncate font-semibold text-ink hover:text-accent"
                        >
                          {piece.name}
                        </OverlayLink>
                        <p className="text-xs text-muted">
                          {g.completedAt ? `Unlocked ${formatDate(g.completedAt)}` : 'Unlocked'}
                          {took != null && ` · ${took}d in the making`}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
          {history.length >= 2 && (
            <Card>
              <MomentumChart entries={history} />
            </Card>
          )}
        </section>
      )}
    </div>
  )
}
