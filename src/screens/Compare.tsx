// ---------------------------------------------------------------------------
// Flexible-slot comparison (brief Phase 4.1).
//
// For a slot's candidate pieces, a side-by-side table of the effort signals:
//   - remaining time-gate days   (max of the piece's timeGateDebt.days)
//   - remaining gold             (buyOutGold)
//   - required game mode         (piece.acquisitionMode)
//   - material overlap           (distinct required mats already in inventory)
// Sorted by time-gate days, tie-broken by gold then overlap. The lowest-effort
// candidate is recommended. A picker lets you add/remove candidates and choose
// the winner for the slot.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { piecesForSlot } from '../lib/slotPieces'
import { computeProgress } from '../engine'
import { DEFAULT_WEIGHTS } from '../types'
import { Card, Badge, EmptyState, OverlayLink, ItemIcon, PageHeader } from '../components/ui'
import { formatGold } from '../lib/format'
import type { SlotKey } from '../types'

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
  const { slotKey } = useParams<{ slotKey: string }>()
  const { loadout, sync, progressByPiece, setSlotCandidates, setSlotPiece } = useApp()

  const slot = loadout.slots.find((s) => s.key === slotKey)

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

  const rows: Row[] = useMemo(() => {
    if (!slot) return []
    const base = slot.candidateIds
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
    base.sort(
      (a, b) =>
        a.timeGateDays - b.timeGateDays || a.gold - b.gold || b.overlap - a.overlap,
    )
    if (base.length > 0) base[0].recommended = true
    return base
  }, [slot, progressByPiece, overlapFor])

  if (!slot) {
    return (
      <EmptyState title="Slot not found">
        <Link to="/loadout" className="text-accent underline">
          Back to loadout
        </Link>
      </EmptyState>
    )
  }

  const familyPieces = piecesForSlot(slot)
  const toggleCandidate = (pieceId: number) => {
    const next = slot.candidateIds.includes(pieceId)
      ? slot.candidateIds.filter((id) => id !== pieceId)
      : [...slot.candidateIds, pieceId]
    setSlotCandidates(slot.key as SlotKey, next)
  }

  return (
    <div className="space-y-6">
      {!inModal && (
        <Link to="/loadout" className="text-sm text-accent underline">
          ← Loadout
        </Link>
      )}

      <PageHeader
        title={`Compare candidates · ${slot.label}`}
        subtitle={`Lowest remaining effort wins.${!sync ? ' Sync to factor in your inventory.' : ''}`}
        help="Sorted by remaining time-gate days, then buy-out gold, then how many required materials you already own."
      />

      {rows.length === 0 ? (
        <EmptyState title="No candidates yet">
          Add a few pieces below to weigh them side by side.
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
                          <OverlayLink to={`/piece/${r.pieceId}`} className="font-medium text-ink hover:text-accent">
                            {r.name}
                          </OverlayLink>
                          {r.recommended && <Badge tone="good">lowest effort</Badge>}
                          {r.owned && <Badge tone="accent">owned</Badge>}
                          {slot.chosenPieceId === r.pieceId && <Badge>chosen</Badge>}
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
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSlotPiece(slot.key as SlotKey, r.pieceId)}
                      disabled={slot.chosenPieceId === r.pieceId}
                      className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent disabled:opacity-40"
                    >
                      {slot.chosenPieceId === r.pieceId ? 'Chosen' : 'Choose'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-ink">Candidates for this slot</h3>
        <p className="mb-3 text-xs text-muted">
          Toggle the {slot.family} pieces you're weighing for {slot.label}.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {familyPieces.map((p) => {
            const on = slot.candidateIds.includes(p.id)
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:border-accent/60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleCandidate(p.id)}
                  className="accent-accent"
                />
                <ItemIcon itemId={p.id} name={p.name} size={22} />
                <span className="min-w-0 truncate">{p.name}</span>
              </label>
            )
          })}
          {familyPieces.length === 0 && (
            <p className="text-sm text-muted">No catalog pieces for this slot family yet.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
