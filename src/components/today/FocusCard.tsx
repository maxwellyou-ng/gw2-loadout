// The one loud element on Today (docs/REDESIGN.md §3): a single accent-bordered
// card answering "what do I do right now?". Selection order is strict —
// celebration → best finish-line push → top goal framed by its binding gate →
// onboarding — and is computed in Today.tsx; this renders the chosen focus.

import type { DerivedProgress, LegendaryPiece } from '../../types'
import type { Goal } from '../../state/plan'
import { Card, ItemIcon, OverlayLink, ProgressBar, ScorePill } from '../ui'
import { formatGold, formatDate, daysUntil } from '../../lib/format'

export type Focus =
  | { kind: 'celebrate'; goal: Goal; piece: LegendaryPiece }
  | { kind: 'push'; goal: Goal; piece: LegendaryPiece; prog: DerivedProgress }
  | { kind: 'grind'; goal: Goal; piece: LegendaryPiece; prog: DerivedProgress }

/** Days between two ISO dates, floored at 1. */
function daysBetween(fromISO: string, toISO: string): number {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime()
  return Math.max(1, Math.round(ms / 86_400_000))
}

export default function FocusCard({
  focus,
  pricesLoaded,
  onCelebrated,
}: {
  focus: Focus
  pricesLoaded: boolean
  onCelebrated: (goalId: string) => void
}) {
  if (focus.kind === 'celebrate') {
    const { goal, piece } = focus
    const took = goal.completedAt ? daysBetween(goal.addedAt, goal.completedAt) : null
    return (
      <Card className="border-accent bg-accent-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <ItemIcon itemId={piece.id} name={piece.name} size={56} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Legendary complete 🎉
              </p>
              <OverlayLink
                to={`/piece/${piece.id}`}
                className="block truncate text-2xl font-semibold text-ink hover:text-accent"
              >
                {piece.name}
              </OverlayLink>
              <p className="text-sm text-muted">
                {goal.completedAt && `Unlocked ${formatDate(goal.completedAt)}`}
                {took != null && ` · ${took} day${took === 1 ? '' : 's'} in the making`}
                {' · its claimed materials are now free for your next goal'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCelebrated(goal.id)}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas"
          >
            To the trophy shelf →
          </button>
        </div>
      </Card>
    )
  }

  const { goal, piece, prog } = focus
  const binding = prog.timeGateDebt[0]

  return (
    <Card className="border-accent p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <ItemIcon itemId={piece.id} name={piece.name} size={56} className="mt-1" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {focus.kind === 'push' ? 'Push to finish' : 'Focus'}
            </p>
            <OverlayLink
              to={`/piece/${piece.id}`}
              className="block truncate text-2xl font-semibold text-ink hover:text-accent"
            >
              {focus.kind === 'push' ? `Finish ${piece.name}` : piece.name}
            </OverlayLink>
            {focus.kind === 'push' ? (
              <p className="mt-1 max-w-prose text-sm text-good">
                {prog.finishableByGold
                  ? pricesLoaded
                    ? `Everything left is purchasable — ≈${formatGold(prog.buyOutGold)} closes it today.`
                    : 'Everything left is purchasable on the Trading Post — sync to cost it.'
                  : `${formatDate(prog.earliestFinishDate)} is in reach — ${daysUntil(prog.earliestFinishDate)} days of gates left, the rest is a focused session.`}
              </p>
            ) : binding ? (
              <p className="mt-1 max-w-prose text-sm text-muted">
                Bound by <span className="font-medium text-gate">{binding.name}</span> —{' '}
                {binding.days} days at ~{binding.dailyRate}/day. Today's{' '}
                {binding.name.toLowerCase()} run is the highest-leverage few minutes you can
                spend.
              </p>
            ) : prog.remainingMaterials.length === 0 ? (
              <p className="mt-1 max-w-prose text-sm text-good">
                Every material is on hand — all that's left is refining and forging. Open the
                finishing steps and claim it.
              </p>
            ) : (
              <p className="mt-1 max-w-prose text-sm text-muted">
                No time gates left — it's all farming and forging from here.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ScorePill value={prog.completionScore} done={prog.owned} />
          {goal.state === 'active' && prog.earliestFinishDate && (
            <span className="text-xs tabular-nums text-muted">
              earliest {formatDate(prog.earliestFinishDate)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={prog.completionScore} className="h-2.5" />
        <OverlayLink
          to={`/piece/${piece.id}`}
          className="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-canvas"
        >
          {focus.kind === 'push' && prog.finishableByGold ? 'View buy list →' : 'What’s left →'}
        </OverlayLink>
      </div>
    </Card>
  )
}
