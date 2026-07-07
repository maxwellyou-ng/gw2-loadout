// ---------------------------------------------------------------------------
// Today — the front door (docs/REDESIGN.md §3). One question: "what do I do
// right now?" One loud answer: the Focus card. Everything else on the page is
// quieter by design (docs/UX-BEST-PRACTICES.md §5.4).
//
// Region order: welcome-back diff (≥3 days away) → Focus → Do today +
// Bottlenecks → remaining finish-line pushes → compact read-only ladder.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { goalEntries, type Goal } from '../state/plan'
import { aggregateRequirements, isFinishLinePush } from '../engine'
import type { DerivedProgress } from '../types'
import { Card, ItemIcon, OverlayLink, ProgressBar, ScorePill } from '../components/ui'
import Onboarding from '../components/Onboarding'
import FocusCard, { type Focus } from '../components/today/FocusCard'
import DailyChecklist from '../components/today/DailyChecklist'
import Bottlenecks from '../components/today/Bottlenecks'
import WelcomeBack from '../components/today/WelcomeBack'
import { formatDate, formatGold, daysUntil } from '../lib/format'

export default function Today() {
  const {
    plan,
    sync,
    syncing,
    runSync,
    settings,
    previousVisit,
    progressByPiece,
    allocatedByGoal,
    pricesLoaded,
    markCelebrated,
  } = useApp()

  const entries = useMemo(() => goalEntries(plan), [plan])
  const agg = useMemo(
    () => aggregateRequirements(entries, sync?.snapshot ?? {}, sync?.prices ?? {}, sync?.meta),
    [entries, sync],
  )

  const progFor = (g: Goal): DerivedProgress | undefined =>
    allocatedByGoal[g.id] ?? (g.pieceId != null ? progressByPiece[g.pieceId] : undefined)

  const active = plan.goals.filter(
    (g) => g.state === 'active' && g.pieceId != null && CATALOG_BY_ID[g.pieceId],
  )

  // --- Focus selection (strict order; docs/REDESIGN.md §3) -----------------
  const uncelebrated = plan.goals.find(
    (g) => g.state === 'done' && !g.celebrated && g.pieceId != null && CATALOG_BY_ID[g.pieceId],
  )
  const pushes = active
    .map((g) => ({ goal: g, prog: progFor(g) }))
    .filter((x): x is { goal: Goal; prog: DerivedProgress } => isFinishLinePush(x.prog))
    .sort(
      (a, b) =>
        Number(b.prog.finishableByGold) - Number(a.prog.finishableByGold) ||
        b.prog.completionScore - a.prog.completionScore,
    )

  let focus: Focus | null = null
  if (uncelebrated) {
    focus = { kind: 'celebrate', goal: uncelebrated, piece: CATALOG_BY_ID[uncelebrated.pieceId!] }
  } else if (pushes.length > 0) {
    focus = {
      kind: 'push',
      goal: pushes[0].goal,
      piece: CATALOG_BY_ID[pushes[0].goal.pieceId!],
      prog: pushes[0].prog,
    }
  } else if (active.length > 0) {
    const top = active[0]
    const prog = progFor(top)
    if (prog) focus = { kind: 'grind', goal: top, piece: CATALOG_BY_ID[top.pieceId!], prog }
  }

  if (plan.goals.length === 0) {
    return <Onboarding title="Welcome — plan your legendaries" />
  }

  const laterPushes = pushes.filter((p) => p.goal.id !== (focus?.kind === 'push' ? focus.goal.id : ''))

  return (
    <div className="space-y-6">
      <WelcomeBack
        previousVisit={previousVisit}
        plan={plan}
        bottleneck={agg.timeGateDebt[0]}
        hasApiKey={!!settings.apiKey}
        syncing={syncing}
        onSync={runSync}
      />

      {!sync && (
        <div className="rounded-lg border border-line bg-surface/50 p-3 text-sm text-muted">
          No account synced yet — these are the plan's standing requirements. Sync on{' '}
          <Link to="/settings" className="text-accent underline">
            Settings
          </Link>{' '}
          to credit what you already own.
        </div>
      )}

      {focus && (
        <FocusCard focus={focus} pricesLoaded={pricesLoaded} onCelebrated={markCelebrated} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailyChecklist debt={agg.timeGateDebt} />
        <Bottlenecks debt={agg.timeGateDebt} activeGoals={active} progFor={progFor} />
      </div>

      {laterPushes.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Also close to done
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {laterPushes.map(({ goal, prog }) => {
              const piece = CATALOG_BY_ID[goal.pieceId!]
              return (
                <OverlayLink key={goal.id} to={`/piece/${piece.id}`} className="block">
                  <Card className="transition-colors hover:border-accent/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ItemIcon itemId={piece.id} name={piece.name} size={32} />
                        <p className="truncate font-semibold text-ink">{piece.name}</p>
                      </div>
                      <ScorePill value={prog.completionScore} />
                    </div>
                    {prog.finishableByGold ? (
                      <p className="mt-2 text-sm text-good">
                        {pricesLoaded
                          ? `≈${formatGold(prog.buyOutGold)} closes it.`
                          : 'All remaining materials are purchasable.'}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">
                        Earliest finish {formatDate(prog.earliestFinishDate)} ·{' '}
                        {daysUntil(prog.earliestFinishDate)}d out.
                      </p>
                    )}
                  </Card>
                </OverlayLink>
              )
            })}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Your ladder
            </h3>
            <Link to="/goals" className="text-xs font-medium text-accent hover:underline">
              Manage goals →
            </Link>
          </div>
          <Card className="divide-y divide-line/60 p-0">
            {active.slice(0, 5).map((g, i) => {
              const piece = CATALOG_BY_ID[g.pieceId!]
              const prog = progFor(g)
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="w-4 shrink-0 text-center font-mono text-sm text-muted">
                      {i + 1}
                    </span>
                    <ItemIcon itemId={piece.id} name={piece.name} size={26} />
                    <OverlayLink
                      to={`/piece/${piece.id}`}
                      className="truncate text-sm font-medium text-ink hover:text-accent"
                    >
                      {piece.name}
                    </OverlayLink>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <ProgressBar
                      value={prog?.owned ? 1 : prog?.completionScore ?? 0}
                      className="hidden h-1.5 w-28 sm:block"
                    />
                    <span className="w-20 text-right text-xs tabular-nums text-muted">
                      {prog?.earliestFinishDate ? formatDate(prog.earliestFinishDate) : '—'}
                    </span>
                    <ScorePill value={prog?.completionScore ?? 0} done={prog?.owned} />
                  </div>
                </div>
              )
            })}
            {active.length > 5 && (
              <Link
                to="/goals"
                className="block px-3 py-2 text-center text-xs font-medium text-accent hover:underline"
              >
                +{active.length - 5} more goals →
              </Link>
            )}
          </Card>
        </section>
      )}
    </div>
  )
}
