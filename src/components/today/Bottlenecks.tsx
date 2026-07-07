// Bottleneck surfacing (docs/UX-BEST-PRACTICES.md §1.2): which gated material
// binds how many goals. Inverts the per-piece debt — one row per material,
// worst first, with the goals it holds hostage.

import type { DerivedProgress, TimeGateDebt } from '../../types'
import type { Goal } from '../../state/plan'
import { CATALOG_BY_ID } from '../../state/store'
import { Card, ItemIcon, SeverityDot } from '../ui'
import { Link } from 'react-router-dom'

export default function Bottlenecks({
  debt,
  activeGoals,
  progFor,
}: {
  /** De-duplicated whole-plan time-gate debt (aggregateRequirements). */
  debt: TimeGateDebt[]
  activeGoals: Goal[]
  progFor: (goal: Goal) => DerivedProgress | undefined
}) {
  if (debt.length === 0) return null

  // For each gated material: which active goals still need it (allocated view).
  const rows = debt.slice(0, 4).map((d) => {
    const bound = activeGoals.filter((g) =>
      progFor(g)?.remainingMaterials.some((m) => m.itemId === d.itemId && m.remaining > 0),
    )
    return { debt: d, bound }
  })

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Bottlenecks</h3>
      <Card className="divide-y divide-line/60 p-0">
        {rows.map(({ debt: d, bound }) => (
          <div key={d.itemId} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <SeverityDot severity={d.severity} />
              <ItemIcon itemId={d.itemId} name={d.name} size={28} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                <p className="truncate text-xs text-muted">
                  {bound.length > 0
                    ? `binds ${bound.length} goal${bound.length === 1 ? '' : 's'} — ${bound
                        .map((g) => (g.pieceId != null ? CATALOG_BY_ID[g.pieceId]?.name : ''))
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(', ')}`
                    : 'on the critical path'}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-gate">{d.days}d</span>
          </div>
        ))}
      </Card>
      <p className="text-xs text-muted">
        Days assume the default pace — tune it per material on{' '}
        <Link to="/materials" className="text-accent hover:underline">
          Materials
        </Link>
        .
      </p>
    </section>
  )
}
