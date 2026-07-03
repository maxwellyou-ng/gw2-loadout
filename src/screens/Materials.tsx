// ---------------------------------------------------------------------------
// Whole-loadout material aggregation (brief Phase 4.2).
//
// Rolls every *tracked* piece into one master requirement list keyed by itemId
// via engine/aggregateRequirements: required summed across pieces, owned
// subtracted **once** (a shared mat like clovers is never double-counted),
// then surfaced with grouping (by phase or by acquisition), search, filters,
// sorting, and per-group buy-out subtotals.
// ---------------------------------------------------------------------------

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import {
  aggregateRequirements,
  aggregateIntermediates,
  trackedSlots,
  type AggregatedMaterial,
} from '../engine'
import { Card, Badge, SeverityDot, EmptyState, WikiName, ItemIcon, InfoTooltip, PageHeader } from '../components/ui'
import { formatGold } from '../lib/format'
import { ITEM_NOTES } from '../data/items'
import type { GameMode, MaterialCategory } from '../types'

type View = 'base' | 'gifts'
type Grouping = 'phase' | 'acquisition'
type Sort = 'default' | 'cost' | 'qty'
type Tone = 'gate' | 'good' | 'warn' | 'neutral' | 'accent'

const CATEGORY_META: Record<MaterialCategory, { label: string; tone: Tone; hint: string }> = {
  'time-gated': { label: 'Time-gated', tone: 'gate', hint: 'Daily-capped — these set the earliest finish date.' },
  currency: { label: 'Currency', tone: 'gate', hint: 'Wallet currencies earned in-game — not buyable.' },
  crafting: { label: 'Crafting material', tone: 'neutral', hint: 'Refined/fine materials — mostly Trading Post buyable.' },
  gift: { label: 'Gifts & intermediates', tone: 'accent', hint: 'Crafted in the Mystic Forge from the parts below.' },
  'reward-track': { label: 'Reward track', tone: 'warn', hint: 'Earned by completing a reward track (often WvW/PvP).' },
  achievement: { label: 'Achievement', tone: 'warn', hint: 'Unlocked by a specific achievement/collection.' },
  collection: { label: 'Collection & story', tone: 'warn', hint: 'Earned through a collection or story journey.' },
  vendor: { label: 'Vendor', tone: 'neutral', hint: 'Bought from an NPC vendor for currency.' },
}

const CATEGORY_ORDER: MaterialCategory[] = [
  'time-gated',
  'gift',
  'achievement',
  'collection',
  'reward-track',
  'vendor',
  'currency',
  'crafting',
]

const GAME_MODES: GameMode[] = ['PvP', 'WvW', 'Raid', 'Fractal']

const subtotal = (materials: AggregatedMaterial[]): number =>
  materials.reduce((s, m) => s + (m.buyable && m.unitPrice != null ? m.remaining * m.unitPrice : 0), 0)

