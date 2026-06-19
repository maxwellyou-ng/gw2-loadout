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
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { aggregateRequirements, trackedSlots } from '../engine'
import { Card, Badge, SeverityDot, EmptyState, WikiName, ItemIcon, PageHeader } from '../components/ui'
import { formatDate } from '../lib/format'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../state/storage'

function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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
  const rows = agg.timeGateDebt.map((d) => {
    const rate = overrides[d.itemId] ?? d.dailyRate
    const days = Math.ceil(d.remaining / Math.max(1, rate))
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
        help="The loadout finishes no sooner than its slowest daily-capped material. Raising a material's assumed pace may change which one is binding."
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

      <div className="space-y-2">
        {rows.map((r) => {
          const isBinding = r.itemId === bindingId
          const max = Math.max(Math.ceil(r.dailyRate * 4), 12)
          return (
            <Card
              key={r.itemId}
              className={isBinding ? 'border-gate/50 bg-gate/5' : undefined}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ItemIcon itemId={r.itemId} name={r.name} size={24} />
                  <SeverityDot severity={r.severity} />
                  <WikiName name={r.name} itemId={r.itemId} className="truncate text-sm font-medium text-ink" />
                  {isBinding && <Badge tone="gate">binding</Badge>}
                </div>
                <div className="text-right text-sm">
                  <span className="text-muted">{r.remaining} left · </span>
                  <span className="font-semibold text-gate">{r.days}d</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={max}
                  step={1}
                  value={r.rate}
                  onChange={(e) => setPace(r.itemId, Number(e.target.value))}
                  className="w-full accent-accent"
                  aria-label={`Daily pace for ${r.name}`}
                />
                <span className="w-20 shrink-0 text-right font-mono text-xs text-muted">
                  {r.rate}/day
                </span>
              </div>
              {r.rate !== r.dailyRate && (
                <p className="mt-1 text-xs text-muted">Default pace {r.dailyRate}/day.</p>
              )}
            </Card>
          )
        })}
      </div>

      {hasOverrides && (
        <button onClick={reset} className="text-sm text-accent underline">
          Reset paces to defaults
        </button>
      )}
    </div>
  )
}
