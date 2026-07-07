// ---------------------------------------------------------------------------
// Goal-centric plan model (docs/REDESIGN.md §5).
//
// A Plan is an ordered list of Goals — "I want Twilight, then Conflux" — where
// array order IS priority. It replaces the slot-grid Loadout as the source of
// truth; equipment-slot coverage becomes a derived view (`slotHint` preserves
// where a migrated piece used to sit). The engine is untouched: `goalEntries`
// adapts goals onto the same AllocationEntry shape `allocateProgress` and
// `aggregateRequirements` already consume.
//
// Migration is lossless and one-way-safe: the legacy `gw2lt:loadout` key is
// read once (when `gw2lt:plan` is absent) and left in place for rollback.
// ---------------------------------------------------------------------------

import type { SlotKey } from '../types'
import type { AllocationEntry } from '../engine'
import { normalizeLoadout, SLOT_ORDER, type Loadout } from '../data/loadout'

export type GoalState = 'active' | 'paused' | 'deciding' | 'done'

export interface Goal {
  /** Stable id — the allocation key and React key. */
  id: string
  /** Chosen legendary piece id; null only while `state === 'deciding'`. */
  pieceId: number | null
  /**
   * active  — in the plan: allocated, counted, on the daily list.
   * paused  — chosen but shelved: shown dimmed, consumes nothing.
   * deciding— weighing candidates; not part of any total.
   * done    — unlocked in the armory; lives on the trophy shelf.
   */
  state: GoalState
  /** Candidate piece ids being weighed (deciding goals; kept after choosing). */
  candidateIds: number[]
  /** Equipment slot this goal covers, when known — feeds the coverage grid. */
  slotHint?: SlotKey
  addedAt: string // ISO date
  completedAt?: string // ISO date, set when state flips to done
  /** The one-time completion celebration has been shown. */
  celebrated?: boolean
}

export interface Plan {
  version: 2
  name: string
  /** Array order is priority: goals[0] gets first claim on owned stock. */
  goals: Goal[]
  /** Last sync timestamp already processed for completion detection. */
  lastProcessedSync?: string
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export function newGoalId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function makeGoal(
  init: Partial<Goal> & Pick<Goal, 'pieceId' | 'state'>,
): Goal {
  return {
    id: init.id ?? newGoalId(),
    pieceId: init.pieceId,
    state: init.state,
    candidateIds: init.candidateIds ?? [],
    slotHint: init.slotHint,
    addedAt: init.addedAt ?? todayISO(),
    completedAt: init.completedAt,
    celebrated: init.celebrated,
  }
}

export function emptyPlan(): Plan {
  return { version: 2, name: 'My plan', goals: [] }
}

/** Fill defaults and drop malformed entries from an untrusted stored plan. */
export function normalizePlan(plan: Plan): Plan {
  const goals = (plan.goals ?? [])
    .filter(
      (g) =>
        g &&
        typeof g === 'object' &&
        (typeof g.pieceId === 'number' || g.pieceId === null) &&
        ['active', 'paused', 'deciding', 'done'].includes(g.state),
    )
    .map((g) => makeGoal(g))
  return {
    version: 2,
    name: typeof plan.name === 'string' && plan.name ? plan.name : 'My plan',
    goals,
    lastProcessedSync: plan.lastProcessedSync,
  }
}

/**
 * Lossless migration from the slot-grid Loadout (docs/REDESIGN.md §5):
 *  - chosen + tracked   → active goal
 *  - chosen + untracked → paused goal
 *  - flexible w/ candidates, nothing chosen → deciding goal
 *  - empty slots → dropped (goodbye dead relic/rune cards)
 * Order follows slot priority so the ladder carries over unchanged.
 */
export function migrateLoadoutToPlan(loadout: Loadout): Plan {
  const normalized = normalizeLoadout(loadout)
  const slots = [...normalized.slots].sort((a, b) => a.priority - b.priority)
  const goals: Goal[] = []
  for (const s of slots) {
    if (s.chosenPieceId != null) {
      goals.push(
        makeGoal({
          pieceId: s.chosenPieceId,
          state: s.tracked ? 'active' : 'paused',
          candidateIds: s.candidateIds,
          slotHint: s.key,
        }),
      )
    } else if (s.flexible && s.candidateIds.length > 0) {
      goals.push(
        makeGoal({
          pieceId: null,
          state: 'deciding',
          candidateIds: s.candidateIds,
          slotHint: s.key,
        }),
      )
    }
  }
  return { version: 2, name: normalized.name, goals }
}

/**
 * Engine adapter: goals as AllocationEntry rows for `allocateProgress` /
 * `aggregateRequirements`. Active and done goals are "tracked" (done pieces
 * compute as owned and consume nothing — same as the old model); paused goals
 * ride along untracked; deciding goals aren't in the plan's math at all.
 */
export function goalEntries(plan: Plan): (AllocationEntry & { goal: Goal })[] {
  return plan.goals
    .filter((g) => g.pieceId != null && g.state !== 'deciding')
    .map((g, i) => ({
      key: g.id,
      tracked: g.state === 'active' || g.state === 'done',
      priority: i,
      chosenPieceId: g.pieceId,
      goal: g,
    }))
}

/** Active goals in priority order — the ladder. */
export function activeGoals(plan: Plan): Goal[] {
  return plan.goals.filter((g) => g.state === 'active')
}

export function doneGoals(plan: Plan): Goal[] {
  return plan.goals.filter((g) => g.state === 'done')
}

/** Human label for a goal's covered slot, when known. */
export function slotLabel(hint: SlotKey | undefined): string | undefined {
  return hint ? SLOT_ORDER.find((s) => s.key === hint)?.label : undefined
}
