// ---------------------------------------------------------------------------
// Whole-loadout selectors + aggregation, layered on top of computeProgress.
//
// Everything that totals across pieces routes through here so that untracked
// slots (slot.tracked === false) are excluded consistently and shared
// materials (clovers feed many pieces) are de-duplicated rather than
// double-counted.
// ---------------------------------------------------------------------------

import type {
  DerivedProgress,
  GameMode,
  InventorySnapshot,
  LegendaryPiece,
  MaterialCategory,
  PriceMap,
  RecipeSource,
  RemainingMaterial,
  SyncMeta,
  TimeGate,
  TimeGateDebt,
} from '../types'
import { DEFAULT_WEIGHTS } from '../types'
import type { CompletionWeights } from '../types'
import type { Loadout, LoadoutSlot } from '../data/loadout'
import { CATALOG_BY_ID } from '../data/recipes'
import { isSynthetic } from '../data/items'
import { computeProgress, intermediateRequirements } from './progress'

/**
 * The structural shape the allocation walk actually reads. Both the legacy
 * LoadoutSlot (key: SlotKey) and the goal-centric Plan's entries (key: goal id)
 * satisfy it — the engine doesn't care where the ordering comes from.
 */
export interface AllocationEntry {
  key: string
  tracked: boolean
  priority: number
  chosenPieceId: number | null
}

/** Tracked slots only — the basis for every whole-loadout total. */
export function trackedSlots(loadout: Loadout): LoadoutSlot[] {
  return loadout.slots.filter((s) => s.tracked)
}

/** The chosen legendary for a slot, if one is set. */
export function pieceForSlot(slot: AllocationEntry): LegendaryPiece | undefined {
  return slot.chosenPieceId != null ? CATALOG_BY_ID[slot.chosenPieceId] : undefined
}

/** Derived progress for a slot's chosen piece, if both exist. */
export function progressForSlot(
  slot: AllocationEntry,
  progressByPiece: Record<number, DerivedProgress>,
): DerivedProgress | undefined {
  return slot.chosenPieceId != null ? progressByPiece[slot.chosenPieceId] : undefined
}

/** Sortable priority rank: lower numbers come first. */
export function priorityRank(slot: AllocationEntry): number {
  return slot.priority
}

/**
 * Tracked slots whose chosen piece resolves in the catalog, ordered for the
 * dashboard. (A stale localStorage loadout can point at a piece id no longer in
 * the catalog after a data update — those slots are skipped, not crashed on.)
 */
export function plannedSlots(loadout: Loadout): LoadoutSlot[] {
  return trackedSlots(loadout)
    .filter((s) => pieceForSlot(s) != null)
    .sort((a, b) => priorityRank(a) - priorityRank(b))
}

/**
 * Consumption-correct per-slot progress: crafting consumes materials, so owned
 * stock can satisfy each requirement only once. Walk the tracked+chosen slots
 * in priority order with a depleting snapshot copy — each piece is computed
 * against what's *left* after every higher-priority piece claims its share
 * (leaf credits + owned-intermediate credits, from `DerivedProgress.consumed`).
 * Already-unlocked pieces consume nothing (they'll never be crafted).
 *
 * Keyed by slot (not piece id): the same piece in two slots must not share one
 * result — the second copy sees the depleted snapshot.
 */
export function allocateProgress(
  slots: AllocationEntry[],
  snapshot: InventorySnapshot,
  prices: PriceMap,
  weights: CompletionWeights = DEFAULT_WEIGHTS,
  meta?: SyncMeta,
): Record<string, DerivedProgress> {
  const ordered = slots
    .filter((s) => s.tracked && pieceForSlot(s) != null)
    .sort((a, b) => priorityRank(a) - priorityRank(b))

  const working: InventorySnapshot = { ...snapshot }
  const out: Record<string, DerivedProgress> = {}

  for (const slot of ordered) {
    const piece = pieceForSlot(slot)!
    const prog = computeProgress(piece, working, prices, weights, meta)
    out[slot.key] = prog
    for (const [id, qty] of Object.entries(prog.consumed)) {
      const itemId = Number(id)
      working[itemId] = Math.max(0, (working[itemId] ?? 0) - qty)
    }
  }
  return out
}

/** One row of the de-duplicated whole-loadout requirement list. */
export interface AggregatedMaterial {
  itemId: number
  name: string
  /** Gross required, summed across every tracked piece. */
  required: number
  /** Owned, counted once for the whole loadout (synthetics never match). */
  owned: number
  remaining: number
  buyable: boolean
  timeGate: TimeGate
  unitPrice?: number
  source?: RecipeSource
  category: MaterialCategory
  gameMode?: GameMode
}

export interface AggregateResult {
  materials: AggregatedMaterial[]
  /** Total copper to buy out the purchasable remainder. */
  buyOutGold: number
  /** Per-material time-gate debt after de-duplication, worst-first. */
  timeGateDebt: TimeGateDebt[]
}

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 } as const

