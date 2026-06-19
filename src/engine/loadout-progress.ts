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
import type { Loadout, LoadoutSlot } from '../data/loadout'
import { CATALOG_BY_ID } from '../data/recipes'
import { isSynthetic } from '../data/items'
import { computeProgress, intermediateRequirements } from './progress'

/** Tracked slots only — the basis for every whole-loadout total. */
export function trackedSlots(loadout: Loadout): LoadoutSlot[] {
  return loadout.slots.filter((s) => s.tracked)
}

/** The chosen legendary for a slot, if one is set. */
export function pieceForSlot(slot: LoadoutSlot): LegendaryPiece | undefined {
  return slot.chosenPieceId != null ? CATALOG_BY_ID[slot.chosenPieceId] : undefined
}

/** Derived progress for a slot's chosen piece, if both exist. */
export function progressForSlot(
  slot: LoadoutSlot,
  progressByPiece: Record<number, DerivedProgress>,
): DerivedProgress | undefined {
  return slot.chosenPieceId != null ? progressByPiece[slot.chosenPieceId] : undefined
}

/** Sortable priority rank: lower numbers come first. */
export function priorityRank(slot: LoadoutSlot): number {
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
 * The de-dup primitive (brief 4.2, needed by the dashboard's total-debt card):
 * we sum each piece's *gross* base-material requirement, then subtract owned
 * **once**. Gross requirement is read from `computeProgress(piece, {} , …)` —
 * an empty snapshot makes `remaining === required`, so nothing is dropped and
 * we never lean on the per-piece owned subtraction (which would double-count a
 * shared mat across pieces). Weights don't affect material math, so defaults
 * are fine here.
 */
export function aggregateRequirements(
  slots: LoadoutSlot[],
  snapshot: InventorySnapshot,
  prices: PriceMap,
  meta?: SyncMeta,
): AggregateResult {
  // Base granularity: each piece's gross requirement is its fully-flattened
  // leaf list (computed against an empty snapshot so `remaining === required`).
  return aggregateBy(slots, snapshot, prices, (piece) =>
    computeProgress(piece, {}, prices, DEFAULT_WEIGHTS, meta).remainingMaterials,
  )
}

/**
 * Gift-level granularity (brief Phase 4.2 / feature 5): roll up the *direct
 * inputs of each piece's final combine* (gifts/intermediates + top-level base
 * mats) instead of fully-flattened base materials. Same de-dup + owned-once
 * accounting as `aggregateRequirements`.
 */
export function aggregateIntermediates(
  slots: LoadoutSlot[],
  snapshot: InventorySnapshot,
  prices: PriceMap,
): AggregateResult {
  return aggregateBy(slots, snapshot, prices, (piece) =>
    intermediateRequirements(piece, {}, prices),
  )
}

/** Shared core: sum a per-piece gross requirement list, subtract owned once. */
function aggregateBy(
  slots: LoadoutSlot[],
  snapshot: InventorySnapshot,
  prices: PriceMap,
  grossFor: (piece: LegendaryPiece) => RemainingMaterial[],
): AggregateResult {
  const byItem = new Map<number, AggregatedMaterial>()

  for (const slot of slots) {
    if (!slot.tracked) continue
    const piece = pieceForSlot(slot)
    if (!piece) continue
    // Gross requirement, owned credited later (once) at the aggregate level.
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

  let buyOutGold = 0
  for (const m of byItem.values()) {
    const owned = isSynthetic(m.itemId) ? 0 : snapshot[m.itemId] ?? 0
    m.owned = Math.min(owned, m.required)
    m.remaining = Math.max(0, m.required - owned)
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
