// ---------------------------------------------------------------------------
// Pace panel — the old Forecast screen as a Materials module (docs/REDESIGN.md
// §2: "Forecast is a parameter panel on the question Materials answers").
//
// Projected finish card + per-material pace sliders over the de-duplicated
// whole-plan time-gate debt. Overrides persist in localStorage and never alter
// real computed counts. The sliders live behind a <details> disclosure: the
// projected date is always visible, the tuning only when wanted.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { Card, Badge, SeverityDot, WikiName, ItemIcon } from './ui'
import { formatDate } from '../lib/format'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../state/storage'
import type { TimeGateDebt, TimeGateSeverity } from '../types'

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

export default function PacePanel({ debt }: { debt: TimeGateDebt[] }) {
  const [overrides, setOverrides] = useState<Record<number, number>>(() =>
    loadJSON<Record<number, number>>(STORAGE_KEYS.paceOverrides, {}),
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

  const rows = debt.map((d) => {
    const rate = overrides[d.itemId] ?? d.dailyRate
    return { ...d, rate, days: Math.ceil(d.remaining / rate) }
  })
  const maxDays = rows.reduce((mx, r) => Math.max(mx, r.days), 0)
  const bindingId = rows.find((r) => r.days === maxDays)?.itemId
  const hasOverrides = Object.keys(overrides).length > 0

  if (rows.length === 0) return null

  return (
    <Card className="border-gate/40 bg-gate/5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Projected finish (time gates)</p>
          <p className="text-2xl font-semibold text-ink">{formatDate(addDaysISO(maxDays))}</p>
        </div>
        <p className="text-sm text-muted">
          {maxDays} day{maxDays === 1 ? '' : 's'} out at these paces · bound by{' '}
          <span className="text-ink">{rows.find((r) => r.itemId === bindingId)?.name}</span>
        </p>
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-ink marker:content-none">
          <span className="text-xs text-muted transition-transform group-open:rotate-90">▶</span>
          Tune assumed paces
          <span className="text-xs font-normal text-muted">
            — "what if I also buy clovers?" moves the date live
          </span>
        </summary>

        <div className="mt-3 space-y-4">
          {SEVERITY_SECTIONS.map(({ severity, title, hint }) => {
            const section = rows.filter((r) => r.severity === severity)
            if (section.length === 0) return null
            const sectionMax = section.reduce((mx, r) => Math.max(mx, r.days), 0)
            return (
              <div key={severity}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-sm font-semibold text-ink">{title}</h4>
                    <Badge tone={severity === 'low' ? 'neutral' : 'gate'}>{section.length}</Badge>
                    <span className="hidden text-xs text-muted sm:inline">{hint}</span>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted">≤{sectionMax}d</span>
                </div>
                <div className="mt-1 divide-y divide-line">
                  {section.map((r) => {
                    const isBinding = r.itemId === bindingId
                    const step = sliderStep(r.dailyRate)
                    const max = Math.max(Math.ceil((r.dailyRate * 4) / step) * step, 12 * step)
                    return (
                      <div
                        key={r.itemId}
                        className={`py-3 first:pt-2 last:pb-1 ${
                          isBinding ? '-mx-2 rounded-md border border-gate/50 bg-gate/5 px-2' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <ItemIcon itemId={r.itemId} name={r.name} size={24} />
                            <SeverityDot severity={r.severity} />
                            <WikiName
                              name={r.name}
                              itemId={r.itemId}
                              className="truncate text-sm font-medium text-ink"
                            />
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
                          <p className="mt-1 text-xs text-muted">
                            Default pace {paceLabel(r.dailyRate)}.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {hasOverrides && (
            <button onClick={reset} className="text-sm text-accent underline">
              Reset paces to defaults
            </button>
          )}
        </div>
      </details>
    </Card>
  )
}
