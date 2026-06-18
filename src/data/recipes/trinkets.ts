// ---------------------------------------------------------------------------
// Full legendary trinket catalog (brief: ALL legendary trinkets).
// Catalog reference: https://wiki.guildwars2.com/wiki/Legendary_trinket
//
// Trinkets are overwhelmingly collection / game-mode gated and account-bound.
// We model each with its dominant gate (achievement/collection) plus the
// Mystic Clover time-gate most of them share, so the engine has real time-gate
// signal. Exact recipe trees and slot assignments are verified:false pending
// wiki cross-check (slot labels especially — see notes).
// ---------------------------------------------------------------------------

import type { AcquisitionMode, LegendaryPiece, RecipeNode, SlotFamily } from '../../types'
import { ITEM, synthetic } from '../items'
import { ref, node, mysticTribute, times } from './_builders'

interface CatalogSpec {
  name: string
  type: string // displayed slot label
  acquisitionMode: AcquisitionMode
  wikiUrl: string
  blurb?: string
  /**
   * True when the recipe consumes a full Mystic Tribute (77 Mystic Clover +
   * 250 Mystic Coin + 4 Condensed gifts). Wiki-verified on the Mystic Tribute
   * page (2026-06-17): Aurora, Vision, Coalescence, Conflux, Transcendence,
   * Stella Radians all do. This is a MUCH bigger gate than the old flat
   * `clovers` estimate (~30) — it drives the real time-gate math.
   */
  tribute?: boolean
  /** Flat Mystic Clovers when not a full Mystic Tribute (0 if none / unknown). */
  clovers?: number
  /** When true the piece is wiki-verified; otherwise it ships verified:false. */
  verified?: boolean
  notes?: string
}

function trinket(spec: CatalogSpec): LegendaryPiece {
  const id = synthetic()
  const primaryGift = ref(synthetic(), `Gift of ${spec.name}`, 1)
  const root = ref(id, spec.name, 1)
  const inputs = [primaryGift]
  const extraNodes: RecipeNode[] = []
  if (spec.tribute) {
    const t = mysticTribute()
    inputs.push(times(t, 1))
    extraNodes.push(...t.nodes)
  } else if (spec.clovers) {
    inputs.push(ref(ITEM.mysticClover, 'Mystic Clover', spec.clovers))
  }
  const nodes: RecipeNode[] = [
    node(root, inputs, {
      source: 'mystic-forge',
      notes: spec.notes ?? 'Collection-gated; precursor/themed-gift trees summarized',
    }),
    node(primaryGift, [], {
      source: 'collection',
      notes: 'Collection / achievement gift',
    }),
    ...extraNodes,
  ]
  const slot: SlotFamily = 'trinket'
  return {
    id,
    name: spec.name,
    slot,
    type: spec.type,
    acquisitionMode: spec.acquisitionMode,
    unlocks: [id],
    blurb: spec.blurb,
    recipe: { rootItemId: id, nodes, verified: spec.verified ?? false, wikiUrl: spec.wikiUrl, version: spec.verified ? 2 : 1 },
  }
}

export const TRINKETS: LegendaryPiece[] = [
  trinket({
    name: 'Aurora',
    type: 'Accessory',
    acquisitionMode: 'collection',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurora',
    blurb: 'Living World Season 3 collection. Combine: Spark of Sentience + Mystic Tribute + Gift of Sentience + Gift of Draconic Mastery.',
    tribute: true,
    verified: true,
  }),
  trinket({
    name: 'Vision',
    type: 'Accessory',
    acquisitionMode: 'collection',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Vision',
    blurb: 'Living World Season 4 collection. Combine: Glimpse + Mystic Tribute + Gift of Prescience + Gift of Arid Mastery.',
    tribute: true,
    verified: true,
  }),
  trinket({
    name: 'Coalescence',
    type: 'Ring', // wiki-verified: Ring, NOT Amulet (catalog page)
    acquisitionMode: 'Raid',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Coalescence',
    blurb: 'Raid ring (Sun/Moon variants). Combine: Hateful Sworl + Gift of Patience + Mystic Tribute + Gift of Compassion.',
    tribute: true,
    verified: true,
  }),
  trinket({
    name: 'Transcendence',
    type: 'Amulet',
    acquisitionMode: 'PvP',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Transcendence',
    blurb: 'PvP legendary amulet. Combine: Gift of the Champion + Mist Pendant + Mystic Tribute + Gift of Skirmishing.',
    tribute: true,
    verified: true,
  }),
  trinket({
    name: 'Conflux',
    type: 'Ring',
    acquisitionMode: 'WvW',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Conflux',
    blurb: 'WvW legendary ring. Combine: Gift of the World + Mist Band (Infused) + Mystic Tribute + Gift of Conquering.',
    tribute: true,
    verified: true,
  }),
  trinket({
    name: "Prismatic Champion's Regalia",
    type: 'Amulet', // wiki-verified: Amulet, acquired via Current Events
    acquisitionMode: 'collection',
    wikiUrl: "https://wiki.guildwars2.com/wiki/Prismatic_Champion%27s_Regalia",
    blurb: 'Amulet from a Current Events meta-collection.',
  }),
  trinket({
    name: 'Endless Summer',
    type: 'Ring', // wiki-verified (id 107022)
    acquisitionMode: 'open-world',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Endless_Summer',
    blurb: 'Visions of Eternity ring (Radiance of the Sun God). Combine: Gift of Rays + Gift of the Survivors + Gift of the People + Gift of the Hylek.',
    clovers: 10, // 10 Mystic Clovers (inside Gift of Rays); uses 2x Condensed Might/Magic, not a full Tribute
    verified: true,
  }),
  trinket({
    name: 'Stella Radians',
    type: 'Accessory',
    acquisitionMode: 'open-world',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Stella_Radians',
    blurb: 'Visions of Eternity-era trinket. Combine uses Mystic Tribute + Gift of Galdra + Gift of Shadowstones.',
    tribute: true,
    verified: true,
  }),
  trinket({
    name: 'Strife Unending',
    type: 'Accessory', // wiki-verified (id 109012)
    acquisitionMode: 'WvW',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Strife_Unending',
    blurb: 'WvW accessory (Mists Research). Combine: Gift of the Mist Warrior + Gift of the Mistwalker + 2 Gift of the Mists + Gift of the Warclaw.',
    clovers: 45, // 45 Mystic Clovers via 3x Gift of War Prosperity (not a Mystic Tribute)
    verified: true,
  }),
]
