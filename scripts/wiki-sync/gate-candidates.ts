// ---------------------------------------------------------------------------
// Shared enumeration for the gate-or-allowlist audit (`npm run wiki:gate-audit`
// seeds, Check 4 in check-totals.ts enforces).
//
// A "candidate" is any catalog leaf a player cannot simply buy off the TP and
// needs in bulk: real (non-synthetic) id, engine-classified not buyable, and
// required ≥ MIN_QTY in at least one piece. Every candidate must be classified
// exactly one way — registered in TIME_GATED (it has a bounded pace and shows
// on the Forecast) or documented in fast-acquire.json (quickly acquirable /
// gated elsewhere, with a reason). qty-1 journey items (precursors, collection
// gifts) are leaf-policy's domain and stay below the threshold.
// ---------------------------------------------------------------------------

import { CATALOG } from '../../src/data/recipes'
import { computeProgress } from '../../src/engine'
import { isSynthetic, isTimeGated } from '../../src/data/items'
import { DEFAULT_WEIGHTS } from '../../src/types'
import { canonComponent } from './aliases'

/** Bulk threshold: below this a leaf is a one-off journey step, not a farm. */
export const GATE_AUDIT_MIN_QTY = 5

export interface GateCandidate {
  itemId: number
  name: string
  canon: string
  /** Highest single-piece gross requirement across the catalog. */
  maxRequired: number
  pieces: number
  gated: boolean
}

/** Distinct non-buyable bulk leaves across the whole catalog. */
export function collectGateCandidates(): GateCandidate[] {
  const acc = new Map<number, GateCandidate>()
  for (const piece of CATALOG) {
    const prog = computeProgress(piece, {}, {}, DEFAULT_WEIGHTS)
    for (const m of prog.remainingMaterials) {
      if (isSynthetic(m.itemId) || m.buyable) continue
      const cur = acc.get(m.itemId)
      if (cur) {
        cur.maxRequired = Math.max(cur.maxRequired, m.required)
        cur.pieces++
      } else {
        acc.set(m.itemId, {
          itemId: m.itemId,
          name: m.name,
          canon: canonComponent(m.name),
          maxRequired: m.required,
          pieces: 1,
          gated: isTimeGated(m.itemId),
        })
      }
    }
  }
  return [...acc.values()]
    .filter((c) => c.maxRequired >= GATE_AUDIT_MIN_QTY)
    .sort((a, b) => a.canon.localeCompare(b.canon))
}
