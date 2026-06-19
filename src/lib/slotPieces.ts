// Which catalog pieces are eligible for a given loadout slot, and in what order.
// Shared by the Loadout dropdowns and the Compare candidate picker so both stay
// consistent (same filtering, same alphabetical-ignoring-"The" sort).

import { CATALOG } from '../data/recipes'
import type { LegendaryPiece, SlotKey } from '../types'
import type { LoadoutSlot } from '../data/loadout'

/** Type keywords that qualify a catalog piece for a specific slot. Weapons and
 *  Back have no entry — any piece in the family fits the slot. */
const SLOT_PIECE_KEYWORDS: Partial<Record<SlotKey, string[]>> = {
  helm: ['helm'],
  shoulders: ['shoulder'],
  chest: ['chest', 'coat'],
  gloves: ['glove'],
  leggings: ['legging', 'pants'],
  boots: ['boot'],
  amulet: ['amulet'],
  ring1: ['ring'],
  ring2: ['ring'],
  accessory1: ['accessory'],
  accessory2: ['accessory'],
}

/** Sort key: alphabetical, ignoring a leading "The " (so "The Bifrost" files
 *  under B). */
export const sortName = (name: string) => name.replace(/^the\s+/i, '').toLowerCase()

/** Catalog pieces eligible for a slot, narrowed to the slot's type and sorted. */
export function piecesForSlot(slot: Pick<LoadoutSlot, 'key' | 'family'>): LegendaryPiece[] {
  const family = CATALOG.filter((p) => p.slot === slot.family)
  const keywords = SLOT_PIECE_KEYWORDS[slot.key]
  const eligible = keywords
    ? family.filter((p) => keywords.some((k) => p.type.toLowerCase().includes(k)))
    : family
  return [...eligible].sort((a, b) => sortName(a.name).localeCompare(sortName(b.name)))
}
