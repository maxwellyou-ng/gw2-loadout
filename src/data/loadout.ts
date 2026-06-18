// ---------------------------------------------------------------------------
// Loadout slot model + the seed loadout (brief Section 4 — the worked example).
// Nothing here is hardcoded into the engine: a Loadout is just slots -> pieces,
// so any user can define their own the same way.
// ---------------------------------------------------------------------------

import type { SlotFamily, SlotKey } from '../types'
import { pieceByName } from './recipes'

export type SlotStatus = 'must-have' | 'flexible' | 'done' | 'not-pursuing'

export interface LoadoutSlot {
  key: SlotKey
  label: string
  family: SlotFamily
  status: SlotStatus
  tracked: boolean
  /** Lower = higher priority for the daily dashboard. 'defer' = lowest. */
  priority: number | 'defer'
  /** Chosen legendary piece id, or null if undecided. */
  chosenPieceId: number | null
  /** Flexible slots: candidate piece ids being weighed. */
  candidateIds: number[]
}

export interface Loadout {
  name: string
  slots: LoadoutSlot[]
}

/** Display order for the slot grid. */
export const SLOT_ORDER: { key: SlotKey; label: string; family: SlotFamily }[] = [
  { key: 'helm', label: 'Helm', family: 'armor' },
  { key: 'shoulders', label: 'Shoulders', family: 'armor' },
  { key: 'chest', label: 'Chest', family: 'armor' },
  { key: 'gloves', label: 'Gloves', family: 'armor' },
  { key: 'leggings', label: 'Leggings', family: 'armor' },
  { key: 'boots', label: 'Boots', family: 'armor' },
  { key: 'weapon1', label: 'Weapon 1', family: 'weapon' },
  { key: 'weapon2', label: 'Weapon 2', family: 'weapon' },
  { key: 'weapon3', label: 'Weapon 3', family: 'weapon' },
  { key: 'weapon4', label: 'Weapon 4', family: 'weapon' },
  { key: 'weapon5', label: 'Weapon 5', family: 'weapon' },
  { key: 'weapon6', label: 'Weapon 6', family: 'weapon' },
  { key: 'weapon7', label: 'Weapon 7', family: 'weapon' },
  { key: 'weapon8', label: 'Weapon 8', family: 'weapon' },
  { key: 'amulet', label: 'Amulet', family: 'trinket' },
  { key: 'ring1', label: 'Ring 1', family: 'trinket' },
  { key: 'ring2', label: 'Ring 2', family: 'trinket' },
  { key: 'accessory1', label: 'Accessory 1', family: 'trinket' },
  { key: 'accessory2', label: 'Accessory 2', family: 'trinket' },
  { key: 'back', label: 'Back', family: 'back' },
  { key: 'relic', label: 'Relic', family: 'misc' },
  { key: 'runes', label: 'Runes', family: 'misc' },
  { key: 'aquabreather', label: 'Aquabreather', family: 'misc' },
]

const pid = (name: string): number | null => pieceByName(name)?.id ?? null

function slot(
  o: Partial<LoadoutSlot> & { key: SlotKey },
): LoadoutSlot {
  const meta = SLOT_ORDER.find((s) => s.key === o.key)!
  return {
    key: o.key,
    label: o.label ?? meta.label,
    family: o.family ?? meta.family,
    status: o.status ?? 'not-pursuing',
    tracked: o.tracked ?? false,
    priority: o.priority ?? 'defer',
    chosenPieceId: o.chosenPieceId ?? null,
    candidateIds: o.candidateIds ?? [],
  }
}

/** The seed loadout from Section 4 — used to build and validate end-to-end. */
export function buildSeedLoadout(): Loadout {
  return {
    name: 'Seed loadout',
    slots: [
      slot({ key: 'helm', status: 'must-have', tracked: true, priority: 1, chosenPieceId: pid('Obsidian Helm') }),
      slot({ key: 'shoulders', status: 'must-have', tracked: true, priority: 1, chosenPieceId: pid('Legendary Shoulders (WvW)') }),
      slot({ key: 'gloves', status: 'must-have', tracked: true, priority: 1, chosenPieceId: pid('Eikasia Greaves (Mists-Grasper)') }),
      slot({ key: 'boots', status: 'must-have', tracked: true, priority: 1, chosenPieceId: pid('Obsidian Boots') }),
      slot({ key: 'chest', status: 'flexible', tracked: true, priority: 5 }),
      slot({ key: 'leggings', status: 'flexible', tracked: true, priority: 5 }),

      slot({ key: 'weapon1', label: 'Aetheric Anchor', status: 'must-have', tracked: true, priority: 1, chosenPieceId: pid('Aetheric Anchor') }),
      slot({ key: 'weapon2', label: 'Exordium', status: 'must-have', tracked: true, priority: 2, chosenPieceId: pid('Exordium') }),
      slot({ key: 'weapon3', label: "Aurene's Fang", status: 'must-have', tracked: true, priority: 3, chosenPieceId: pid("Aurene's Fang") }),
      slot({ key: 'weapon4', label: "Aurene's Scale", status: 'must-have', tracked: true, priority: 4, chosenPieceId: pid("Aurene's Scale") }),
      slot({ key: 'weapon5', label: 'Incinerator', status: 'must-have', tracked: true, priority: 6, chosenPieceId: pid('Incinerator') }),
      slot({ key: 'weapon6', label: 'Astralaria', status: 'must-have', tracked: true, priority: 7, chosenPieceId: pid('Astralaria') }),
      slot({ key: 'weapon7', label: 'Pharus', status: 'must-have', tracked: true, priority: 8, chosenPieceId: pid('Pharus') }),
      // weapon8 is the second Aetheric Anchor unlock (handled via that piece's two unlocks).

      slot({ key: 'amulet', status: 'flexible', tracked: true, priority: 9, candidateIds: [] }),
      slot({ key: 'ring1', status: 'flexible', tracked: true, priority: 9 }),
      slot({ key: 'ring2', status: 'flexible', tracked: true, priority: 9 }),
      slot({ key: 'accessory1', status: 'flexible', tracked: true, priority: 9 }),
      slot({ key: 'accessory2', status: 'flexible', tracked: true, priority: 9 }),

      slot({ key: 'back', status: 'flexible', tracked: false, priority: 'defer' }), // backpack: defer
      slot({ key: 'relic', status: 'not-pursuing', tracked: false, priority: 'defer' }),
      slot({ key: 'runes', status: 'not-pursuing', tracked: false, priority: 'defer' }),
      slot({ key: 'aquabreather', status: 'not-pursuing', tracked: false, priority: 'defer' }),
    ],
  }
}
