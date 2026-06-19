// ---------------------------------------------------------------------------
// Loadout slot model + the seed loadout (brief Section 4 — the worked example).
// Nothing here is hardcoded into the engine: a Loadout is just slots -> pieces,
// so any user can define their own the same way.
// ---------------------------------------------------------------------------

import type { SlotFamily, SlotKey } from '../types'
import { pieceByName } from './recipes'

export interface LoadoutSlot {
  key: SlotKey
  label: string
  family: SlotFamily
  /** Counts toward whole-loadout totals (Materials, dashboard). Toggleable. */
  tracked: boolean
  /** You're weighing candidates for this slot — surfaces the Compare link. */
  flexible: boolean
  /** Lower = higher priority for the daily dashboard's tracked order. */
  priority: number
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

/** Default numeric priority for a slot with none set: its position in the grid,
 *  so untouched slots get a stable, sensible starting order. */
const defaultPriority = (key: SlotKey): number =>
  Math.max(0, SLOT_ORDER.findIndex((s) => s.key === key))

function slot(
  o: Partial<LoadoutSlot> & { key: SlotKey },
): LoadoutSlot {
  const meta = SLOT_ORDER.find((s) => s.key === o.key)!
  return {
    key: o.key,
    label: o.label ?? meta.label,
    family: o.family ?? meta.family,
    tracked: o.tracked ?? false,
    flexible: o.flexible ?? false,
    priority: o.priority ?? defaultPriority(o.key),
    chosenPieceId: o.chosenPieceId ?? null,
    candidateIds: o.candidateIds ?? [],
  }
}

/**
 * Ensure a loadout has every slot in SLOT_ORDER (backfilling blanks — notably
 * weapon8, absent from the seed) and that each slot carries the current shape.
 * Migrates stale localStorage loadouts forward so the editable UI can rely on
 * all eight weapon slots existing and on `flexible` being a boolean.
 */
export function normalizeLoadout(loadout: Loadout): Loadout {
  const byKey = new Map(loadout.slots.map((s) => [s.key, s]))
  const slots = SLOT_ORDER.map((meta) => {
    const existing = byKey.get(meta.key)
    if (existing) {
      return {
        key: meta.key,
        label: existing.label ?? meta.label,
        family: existing.family ?? meta.family,
        tracked: existing.tracked ?? false,
        flexible: existing.flexible ?? false,
        // Migrate the legacy 'defer' sentinel (and any non-number) to a numeric
        // priority — tracked/untracked now carries what 'defer' used to mean.
        priority:
          typeof existing.priority === 'number'
            ? existing.priority
            : defaultPriority(meta.key),
        chosenPieceId: existing.chosenPieceId ?? null,
        candidateIds: existing.candidateIds ?? [],
      }
    }
    return slot({ key: meta.key })
  })
  return { name: loadout.name, slots }
}

/** The seed loadout from Section 4 — used to build and validate end-to-end. */
export function buildSeedLoadout(): Loadout {
  return {
    name: 'Seed loadout',
    slots: [
      slot({ key: 'helm', tracked: true, priority: 1, chosenPieceId: pid('Obsidian Helm') }),
      slot({ key: 'shoulders', tracked: true, priority: 1, chosenPieceId: pid('Legendary Shoulders (WvW)') }),
      slot({ key: 'gloves', tracked: true, priority: 1, chosenPieceId: pid('Eikasia, Mists-Grasper (Gloves)') }),
      slot({ key: 'boots', tracked: true, priority: 1, chosenPieceId: pid('Obsidian Boots') }),
      slot({ key: 'chest', flexible: true, tracked: true, priority: 5 }),
      slot({ key: 'leggings', flexible: true, tracked: true, priority: 5 }),

      slot({ key: 'weapon1', tracked: true, priority: 1, chosenPieceId: pid('Aetheric Anchor') }),
      slot({ key: 'weapon2', tracked: true, priority: 2, chosenPieceId: pid('Exordium') }),
      slot({ key: 'weapon3', tracked: true, priority: 3, chosenPieceId: pid("Aurene's Fang") }),
      slot({ key: 'weapon4', tracked: true, priority: 4, chosenPieceId: pid("Aurene's Scale") }),
      slot({ key: 'weapon5', tracked: true, priority: 6, chosenPieceId: pid('Incinerator') }),
      slot({ key: 'weapon6', tracked: true, priority: 7, chosenPieceId: pid('Astralaria') }),
      slot({ key: 'weapon7', tracked: true, priority: 8, chosenPieceId: pid('Pharus') }),
      slot({ key: 'weapon8', priority: 10 }), // open 8th weapon slot (untracked)

      slot({ key: 'amulet', flexible: true, tracked: true, priority: 9, candidateIds: [] }),
      slot({ key: 'ring1', flexible: true, tracked: true, priority: 9 }),
      slot({ key: 'ring2', flexible: true, tracked: true, priority: 9 }),
      slot({ key: 'accessory1', flexible: true, tracked: true, priority: 9 }),
      slot({ key: 'accessory2', flexible: true, tracked: true, priority: 9 }),

      slot({ key: 'back', flexible: true, tracked: false, priority: 11 }), // backpack: untracked
      slot({ key: 'relic', tracked: false, priority: 12 }),
      slot({ key: 'runes', tracked: false, priority: 13 }),
      slot({ key: 'aquabreather', tracked: false, priority: 14 }),
    ],
  }
}

/** A fresh, empty loadout for first-time users: every slot blank, nothing chosen
 *  or tracked. Pick pieces on the Loadout tab to start your own plan. */
export function buildEmptyLoadout(): Loadout {
  return normalizeLoadout({ name: 'My loadout', slots: [] })
}
