// Merge every account source into one owned[itemId] = qty snapshot.

import type { InventorySnapshot } from '../types'
import { currency } from '../data/items'

export interface RawAccountData {
  /** /v2/account/materials */
  materials: { id: number; count: number }[]
  /** /v2/account/bank (null = empty slot) */
  bank: ({ id: number; count: number } | null)[]
  /** /v2/account/inventory (shared slots) */
  sharedInventory: ({ id: number; count: number } | null)[]
  /** flattened character bags + equipment */
  characterItems: { id: number; count: number }[]
  /** /v2/account/wallet */
  wallet: { id: number; value: number }[]
}

/** Retired items superseded by wallet currencies: legacy stacks still sitting
 *  in banks/bags count toward the currency's balance (1 item = 1 unit). */
const ITEM_TO_CURRENCY: Record<number, number> = {
  88926: currency(29), // "1 Provisioner Token" → Provisioner Token wallet currency
}

const add = (snap: InventorySnapshot, id: number, qty: number) => {
  if (!qty) return
  const target = ITEM_TO_CURRENCY[id] ?? id
  snap[target] = (snap[target] ?? 0) + qty
}

/** mergeInventory(apiResponses) -> InventorySnapshot (Section 4, step 4). */
export function mergeInventory(raw: Partial<RawAccountData>): InventorySnapshot {
  const snap: InventorySnapshot = {}
  for (const m of raw.materials ?? []) add(snap, m.id, m.count)
  for (const s of raw.bank ?? []) if (s) add(snap, s.id, s.count)
  for (const s of raw.sharedInventory ?? []) if (s) add(snap, s.id, s.count)
  for (const c of raw.characterItems ?? []) add(snap, c.id, c.count)
  // Wallet currencies live in the currency-namespaced id range.
  for (const w of raw.wallet ?? []) add(snap, currency(w.id), w.value)
  return snap
}
