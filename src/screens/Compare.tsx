// ---------------------------------------------------------------------------
// Compare — generalized candidate comparison (docs/REDESIGN.md §2).
//
// Two entry points, one table of effort signals (time-gate days → gold →
// material overlap; the lowest-effort row is recommended):
//   /compare?ids=a,b,c   ad-hoc set from the Catalog tray ("Add as goal")
//   /compare?goal=<id>   a deciding goal's candidates ("Choose" resolves it)
// Candidates are alternatives — only one will be crafted — so each is measured
// against the full inventory (isolation), not the priority-allocated numbers.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { compareCandidates, computeProgress } from '../engine'
import { DEFAULT_WEIGHTS } from '../types'
import { Card, Badge, EmptyState, OverlayLink, ItemIcon, PageHeader } from '../components/ui'
import PiecePicker from '../components/PiecePicker'
import { formatGold } from '../lib/format'
import { CATALOG } from '../data/recipes'

interface Row {
  pieceId: number
  name: string
  type: string
  mode: string
  timeGateDays: number
  gold: number
  overlap: number
  owned: boolean
  recommended: boolean
}

export default function Compare({ inModal = false }: { inModal?: boolean }) {
  const [params] = useSearchParams()
  const { plan, sync, progressByPiece, addGoal, chooseGoalPiece, setGoalCandidates } = useApp()

  const goalId = params.get('goal')
  const idsParam = params.get('ids')

  const goal = goalId ? plan.goals.find((g) => g.id === goalId) : undefined

  const mode: 'goal' | 'ids' | 'none' = goal ? 'goal' : idsParam ? 'ids' : 'none'

  const candidateIds: number[] =
    mode === 'goal'
      ? goal!.candidateIds
      : mode === 'ids'
        ? idsParam!
            .split(',')
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n))
        : []

  const goalByPiece = useMemo(() => {
    const m = new Map<number, string>()
    for (const g of plan.goals) if (g.pieceId != null) m.set(g.pieceId, g.state)
    return m
  }, [plan])

  // Distinct required mats already in inventory — a proxy for "leverages what
  // you already have". Computed against gross requirements (empty snapshot) so
  // fully-satisfied mats still count toward overlap.
  const overlapFor = useMemo(() => {
    const snapshot = sync?.snapshot ?? {}
    return (pieceId: number): number => {
      const piece = CATALOG_BY_ID[pieceId]
      if (!piece) return 0
      const gross = computeProgress(piece, {}, sync?.prices ?? {}, DEFAULT_WEIGHTS, sync?.meta)
      return gross.remainingMaterials.filter((m) => (snapshot[m.itemId] ?? 0) > 0).length
    }
  }, [sync])

  // Small set (a handful of candidates) — computed per render; the React
  // Compiler memoizes automatically.
  const rows: Row[] = candidateIds
    .map((id) => CATALOG_BY_ID[id])
    .filter((p) => p != null)
    .map((piece) => {
      const prog = progressByPiece[piece.id]
      const timeGateDays = prog?.timeGateDebt.reduce((mx, d) => Math.max(mx, d.days), 0) ?? 0
      return {
        pieceId: piece.id,
        name: piece.name,
        type: piece.type,
        mode: piece.acquisitionMode,
        timeGateDays,
        gold: prog?.buyOutGold ?? 0,
        overlap: overlapFor(piece.id),
        owned: prog?.owned ?? false,
        recommended: false,
      }
    })
    .sort(compareCandidates)
  if (rows.length > 0) rows[0].recommended = true

  if (mode === 'none') {
    return (
      <EmptyState title="Nothing to compare">
        Pick candidates in the{' '}
        <Link to="/catalog" className="text-accent underline">
          catalog
        </Link>{' '}
        (select two or more, then "Compare").
      </EmptyState>
    )
  }

  const backTo = mode === 'goal' ? '/goals' : '/catalog'
  const title = mode === 'goal' ? 'Compare candidates · deciding goal' : 'Compare'

  const chooseAction = (r: Row) => {
    if (mode === 'goal') {
      const chosen = goal!.pieceId === r.pieceId && goal!.state !== 'deciding'
      return (
        <button
          onClick={() => chooseGoalPiece(goal!.id, r.pieceId)}
          disabled={chosen}
          className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent"
        >
          {chosen ? 'Chosen' : 'Choose'}
        </button>
      )
    }
    const inPlan = goalByPiece.get(r.pieceId)
    return inPlan ? (
      <span className="text-xs font-medium text-good">✓ In plan</span>
    ) : (
      <button
        onClick={() => addGoal({ pieceId: r.pieceId, state: 'active' })}
        className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent"
      >
        Add as goal
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {!inModal && (
        <Link to={backTo} className="text-sm text-accent underline">
          ← Back
        </Link>
      )}

      <PageHeader
        title={title}
        subtitle={`Lowest remaining effort wins.${!sync ? ' Sync to factor in your inventory.' : ''}`}
        help="Sorted by remaining time-gate days, then buy-out gold, then how many required materials you already own. Candidates are alternatives — only one will be crafted — so each is measured against your full inventory, unlike the priority-allocated ladder numbers."
      />

      {rows.length === 0 ? (
        <EmptyState title="No candidates yet">
          {mode === 'goal' ? 'Add candidates below.' : 'Add a few pieces to weigh side by side.'}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="p-3">Candidate</th>
                <th className="p-3">Time-gate</th>
                <th className="p-3">Gold left</th>
                <th className="p-3">Game mode</th>
                <th className="p-3">Owned mats</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.pieceId}
                  className={`border-b border-line/60 last:border-0 ${
                    r.recommended ? 'bg-good/5' : ''
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <ItemIcon itemId={r.pieceId} name={r.name} size={28} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <OverlayLink
                            to={`/piece/${r.pieceId}`}
                            className="font-medium text-ink hover:text-accent"
                          >
                            {r.name}
                          </OverlayLink>
                          {r.recommended && <Badge tone="good">lowest effort</Badge>}
                          {r.owned && <Badge tone="accent">owned</Badge>}
                        </div>
                        <p className="text-xs text-muted">{r.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-gate">{r.timeGateDays}d</td>
                  <td className="p-3 font-mono text-xs text-muted">≈{formatGold(r.gold)}</td>
                  <td className="p-3">
                    <Badge>{r.mode}</Badge>
                  </td>
                  <td className="p-3 text-muted">{r.overlap}</td>
                  <td className="p-3 text-right">{chooseAction(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Candidate management, per entry point. */}
      {mode === 'goal' && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-ink">Candidates for this goal</h3>
          <p className="mb-3 text-xs text-muted">Search the catalog to add another candidate.</p>
          <div className="max-w-md">
            <PiecePicker
              options={CATALOG.filter((p) => !goal!.candidateIds.includes(p.id))}
              onPick={(id) => setGoalCandidates(goal!.id, [...goal!.candidateIds, id])}
              placeholder="Add a candidate…"
            />
          </div>
          {goal!.candidateIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {goal!.candidateIds.map((id) => {
                const p = CATALOG_BY_ID[id]
                if (!p) return null
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs text-ink"
                  >
                    <ItemIcon itemId={id} name={p.name} size={18} />
                    {p.name}
                    <button
                      type="button"
                      onClick={() =>
                        setGoalCandidates(
                          goal!.id,
                          goal!.candidateIds.filter((c) => c !== id),
                        )
                      }
                      aria-label={`Remove ${p.name} from candidates`}
                      className="text-muted hover:text-bad"
                    >
                      ✕
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </Card>
      )}

    </div>
  )
}
