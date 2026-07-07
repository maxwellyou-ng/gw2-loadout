// ---------------------------------------------------------------------------
// Catalog — browse every legendary with the facets players actually decide by
// (docs/UX-BEST-PRACTICES.md §2.2): family/type, generation, game mode — and,
// because isolation progress is already computed for the whole catalog each
// sync, honest per-account chips: "X% · ~Nd of gates · ≈Yg to buy out".
// Multi-select feeds the generalized Compare.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { CATALOG } from '../data/recipes'
import type { LegendaryPiece } from '../types'
import { Badge, Card, EmptyState, ItemIcon, OverlayLink, PageHeader, ScorePill } from '../components/ui'
import { formatGold } from '../lib/format'

type SortKey = 'fastest' | 'cheapest' | 'name'

const FAMILIES = [
  { key: 'all', label: 'All' },
  { key: 'weapon', label: 'Weapons' },
  { key: 'armor', label: 'Armor' },
  { key: 'trinket', label: 'Trinkets' },
  { key: 'back', label: 'Back' },
] as const

/** Facet label: structured generation for weapons, game mode otherwise. */
function facetGen(p: LegendaryPiece): string {
  return p.gen ?? p.acquisitionMode
}

export default function Catalog() {
  const { plan, sync, progressByPiece, pricesLoaded, addGoal } = useApp()

  const [family, setFamily] = useState<(typeof FAMILIES)[number]['key']>('all')
  const [gen, setGen] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('fastest')
  const [tray, setTray] = useState<number[]>([])

  const goalByPiece = useMemo(() => {
    const m = new Map<number, string>()
    for (const g of plan.goals) if (g.pieceId != null) m.set(g.pieceId, g.state)
    return m
  }, [plan])

  const familyPieces = useMemo(
    () => (family === 'all' ? CATALOG : CATALOG.filter((p) => p.slot === family)),
    [family],
  )

  const genOptions = useMemo(() => {
    const set = new Set(familyPieces.map(facetGen))
    return ['all', ...[...set].sort()]
  }, [familyPieces])

  const daysFor = (p: LegendaryPiece) =>
    progressByPiece[p.id]?.timeGateDebt.reduce((mx, d) => Math.max(mx, d.days), 0) ?? 0

  const pieces = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = familyPieces.filter(
      (p) =>
        (gen === 'all' || facetGen(p) === gen) &&
        (!q || p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)),
    )
    const byName = (a: LegendaryPiece, b: LegendaryPiece) =>
      a.name.replace(/^The /, '').localeCompare(b.name.replace(/^The /, ''))
    if (sort === 'name') return [...filtered].sort(byName)
    if (sort === 'cheapest')
      return [...filtered].sort(
        (a, b) =>
          (progressByPiece[a.id]?.buyOutGold ?? Infinity) -
            (progressByPiece[b.id]?.buyOutGold ?? Infinity) || byName(a, b),
      )
    // fastest: owned last, then fewest gate-days, then most complete.
    return [...filtered].sort((a, b) => {
      const pa = progressByPiece[a.id]
      const pb = progressByPiece[b.id]
      return (
        Number(pa?.owned ?? false) - Number(pb?.owned ?? false) ||
        daysFor(a) - daysFor(b) ||
        (pb?.completionScore ?? 0) - (pa?.completionScore ?? 0) ||
        byName(a, b)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyPieces, gen, search, sort, progressByPiece])

  const toggleTray = (id: number) =>
    setTray((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))

  const chip = 'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors'

  return (
    <div className="space-y-4 pb-16">
      <PageHeader
        title="Legendary catalog"
        subtitle={
          sync
            ? 'Cost and time-to-finish are computed for your account — each piece measured against your full inventory.'
            : 'Sync your account (Settings) to see cost and time-to-finish for you.'
        }
        actions={
          <Link to="/goals" className="text-sm font-medium text-accent hover:underline">
            ← Goals
          </Link>
        }
      />

      {/* --- Facets --- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by family">
          {FAMILIES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFamily(f.key)
                setGen('all')
              }}
              className={`${chip} ${
                family === f.key
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="hidden text-line sm:inline">|</span>
        <select
          value={gen}
          onChange={(e) => setGen(e.target.value)}
          aria-label="Filter by generation or source"
          className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
        >
          {genOptions.map((g) => (
            <option key={g} value={g}>
              {g === 'all' ? 'Any generation / source' : g}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort order"
          className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
        >
          <option value="fastest">Fastest for you</option>
          <option value="cheapest">Cheapest buy-out</option>
          <option value="name">Name</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search the catalog"
          className="min-w-32 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink placeholder:text-muted outline-none focus:border-accent"
        />
      </div>

      {/* --- Cards --- */}
      {pieces.length === 0 ? (
        <EmptyState title="No matches">Try clearing a filter.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pieces.map((p) => {
            const prog = progressByPiece[p.id]
            const inPlan = goalByPiece.get(p.id)
            const days = daysFor(p)
            const inTray = tray.includes(p.id)
            return (
              <Card key={p.id} className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <ItemIcon itemId={p.id} name={p.name} size={36} className="mt-0.5" />
                    <div className="min-w-0">
                      <OverlayLink
                        to={`/piece/${p.id}`}
                        className="block truncate font-semibold text-ink hover:text-accent"
                      >
                        {p.name}
                      </OverlayLink>
                      <p className="truncate text-xs text-muted">{p.type}</p>
                    </div>
                  </div>
                  {prog?.owned ? (
                    <Badge tone="good">owned</Badge>
                  ) : (
                    prog && <ScorePill value={prog.completionScore} />
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="accent">{facetGen(p)}</Badge>
                  {p.gen && <Badge>{p.acquisitionMode}</Badge>}
                  {!p.recipe.verified && <Badge tone="warn">unverified</Badge>}
                </div>

                {prog && !prog.owned && (
                  <p className="mt-2 text-xs text-muted">
                    {days > 0 ? `~${days}d of time gates` : 'no time gates'}
                    {pricesLoaded &&
                      prog.buyOutGold > 0 &&
                      ` · ≈${formatGold(prog.buyOutGold)} buyable`}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  {inPlan ? (
                    <span className="text-xs font-medium text-good">
                      ✓ In plan{inPlan === 'done' ? ' — done' : inPlan === 'paused' ? ' — paused' : ''}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addGoal({ pieceId: p.id, state: 'active' })}
                      className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-canvas"
                    >
                      Add as goal
                    </button>
                  )}
                  <label
                    className={`flex cursor-pointer items-center gap-1.5 text-xs ${
                      inTray ? 'text-accent' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={inTray}
                      onChange={() => toggleTray(p.id)}
                      className="accent-accent"
                    />
                    Compare
                  </label>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* --- Compare tray --- */}
      {tray.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-2.5 shadow-lg">
          <span className="text-sm text-ink">
            {tray.length} selected
            {tray.length === 1 && ' — pick at least one more'}
          </span>
          {tray.length >= 2 && (
            <OverlayLink
              to={`/compare?ids=${tray.join(',')}`}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-canvas"
            >
              Compare {tray.length} →
            </OverlayLink>
          )}
          <button
            type="button"
            onClick={() => setTray([])}
            className="rounded px-1 text-muted hover:text-ink"
            aria-label="Clear selection"
          >
            ✕
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {pieces.length} legendaries shown
      </p>
    </div>
  )
}
