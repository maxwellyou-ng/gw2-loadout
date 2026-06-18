// ---------------------------------------------------------------------------
// Whole-loadout material aggregation (brief Phase 4.2).
//
// Rolls every *tracked* piece into one master requirement list keyed by itemId
// via engine/aggregateRequirements: required summed across pieces, owned
// subtracted **once** (a shared mat like clovers is never double-counted),
// split into gated / buyable, with a total buy-out cost.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import {
  aggregateRequirements,
  aggregateIntermediates,
  trackedSlots,
  type AggregatedMaterial,
} from '../engine'
import { Card, Badge, SeverityDot, EmptyState, WikiName } from '../components/ui'
import { formatGold } from '../lib/format'

type View = 'base' | 'gifts'

function MaterialRow({ m }: { m: AggregatedMaterial }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <div className="flex min-w-0 items-center gap-2">
        {m.timeGate.isGated && m.timeGate.severity && <SeverityDot severity={m.timeGate.severity} />}
        <WikiName name={m.name} itemId={m.itemId} className="truncate text-sm text-ink" />
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">
        {m.timeGate.isGated && m.timeGate.dailyRate ? (
          <span className="text-gate">
            {m.remaining} left · {Math.ceil(m.remaining / m.timeGate.dailyRate)}d
          </span>
        ) : (
          <span className="text-muted">
            {m.owned}/{m.required}
          </span>
        )}
        {m.buyable && m.unitPrice != null && m.unitPrice > 0 && (
          <span className="w-28 text-right font-mono text-xs text-muted">
            {formatGold(m.remaining * m.unitPrice)}
          </span>
        )}
      </div>
    </div>
  )
}

function Group({
  title,
  tone,
  hint,
  materials,
}: {
  title: string
  tone: 'gate' | 'good' | 'warn'
  hint?: string
  materials: AggregatedMaterial[]
}) {
  if (materials.length === 0) return null
  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <Badge tone={tone}>{materials.length}</Badge>
      </div>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div>
        {materials.map((m) => (
          <MaterialRow key={m.itemId} m={m} />
        ))}
      </div>
    </Card>
  )
}

export default function Materials() {
  const { loadout, sync } = useApp()
  const [view, setView] = useState<View>('base')

  const slots = useMemo(() => trackedSlots(loadout), [loadout])
  const agg = useMemo(() => {
    const snapshot = sync?.snapshot ?? {}
    const prices = sync?.prices ?? {}
    return view === 'gifts'
      ? aggregateIntermediates(slots, snapshot, prices)
      : aggregateRequirements(slots, snapshot, prices, sync?.meta)
  }, [slots, sync, view])

  const outstanding = agg.materials.filter((m) => m.remaining > 0)
  const gated = outstanding.filter((m) => m.timeGate.isGated)
  const buyable = outstanding.filter((m) => m.buyable && !m.timeGate.isGated)
  const grind = outstanding.filter((m) => !m.buyable && !m.timeGate.isGated)

  const trackedWithPiece = slots.filter((s) => s.chosenPieceId != null).length

  if (trackedWithPiece === 0) {
    return (
      <EmptyState title="Nothing tracked yet">
        Choose pieces for your tracked slots on the{' '}
        <Link to="/loadout" className="text-accent underline">
          Loadout
        </Link>{' '}
        tab to see a combined shopping list.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Whole-loadout materials</h2>
          <p className="text-sm text-muted">
            {trackedWithPiece} tracked pieces · shared materials de-duplicated, owned counted once
            {!sync && ' · sync to credit your inventory'}
          </p>
        </div>
        <Card className="px-4 py-3 text-right">
          <p className="text-xs text-muted">Total buy-out (buyables left)</p>
          <p className="text-xl font-semibold text-ink">≈{formatGold(agg.buyOutGold)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(['base', 'gifts'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === v ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
              }`}
            >
              {v === 'base' ? 'Base materials' : 'Gifts & intermediates'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {view === 'base'
            ? 'Fully flattened to base materials.'
            : 'Stops at gift level — once a gift is crafted (and synced), its base mats drop out here.'}
        </p>
      </div>

      {outstanding.length === 0 ? (
        <EmptyState title="No remaining materials — every tracked piece is covered 🎉" />
      ) : (
        <>
          <Group
            title="Time-gated"
            tone="gate"
            hint="Daily-capped — these set the loadout's earliest finish date."
            materials={gated}
          />
          <Group
            title="Grind-only (account-bound)"
            tone="warn"
            hint="Can't be bought on the Trading Post."
            materials={grind}
          />
          <Group
            title="Buyable"
            tone="good"
            hint="Available on the Trading Post if you'd rather spend gold than farm."
            materials={buyable}
          />
        </>
      )}
    </div>
  )
}
