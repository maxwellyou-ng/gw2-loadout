// ---------------------------------------------------------------------------
// Daily dashboard (brief Phase 3): "what's the best thing to do today?"
//
// Three signals, all over *tracked* pieces and honoring priority order:
//   1. Time-gate hygiene — daily-capped mats to act on today (de-duplicated
//      across pieces via aggregateRequirements, so clovers count once).
//   2. Finish-line pushes — nearly-done pieces with a short finish window.
//   3. Summary — completion ring, nearest finishes, total time-gate debt.
//
// Daily "collected today" state: a lightweight localStorage map
// (dailyLog[itemId] = ISO date). A "Mark collected today" toggle moves a row
// to the bottom and dims it for the rest of the calendar day. It is purely
// advisory progress-keeping — it never alters computed material counts.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import {
  aggregateRequirements,
  pieceForSlot,
  plannedSlots,
  priorityRank,
  progressForSlot,
} from '../engine'
import { Card, Ring, SeverityDot, EmptyState, ScorePill, OverlayLink } from '../components/ui'
import { formatGold, formatDate, formatPercent, daysUntil } from '../lib/format'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../state/storage'
import type { LoadoutSlot } from '../data/loadout'
import type { SlotKey } from '../types'

const todayISO = () => new Date().toISOString().slice(0, 10)

function useDailyLog() {
  const [log, setLog] = useState<Record<number, string>>(() =>
    loadJSON<Record<number, string>>(STORAGE_KEYS.dailyLog, {}),
  )
  const collectedToday = (itemId: number) => log[itemId] === todayISO()
  const toggle = (itemId: number) => {
    setLog((prev) => {
      const next = { ...prev }
      if (next[itemId] === todayISO()) delete next[itemId]
      else next[itemId] = todayISO()
      saveJSON(STORAGE_KEYS.dailyLog, next)
      return next
    })
  }
  return { collectedToday, toggle }
}

