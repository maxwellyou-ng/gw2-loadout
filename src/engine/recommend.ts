// ---------------------------------------------------------------------------
// Recommendation rules, extracted pure so engine-check can pin them:
//   - Compare's candidate ranking (which alternative is least effort)
//   - Dashboard's "finish-line push" rule (which pieces to close out now)
// The screens import these; don't re-implement the rules inline in the UI.
// ---------------------------------------------------------------------------

import type { DerivedProgress } from '../types'

/** The effort signals Compare ranks candidates on. */
export interface CandidateSignals {
  /** Max days of time-gate debt remaining (the binding daily cap). */
  timeGateDays: number
  /** Copper to buy out the purchasable remainder. */
  gold: number
  /** Distinct required materials already in inventory (leverage proxy). */
  overlap: number
}

/**
 * Compare ranking: fewest time-gate days first (gates can't be rushed), then
 * cheapest buy-out, then the candidate that leverages more of what you own.
 * The first element after sorting with this is the recommendation.
 */
export function compareCandidates(a: CandidateSignals, b: CandidateSignals): number {
  return a.timeGateDays - b.timeGateDays || a.gold - b.gold || b.overlap - a.overlap
}

/** Whole days from `now` until an ISO date, or null when absent. */
export function daysUntilISO(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const target = new Date(iso)
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

/**
 * Dashboard "push to finish": a piece is worth a focused session when either
 * everything left is purchasable (gold closes it today), or it's ≥80% complete
 * with the last time gate at most two weeks out.
 */
export function isFinishLinePush(prog: DerivedProgress | undefined, now: Date = new Date()): boolean {
  if (!prog || prog.owned) return false
  if (prog.finishableByGold) return true
  const d = daysUntilISO(prog.earliestFinishDate, now)
  return prog.completionScore >= 0.8 && d != null && d <= 14
}
