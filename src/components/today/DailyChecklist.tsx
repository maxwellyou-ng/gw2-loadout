// The daily ritual as a checklist (docs/UX-BEST-PRACTICES.md §1.4): de-duplicated
// daily-capped materials with an advisory "collected today" toggle. The toggle
// is deliberately cosmetic — real counts only ever come from sync.

import type { TimeGateDebt } from '../../types'
import { Card, EmptyState, ItemIcon, SeverityDot } from '../ui'
import { useDailyLog } from './useDailyLog'

/** A friendly imperative for the checklist row. */
function hygieneVerb(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('clover')) return 'Forge your daily'
  if (n.includes('quartz')) return 'Charge your daily'
  if (n.includes('mithrillium') || n.includes('cord') || n.includes('residue') || n.includes('silk'))
    return 'Craft your daily'
  return 'Collect your daily'
}

export default function DailyChecklist({ debt }: { debt: TimeGateDebt[] }) {
  const { collectedToday, toggle } = useDailyLog()

  // Actual daily tasks only: ≥1/day cadence, not slow background accumulation.
  const daily = debt.filter((d) => d.dailyRate >= 1 && d.severity !== 'low')
  const rows = [...daily].sort(
    (a, b) => Number(collectedToday(a.itemId)) - Number(collectedToday(b.itemId)),
  )
  const doneCount = daily.filter((d) => collectedToday(d.itemId)).length

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Do today</h3>
        {daily.length > 0 && (
          <span className="text-xs tabular-nums text-muted">
            {doneCount} of {daily.length} collected
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No daily-capped materials outstanding 🎉">
          Either you've covered the gated mats or nothing tracked needs them.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line/60 p-0">
          {rows.map((d) => {
            const done = collectedToday(d.itemId)
            return (
              <div
                key={d.itemId}
                className={`flex items-center justify-between gap-3 px-3 py-2 ${done ? 'opacity-50' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <SeverityDot severity={d.severity} />
                  <ItemIcon itemId={d.itemId} name={d.name} size={28} />
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium text-ink ${done ? 'line-through' : ''}`}>
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
                  {done ? '✓ Collected' : 'Mark collected'}
                </button>
              </div>
            )
          })}
        </Card>
      )}
    </section>
  )
}