function MaterialRow({ m }: { m: AggregatedMaterial }) {
  const days = m.timeGate.isGated && m.timeGate.dailyRate
    ? Math.ceil(m.remaining / m.timeGate.dailyRate)
    : null
  return (
    <div className="flex items-center gap-3 border-b border-line/60 py-1.5 last:border-0">
      <ItemIcon itemId={m.itemId} name={m.name} size={24} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {m.timeGate.isGated && m.timeGate.severity && <SeverityDot severity={m.timeGate.severity} />}
        <WikiName name={m.name} itemId={m.itemId} className="truncate text-sm text-ink" />
        {ITEM_NOTES[m.itemId] && <InfoTooltip label={ITEM_NOTES[m.itemId]} />}
        {m.gameMode && <Badge tone="accent">{m.gameMode}</Badge>}
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted">
        {m.owned}/{m.required}
      </span>
      <span className="hidden w-14 shrink-0 text-right text-sm tabular-nums text-gate sm:block">
        {days != null ? `${days}d` : ''}
      </span>
      <span className="hidden w-24 shrink-0 text-right font-mono text-xs text-muted sm:block">
        {m.buyable && m.unitPrice != null && m.unitPrice > 0 ? formatGold(m.remaining * m.unitPrice) : ''}
      </span>
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
  tone: Tone
  hint?: string
  materials: AggregatedMaterial[]
}) {
  if (materials.length === 0) return null
  const cost = subtotal(materials)
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <Badge tone={tone}>{materials.length}</Badge>
          {hint && <span className="hidden text-xs text-muted sm:inline">{hint}</span>}
        </div>
        {cost > 0 && <span className="font-mono text-xs text-muted">≈{formatGold(cost)}</span>}
      </div>
      <div className="mt-2 flex items-center gap-3 border-b border-line pb-1 text-[10px] uppercase tracking-wide text-muted">
        <span className="w-6 shrink-0" />
        <span className="flex-1">Material</span>
        <span className="w-20 shrink-0 text-right">Have</span>
        <span className="hidden w-14 shrink-0 text-right sm:block">Days</span>
        <span className="hidden w-24 shrink-0 text-right sm:block">TP cost</span>
      </div>
      <div>
        {materials.map((m) => (
          <MaterialRow key={m.itemId} m={m} />
        ))}
      </div>
    </Card>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export default function Materials() {
  const { loadout, sync, pricesLoaded } = useApp()
  const [view, setView] = useState<View>('base')
  const [grouping, setGrouping] = useState<Grouping>('phase')
  const [sort, setSort] = useState<Sort>('default')
  const [search, setSearch] = useState('')
  const [buyableOnly, setBuyableOnly] = useState(false)
  const [gatedOnly, setGatedOnly] = useState(false)
  const [modes, setModes] = useState<Set<GameMode>>(new Set())

  const slots = useMemo(() => trackedSlots(loadout), [loadout])
  const agg = useMemo(() => {
    const snapshot = sync?.snapshot ?? {}
    const prices = sync?.prices ?? {}
    return view === 'gifts'
      ? aggregateIntermediates(slots, snapshot, prices, sync?.meta)
      : aggregateRequirements(slots, snapshot, prices, sync?.meta)
  }, [slots, sync, view])

  const toggleMode = (mode: GameMode) =>
    setModes((prev) => {
      const next = new Set(prev)
      if (next.has(mode)) next.delete(mode)
      else next.add(mode)
      return next
    })

  const q = search.trim().toLowerCase()
  const filtered = agg.materials
    .filter((m) => m.remaining > 0)
    .filter((m) => (q ? m.name.toLowerCase().includes(q) : true))
    .filter((m) => (buyableOnly ? m.buyable && !m.timeGate.isGated : true))
    .filter((m) => (gatedOnly ? m.timeGate.isGated : true))
    .filter((m) => (modes.size ? m.gameMode != null && modes.has(m.gameMode) : true))

  const sortFn = (a: AggregatedMaterial, b: AggregatedMaterial): number => {
    if (sort === 'cost') {
      const ac = a.buyable && a.unitPrice != null ? a.remaining * a.unitPrice : 0
      const bc = b.buyable && b.unitPrice != null ? b.remaining * b.unitPrice : 0
      return bc - ac
    }
    if (sort === 'qty') return b.remaining - a.remaining
    return Number(b.timeGate.isGated) - Number(a.timeGate.isGated) || b.remaining - a.remaining
  }
  const sorted = [...filtered].sort(sortFn)

  // Group definitions for the chosen grouping.
  const groups: { key: string; title: string; tone: Tone; hint?: string; materials: AggregatedMaterial[] }[] =
    grouping === 'phase'
      ? [
          {
            key: 'gated',
            title: 'Time-gated',
            tone: 'gate',
            hint: "Daily-capped — these set the loadout's earliest finish date.",
            materials: sorted.filter((m) => m.timeGate.isGated),
          },
          {
            key: 'grind',
            title: 'Grind-only (account-bound)',
            tone: 'warn',
            hint: "Can't be bought on the Trading Post.",
            materials: sorted.filter((m) => !m.buyable && !m.timeGate.isGated),
          },
          {
            key: 'buyable',
            title: 'Buyable',
            tone: 'good',
            hint: "Available on the Trading Post if you'd rather spend gold than farm.",
            materials: sorted.filter((m) => m.buyable && !m.timeGate.isGated),
          },
        ]
      : CATEGORY_ORDER.map((cat) => ({
          key: cat,
          title: CATEGORY_META[cat].label,
          tone: CATEGORY_META[cat].tone,
          hint: CATEGORY_META[cat].hint,
          materials: sorted.filter((m) => m.category === cat),
        }))

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
      <PageHeader
        title="Whole-loadout materials"
        subtitle={`${trackedWithPiece} tracked pieces · crafting consumes: each piece needs its own materials${!sync ? ' · sync to credit your inventory' : ''}`}
        help="Every tracked piece rolled into one list. Crafting consumes materials, so required is the sum over pieces (two pieces needing 77 and 18 clovers require 95) and your stock — including pre-built gifts — is credited to one piece at a time in priority order, never to several at once. Pieces you already own contribute nothing."
        actions={
          <div className="text-right">
            <p className="text-xs text-muted">Total buy-out</p>
            {pricesLoaded ? (
              <p className="text-xl font-semibold text-ink">≈{formatGold(agg.buyOutGold)}</p>
            ) : (
              <p className="text-sm font-medium text-muted" title="Trading Post prices didn't load in the last sync — buy-out costs can't be computed. Sync again to fetch them.">
                prices unavailable
              </p>
            )}
          </div>
        }
      />

      {/* Toolbar: granularity / grouping / sort + search + filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            ['base', 'Base materials'],
            ['gifts', 'Gifts & intermediates'],
          ]}
        />
        <Segmented
          value={grouping}
          onChange={setGrouping}
          options={[
            ['phase', 'By phase'],
            ['acquisition', 'By acquisition'],
          ]}
        />
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            ['default', 'Sort: default'],
            ['cost', 'Sort: TP cost'],
            ['qty', 'Sort: quantity'],
          ]}
        />
        <span className="mx-1 h-5 w-px bg-line" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials…"
          className="w-40 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <Chip active={buyableOnly} onClick={() => setBuyableOnly((v) => !v)}>
          Buyable
        </Chip>
        <Chip active={gatedOnly} onClick={() => setGatedOnly((v) => !v)}>
          Time-gated
        </Chip>
        <span className="mx-1 h-5 w-px bg-line" />
        {GAME_MODES.map((mode) => (
          <Chip key={mode} active={modes.has(mode)} onClick={() => toggleMode(mode)}>
            {mode}
          </Chip>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No materials match" >
          {agg.materials.some((m) => m.remaining > 0)
            ? 'Try clearing the search or filters.'
            : 'Every tracked piece is covered 🎉'}
        </EmptyState>
      ) : (
        groups.map((g) => (
          <Group key={g.key} title={g.title} tone={g.tone} hint={g.hint} materials={g.materials} />
        ))
      )}
    </div>
  )
}

/** Small segmented control (shared markup for view/grouping/sort toggles). */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === v ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