export default function Dashboard() {
  const { loadout, sync, progressByPiece } = useApp()
  const { collectedToday, toggle } = useDailyLog()

  const slots = useMemo(() => plannedSlots(loadout), [loadout])

  // Chosen-but-untracked pieces — the bottom "Untracked" zone of the ladder.
  const untrackedChosen = useMemo(
    () =>
      loadout.slots
        .filter((s) => !s.tracked && pieceForSlot(s) != null)
        .sort((a, b) => priorityRank(a) - priorityRank(b)),
    [loadout],
  )

  const agg = useMemo(
    () => aggregateRequirements(slots, sync?.snapshot ?? {}, sync?.prices ?? {}, sync?.meta),
    [slots, sync],
  )

  // --- Summary numbers (tracked + chosen pieces only) ----------------------
  const scored = slots.map((s) => progressForSlot(s, progressByPiece)).filter((p) => p != null)
  const avgScore =
    scored.length > 0 ? scored.reduce((sum, p) => sum + p!.completionScore, 0) / scored.length : 0
  const doneCount = scored.filter((p) => p!.owned).length

  // Nearest finishes: not-owned pieces with a projected finish date, soonest first.
  const nearest = slots
    .map((s) => ({ slot: s, prog: progressForSlot(s, progressByPiece) }))
    .filter((x) => x.prog && !x.prog.owned && x.prog.earliestFinishDate)
    .sort(
      (a, b) =>
        new Date(a.prog!.earliestFinishDate!).getTime() -
        new Date(b.prog!.earliestFinishDate!).getTime(),
    )
    .slice(0, 5)

  const totalDebtDays = agg.timeGateDebt.reduce((mx, d) => Math.max(mx, d.days), 0)

  // --- Finish-line pushes: nearly done, short finish window ----------------
  const pushes = slots
    .map((s) => ({ slot: s, prog: progressForSlot(s, progressByPiece) }))
    .filter((x) => {
      const p = x.prog
      if (!p || p.owned) return false
      if (p.finishableByGold) return true // everything left is purchasable
      const d = daysUntil(p.earliestFinishDate)
      return p.completionScore >= 0.8 && d != null && d <= 14
    })
    .sort((a, b) => b.prog!.completionScore - a.prog!.completionScore)

  if (slots.length === 0) {
    return (
      <EmptyState title="Nothing tracked yet">
        Pick pieces for your slots on the{' '}
        <Link to="/loadout" className="text-accent underline">
          Loadout
        </Link>{' '}
        tab, then come back here for a daily plan.
      </EmptyState>
    )
  }

  // Order hygiene rows: not-collected first, then by severity/days (agg order).
  const debtRows = [...agg.timeGateDebt].sort(
    (a, b) => Number(collectedToday(a.itemId)) - Number(collectedToday(b.itemId)),
  )

  return (
    <div className="space-y-8">
      {!sync && (
        <div className="rounded-lg border border-line bg-surface/50 p-3 text-sm text-muted">
          No account synced yet — these are the plan's standing requirements. Sync on{' '}
          <Link to="/settings" className="text-accent underline">
            Settings
          </Link>{' '}
          to credit what you already own.
        </div>
      )}

      {/* --- Summary cards --- */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-2">
          <Ring
            value={avgScore}
            label={formatPercent(avgScore)}
            sublabel={`${doneCount}/${slots.length} done`}
          />
          <p className="text-sm font-medium text-ink">Loadout completion</p>
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold text-ink">Nearest finishes</h3>
          {nearest.length === 0 ? (
            <p className="text-sm text-muted">No projected finish dates yet.</p>
          ) : (
            <ul className="space-y-2">
              {nearest.map(({ slot, prog }) => {
                const piece = CATALOG_BY_ID[slot.chosenPieceId!]
                return (
                  <li key={slot.key} className="flex items-center justify-between gap-2 text-sm">
                    <OverlayLink to={`/piece/${piece.id}`} title={piece.name} className="min-w-0 truncate text-ink hover:text-accent">
                      {piece.name}
                    </OverlayLink>
                    <span className="shrink-0 text-muted">
                      {formatDate(prog!.earliestFinishDate)}
                      <span className="ml-1 text-gate">· {daysUntil(prog!.earliestFinishDate)}d</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col justify-center">
          <h3 className="mb-1 text-sm font-semibold text-ink">Total time-gate debt</h3>
          <p className="text-3xl font-semibold text-gate">{totalDebtDays}d</p>
          <p className="mt-1 text-xs text-muted">
            Soonest the whole loadout could finish if you collect every daily cap starting today
            (shared mats de-duplicated). {agg.timeGateDebt.length} gated material
            {agg.timeGateDebt.length === 1 ? '' : 's'} on the critical path.
          </p>
          <Link to="/materials" className="mt-2 text-xs text-accent underline">
            See whole-loadout materials →
          </Link>
        </Card>
      </section>

      {/* --- Time-gate hygiene list --- */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-ink">Do today</h2>
        <p className="mb-3 text-sm text-muted">
          Daily-capped materials on a critical path. Collect these every day so the finish date
          doesn't slip — they can't be rushed with gold.
        </p>
        {debtRows.length === 0 ? (
          <EmptyState title="No daily-capped materials outstanding 🎉">
            Either you've covered the gated mats or nothing tracked needs them.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {debtRows.map((d) => {
              const done = collectedToday(d.itemId)
              return (
                <Card
                  key={d.itemId}
                  className={`flex items-center justify-between gap-3 ${done ? 'opacity-50' : ''}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <SeverityDot severity={d.severity} />
                    <div className="min-w-0">
                      <p className={`truncate font-medium text-ink ${done ? 'line-through' : ''}`}>
                        {hygieneVerb(d.name)} {d.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {d.remaining} left · ~{d.dailyRate}/day · {d.days}d at this pace
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(d.itemId)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      done
                        ? 'border-good/40 bg-good/10 text-good'
                        : 'border-line text-ink hover:border-accent'
                    }`}
                  >
                    {done ? '✓ Collected today' : 'Mark collected today'}
                  </button>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* --- Finish-line pushes --- */}
      {pushes.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-ink">Push to finish</h2>
          <p className="mb-3 text-sm text-muted">
            Close to done with no long time-gate wall — a focused session (or some gold) closes
            these out.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pushes.map(({ slot, prog }) => {
              const piece = CATALOG_BY_ID[slot.chosenPieceId!]
              return (
                <OverlayLink key={slot.key} to={`/piece/${piece.id}`} className="block">
                  <Card className="transition-colors hover:border-accent/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{piece.name}</p>
                        <p className="truncate text-xs text-muted">{slot.label}</p>
                      </div>
                      <ScorePill value={prog!.completionScore} />
                    </div>
                    {prog!.finishableByGold ? (
                      <p className="mt-2 text-sm text-good">
                        Finish now for ≈{formatGold(prog!.buyOutGold)} — everything left is
                        purchasable.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">
                        Earliest finish {formatDate(prog!.earliestFinishDate)} ·{' '}
                        {daysUntil(prog!.earliestFinishDate)}d out.
                      </p>
                    )}
                  </Card>
                </OverlayLink>
              )
            })}
          </div>
        </section>
      )}

      {/* --- Priority ladder: tracked (sortable) over untracked --- */}
      <PriorityLadder tracked={slots} untracked={untrackedChosen} />
    </div>
  )
}

/** Move the item at `from` to `to` in a copy of `keys`. */
function moveKey(keys: SlotKey[], from: number, to: number): SlotKey[] {
  const next = [...keys]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * The priority ladder: a reorderable list of tracked pieces over a dimmed list of
 * chosen-but-untracked pieces. Order is driven by each slot's numeric `priority`;
 * reordering (drag, or the ↑/↓ buttons for keyboard/touch) rewrites priorities to
 * 1..n. Toggling Track/Untrack moves a row between the two zones.
 */
function PriorityLadder({
  tracked,
  untracked,
}: {
  tracked: LoadoutSlot[]
  untracked: LoadoutSlot[]
}) {
  const { setSlotPriorities, setSlotTracked } = useApp()
  const [dragKey, setDragKey] = useState<SlotKey | null>(null)
  const keys = tracked.map((s) => s.key)

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= keys.length || from === to) return
    setSlotPriorities(moveKey(keys, from, to))
  }
  const dropOn = (targetKey: SlotKey) => {
    if (dragKey == null || dragKey === targetKey) return
    reorder(keys.indexOf(dragKey), keys.indexOf(targetKey))
    setDragKey(null)
  }
  const track = (key: SlotKey) => {
    setSlotTracked(key, true)
    setSlotPriorities([...keys, key]) // append to the bottom of the order
  }
  const untrack = (key: SlotKey) => {
    setSlotTracked(key, false)
    setSlotPriorities(keys.filter((k) => k !== key)) // keep 1..n contiguous
  }

  if (tracked.length === 0 && untracked.length === 0) return null

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-ink">Priority order</h2>
      <p className="mb-3 text-sm text-muted">
        Drag, or use the ↑/↓ buttons, to set which tracked pieces you want to finish first.
      </p>

      <div className="space-y-2">
        {tracked.map((slot, i) => (
          <LadderRow
            key={slot.key}
            slot={slot}
            rank={i + 1}
            tracked
            isFirst={i === 0}
            isLast={i === tracked.length - 1}
            dragging={dragKey === slot.key}
            onDragStart={() => setDragKey(slot.key)}
            onDragEnd={() => setDragKey(null)}
            onDropRow={() => dropOn(slot.key)}
            onMoveUp={() => reorder(i, i - 1)}
            onMoveDown={() => reorder(i, i + 1)}
            onToggleTracked={() => untrack(slot.key)}
          />
        ))}
      </div>

      {untracked.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">
            Untracked
          </h3>
          <div className="space-y-2">
            {untracked.map((slot) => (
              <LadderRow
                key={slot.key}
                slot={slot}
                tracked={false}
                onToggleTracked={() => track(slot.key)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function LadderRow({
  slot,
  rank,
  tracked,
  isFirst,
  isLast,
  dragging,
  onDragStart,
  onDragEnd,
  onDropRow,
  onMoveUp,
  onMoveDown,
  onToggleTracked,
}: {
  slot: LoadoutSlot
  rank?: number
  tracked: boolean
  isFirst?: boolean
  isLast?: boolean
  dragging?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  onDropRow?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onToggleTracked: () => void
}) {
  const { progressByPiece } = useApp()
  const piece = CATALOG_BY_ID[slot.chosenPieceId!]
  const prog = progressForSlot(slot, progressByPiece)
  if (!piece) return null

  const btn =
    'shrink-0 rounded border border-line px-1.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <Card
      draggable={tracked}
      onDragStart={tracked ? onDragStart : undefined}
      onDragEnd={tracked ? onDragEnd : undefined}
      onDragOver={tracked ? (e) => e.preventDefault() : undefined}
      onDrop={tracked ? onDropRow : undefined}
      className={`flex items-center justify-between gap-3 ${tracked ? 'cursor-grab' : 'opacity-60'} ${
        dragging ? 'opacity-50 ring-1 ring-accent' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {tracked ? (
          <span aria-hidden className="shrink-0 select-none text-muted">
            ⠿
          </span>
        ) : (
          <span aria-hidden className="w-3 shrink-0" />
        )}
        <span className="w-6 shrink-0 text-center text-sm font-mono text-muted">
          {tracked ? rank : '—'}
        </span>
        <div className="min-w-0">
          <OverlayLink
            to={`/piece/${piece.id}`}
            draggable={false}
            className="block truncate font-medium text-ink hover:text-accent"
          >
            {piece.name}
          </OverlayLink>
          <p className="truncate text-xs text-muted">{slot.label}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {tracked && (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              aria-label={`Move ${piece.name} up`}
              className={btn}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              aria-label={`Move ${piece.name} down`}
              className={btn}
            >
              ↓
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleTracked}
          aria-label={tracked ? `Stop tracking ${piece.name}` : `Track ${piece.name}`}
          title={tracked ? 'Counts in totals — click to untrack' : 'Not counted — click to track'}
          className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-accent"
        >
          {tracked ? 'Untrack' : 'Track'}
        </button>
        <ScorePill value={prog?.completionScore ?? 0} done={prog?.owned} />
      </div>
    </Card>
  )
}

/** A friendly imperative for the hygiene list. */
function hygieneVerb(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('clover')) return 'Forge your daily'
  if (n.includes('quartz')) return 'Charge your daily'
  if (n.includes('mithrillium') || n.includes('cord') || n.includes('residue') || n.includes('silk'))
    return 'Craft your daily'
  return 'Collect your daily'
}
