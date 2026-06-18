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

const add = (snap: InventorySnapshot, id: number, qty: number) => {
  if (!qty) return
  snap[id] = (snap[id] ?? 0) + qty
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
