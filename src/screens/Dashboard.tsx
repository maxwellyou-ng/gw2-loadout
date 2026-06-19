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
  plannedSlots,
  priorityRank,
  progressForSlot,
} from '../engine'
import { Card, Ring, Badge, SeverityDot, EmptyState, ScorePill } from '../components/ui'
import { formatGold, formatDate, formatPercent, daysUntil } from '../lib/format'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../state/storage'
import type { LoadoutSlot } from '../data/loadout'

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
                    <Link to={`/piece/${piece.id}`} title={piece.name} className="min-w-0 truncate text-ink hover:text-accent">
                      {piece.name}
                    </Link>
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
                <Link key={slot.key} to={`/piece/${piece.id}`} className="block">
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
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* --- Priority ladder (defer sinks) --- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Priority order</h2>
        <div className="space-y-2">
          {slots.map((slot) => (
            <PriorityRow key={slot.key} slot={slot} />
          ))}
        </div>
      </section>
    </div>
  )
}

function PriorityRow({ slot }: { slot: LoadoutSlot }) {
  const { progressByPiece } = useApp()
  const piece = CATALOG_BY_ID[slot.chosenPieceId!]
  const prog = progressForSlot(slot, progressByPiece)
  if (!piece) return null
  const deferred = priorityRank(slot) === Number.POSITIVE_INFINITY
  return (
    <Link to={`/piece/${piece.id}`} className="block">
      <Card className={`flex items-center justify-between gap-3 ${deferred ? 'opacity-60' : ''}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-8 shrink-0 text-center text-sm font-mono text-muted">
            {deferred ? '—' : slot.priority}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{piece.name}</p>
            <p className="truncate text-xs text-muted">{slot.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {deferred && <Badge tone="warn">defer</Badge>}
          <ScorePill value={prog?.completionScore ?? 0} done={prog?.owned} />
        </div>
      </Card>
    </Link>
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
