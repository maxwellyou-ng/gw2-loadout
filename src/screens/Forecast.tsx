// ---------------------------------------------------------------------------
// Time-gate forecaster (brief 6.7): project the whole tracked loadout's finish
// date from adjustable daily-pace assumptions, and watch the date move.
//
// The loadout's earliest finish is bound by its slowest daily-capped material
// (clovers, etc.). We start from the de-duplicated whole-loadout time-gate debt
// (engine/aggregateRequirements) and let the user override the assumed daily
// pace per material — e.g. "I'll also buy clovers" bumps the clover rate, the
// binding material may change, and the projected date updates live. Overrides
// persist in localStorage; they never alter the real computed counts.
//
// Rows group by severity (hard caps → soft effort gates) so the registry can
// hold dozens of materials without burying the ones that bind the date. Rates
// span 0.5/day (Gift of Battle) to 30k/day (Karma), so slider step/max and the
// pace label scale per row.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { aggregateRequirements, trackedSlots } from '../engine'
import { Card, Badge, SeverityDot, EmptyState, WikiName, ItemIcon, PageHeader } from '../components/ui'
import { formatDate } from '../lib/format'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../state/storage'
import type { TimeGateSeverity } from '../types'

function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Slider granularity scaled to the default rate, so a 1/day refinement gets
 *  unit steps while Karma's 30k/day doesn't produce a 120k-notch slider. */
function sliderStep(dailyRate: number): number {
  if (dailyRate < 1) return 0.05
  if (dailyRate <= 12) return 1
  if (dailyRate <= 100) return 5
  if (dailyRate <= 1000) return 50
  return 500
}

/** Sub-1/day paces read better per week ("3.5/week", the Gift of Battle case). */
function paceLabel(rate: number): string {
  if (rate < 1) return `${+(rate * 7).toFixed(1)}/week`
  return `${rate.toLocaleString()}/day`
}

const SEVERITY_SECTIONS: { severity: TimeGateSeverity; title: string; hint: string }[] = [
  { severity: 'high', title: 'Hard gates', hint: 'strict caps or heavy grinds — these bind the date' },
  { severity: 'medium', title: 'Daily & weekly tasks', hint: 'capped tasks worth running on repeat' },
  { severity: 'low', title: 'Slow accumulation', hint: 'farmable, just not overnight' },
]

interface Row {
  itemId: number
  name: string
  remaining: number
  dailyRate: number
  severity: TimeGateSeverity
  rate: number
  days: number
}

export default function Forecast() {
  const { loadout, sync } = useApp()
  const [overrides, setOverrides] = useState<Record<number, number>>(() =>
    loadJSON<Record<number, number>>(STORAGE_KEYS.paceOverrides, {}),
  )

  const slots = useMemo(() => trackedSlots(loadout), [loadout])
  const agg = useMemo(
    () => aggregateRequirements(slots, sync?.snapshot ?? {}, sync?.prices ?? {}, sync?.meta),
    [slots, sync],
  )

  const setPace = (itemId: number, rate: number) => {
    setOverrides((prev) => {
      const next = { ...prev, [itemId]: rate }
      saveJSON(STORAGE_KEYS.paceOverrides, next)
      return next
    })
  }
  const reset = () => {
    setOverrides({})
    saveJSON(STORAGE_KEYS.paceOverrides, {})
  }

  // Per-material projection at the assumed pace.
  const rows: Row[] = agg.timeGateDebt.map((d) => {
    const rate = overrides[d.itemId] ?? d.dailyRate
    const days = Math.ceil(d.remaining / rate)
    return { ...d, rate, days }
  })
  const maxDays = rows.reduce((mx, r) => Math.max(mx, r.days), 0)
  const bindingId = rows.find((r) => r.days === maxDays)?.itemId
  const hasOverrides = Object.keys(overrides).length > 0

  if (rows.length === 0) {
    return (
      <EmptyState title="No time-gated materials outstanding">
        Your tracked loadout isn't bound by any daily-capped materials right now — nothing to
        forecast. Pick more pieces on the{' '}
        <Link to="/loadout" className="text-accent underline">
          Loadout
        </Link>{' '}
        tab, or sync to credit what you own.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time-gate forecaster"
        subtitle={`Tweak the assumed daily pace below and the projected finish date moves.${!sync ? ' Sync to factor in what you already own.' : ''}`}
        help="The loadout finishes no sooner than its slowest rate-limited material. Raising a material's assumed pace may change which one is binding."
      />

      <Card className="flex flex-wrap items-end justify-between gap-3 border-good/40 bg-good/5">
        <div>
          <p className="text-xs text-muted">Projected whole-loadout finish</p>
          <p className="text-2xl font-semibold text-ink">{formatDate(addDaysISO(maxDays))}</p>
        </div>
        <p className="text-sm text-muted">
          {maxDays} day{maxDays === 1 ? '' : 's'} out at these paces · bound by{' '}
          <span className="text-ink">{rows.find((r) => r.itemId === bindingId)?.name}</span>
        </p>
      </Card>

      {SEVERITY_SECTIONS.map(({ severity, title, hint }) => {
        // Static severity grouping: rows must not jump sections mid-drag. The
        // engine already orders debt severity-then-days, so order is preserved.
        const section = rows.filter((r) => r.severity === severity)
        if (section.length === 0) return null
        const sectionMax = section.reduce((mx, r) => Math.max(mx, r.days), 0)
        return (
          <Card key={severity}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-ink">{title}</h3>
                <Badge tone={severity === 'low' ? 'neutral' : 'gate'}>{section.length}</Badge>
                <span className="hidden text-xs text-muted sm:inline">{hint}</span>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted">≤{sectionMax}d</span>
            </div>
            <div className="mt-2 divide-y divide-line">
              {section.map((r) => {
                const isBinding = r.itemId === bindingId
                const step = sliderStep(r.dailyRate)
                const max = Math.max(Math.ceil((r.dailyRate * 4) / step) * step, 12 * step)
                return (
                  <div
                    key={r.itemId}
                    className={`py-3 first:pt-2 last:pb-1 ${isBinding ? '-mx-2 rounded-md border border-gate/50 bg-gate/5 px-2' : ''}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <ItemIcon itemId={r.itemId} name={r.name} size={24} />
                        <SeverityDot severity={r.severity} />
                        <WikiName name={r.name} itemId={r.itemId} className="truncate text-sm font-medium text-ink" />
                        {isBinding && <Badge tone="gate">binding</Badge>}
                      </div>
                      <div className="text-right text-sm">
                        <span className="text-muted">{r.remaining.toLocaleString()} left · </span>
                        <span className="font-semibold text-gate">{r.days.toLocaleString()}d</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="range"
                        min={step}
                        max={max}
                        step={step}
                        value={r.rate}
                        onChange={(e) => setPace(r.itemId, Number(e.target.value))}
                        className="w-full accent-accent"
                        aria-label={`Daily pace for ${r.name}`}
                      />
                      <span className="w-24 shrink-0 text-right font-mono text-xs text-muted">
                        {paceLabel(r.rate)}
                      </span>
                    </div>
                    {r.rate !== r.dailyRate && (
                      <p className="mt-1 text-xs text-muted">Default pace {paceLabel(r.dailyRate)}.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}

      {hasOverrides && (
        <button onClick={reset} className="text-sm text-accent underline">
          Reset paces to defaults
        </button>
      )}
    </div>
  )
}