/**
 * Roll all tracked pieces into one master requirement list keyed by itemId.
 *
 * Consumption-correct accounting (crafting consumes materials — each piece
 * needs its own copy):
 * - `required` is the *gross* sum: each not-yet-owned tracked piece's fully
 *   flattened leaf list computed against an empty snapshot, summed. Two pieces
 *   needing 77 + 18 clovers require 95.
 * - `remaining` is summed from the priority-order allocation walk
 *   (`allocateProgress`), where each piece is computed against the snapshot
 *   *depleted* by higher-priority pieces. Owned stock — including pre-built
 *   intermediates like a banked Gift of Fortune — credits exactly one piece's
 *   requirement, never several at once.
 * - `owned` (the credited column) is `required − remaining`.
 * - Pieces already unlocked in the armory contribute nothing.
 * Weights don't affect material math, so defaults are fine here.
 */
export function aggregateRequirements(
  slots: AllocationEntry[],
  snapshot: InventorySnapshot,
  prices: PriceMap,
  meta?: SyncMeta,
): AggregateResult {
  const alloc = allocateProgress(slots, snapshot, prices, DEFAULT_WEIGHTS, meta)

  // Gross requirement per leaf (empty snapshot → remaining === required),
  // summed over tracked, not-yet-unlocked pieces.
  const byItem = buildGrossRows(slots, alloc, (piece) =>
    computeProgress(piece, {}, prices, DEFAULT_WEIGHTS, meta).remainingMaterials,
  )

  // Allocated remaining per leaf. Allocation leaf sets are subsets of the gross
  // sets (owned-intermediate credits only prune subtrees), so every id here has
  // a gross row; anything absent has remaining 0.
  const remainingById = new Map<number, number>()
  for (const slot of slots) {
    const prog = alloc[slot.key]
    if (!prog || prog.owned) continue
    for (const m of prog.remainingMaterials) {
      remainingById.set(m.itemId, (remainingById.get(m.itemId) ?? 0) + m.remaining)
    }
  }

  return finishRows(byItem, prices, (m) =>
    Math.min(m.required, remainingById.get(m.itemId) ?? 0),
  )
}

/**
 * Gift-level granularity (brief Phase 4.2 / feature 5): roll up the *direct
 * inputs of each piece's final combine* (gifts/intermediates + top-level base
 * mats) instead of fully-flattened base materials. Gross summed per piece,
 * owned subtracted **once** at the aggregate level — one banked gift credits
 * one requirement. Already-unlocked pieces contribute nothing.
 */
export function aggregateIntermediates(
  slots: AllocationEntry[],
  snapshot: InventorySnapshot,
  prices: PriceMap,
  meta?: SyncMeta,
): AggregateResult {
  const alloc = allocateProgress(slots, snapshot, prices, DEFAULT_WEIGHTS, meta)
  const byItem = buildGrossRows(slots, alloc, (piece) =>
    intermediateRequirements(piece, {}, prices),
  )
  return finishRows(byItem, prices, (m) => {
    const owned = isSynthetic(m.itemId) ? 0 : snapshot[m.itemId] ?? 0
    return Math.max(0, m.required - owned)
  })
}

/** Sum per-piece gross requirement lists into rows, skipping untracked slots,
 *  unresolvable pieces, and pieces the armory already reports unlocked. */
function buildGrossRows(
  slots: AllocationEntry[],
  alloc: Record<string, DerivedProgress>,
  grossFor: (piece: LegendaryPiece) => RemainingMaterial[],
): Map<number, AggregatedMaterial> {
  const byItem = new Map<number, AggregatedMaterial>()
  for (const slot of slots) {
    if (!slot.tracked) continue
    const piece = pieceForSlot(slot)
    if (!piece) continue
    if (alloc[slot.key]?.owned) continue // already unlocked: nothing to craft
    for (const m of grossFor(piece)) {
      const cur = byItem.get(m.itemId)
      if (cur) {
        cur.required += m.required
      } else {
        byItem.set(m.itemId, {
          itemId: m.itemId,
          name: m.name,
          required: m.required,
          owned: 0,
          remaining: 0,
          buyable: m.buyable,
          timeGate: m.timeGate,
          unitPrice: m.unitPrice,
          source: m.source,
          category: m.category,
          gameMode: m.gameMode,
        })
      }
    }
  }
  return byItem
}

/** Fill remaining/owned via `remainingFor`, re-price, and derive the totals. */
function finishRows(
  byItem: Map<number, AggregatedMaterial>,
  prices: PriceMap,
  remainingFor: (m: AggregatedMaterial) => number,
): AggregateResult {
  let buyOutGold = 0
  for (const m of byItem.values()) {
    m.remaining = remainingFor(m)
    m.owned = m.required - m.remaining
    // Re-price against live prices in case the gross pass had none loaded.
    if (m.buyable) {
      m.unitPrice = prices[m.itemId] ?? m.unitPrice
      if (m.unitPrice != null) buyOutGold += m.remaining * m.unitPrice
    }
  }

  const materials = [...byItem.values()].sort(
    (a, b) => Number(b.timeGate.isGated) - Number(a.timeGate.isGated) || b.remaining - a.remaining,
  )

  const timeGateDebt: TimeGateDebt[] = materials
    .filter((m) => m.remaining > 0 && m.timeGate.isGated && (m.timeGate.dailyRate ?? 0) > 0)
    .map((m) => ({
      itemId: m.itemId,
      name: m.name,
      remaining: m.remaining,
      dailyRate: m.timeGate.dailyRate!,
      severity: m.timeGate.severity ?? 'low',
      days: Math.ceil(m.remaining / m.timeGate.dailyRate!),
    }))
    .sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.days - a.days,
    )

  return { materials, buyOutGold, timeGateDebt }
}
