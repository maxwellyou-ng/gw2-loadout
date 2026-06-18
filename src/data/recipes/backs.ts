// ---------------------------------------------------------------------------
// Full legendary back-item catalog (brief: ALL legendary back items).
// Catalog reference: https://wiki.guildwars2.com/wiki/Legendary_back_item
// Modeled like trinkets: dominant game-mode gate + shared clover gate where
// applicable. verified:false pending wiki cross-check.
// ---------------------------------------------------------------------------

import type { AcquisitionMode, LegendaryPiece, RecipeNode } from '../../types'
import { ITEM, synthetic } from '../items'
import { ref, node, giftOfFortune, draconicTribute, times } from './_builders'

interface BackSpec {
  name: string
  acquisitionMode: AcquisitionMode
  wikiUrl: string
  blurb?: string
  /**
   * True when the combine consumes a Gift of Fortune (77 Mystic Clover + 250
   * Ecto + Gift of Might + Gift of Magic). Wiki-verified on the Gift of Fortune
   * page (2026-06-17): Ad Infinitum, The Ascension and Warbringer all do.
   */
  fortune?: boolean
  /** True when the combine consumes a Draconic Tribute (e.g. Orrax Manifested). */
  draconic?: boolean
  clovers?: number
  verified?: boolean
  notes?: string
}

function backItem(spec: BackSpec): LegendaryPiece {
  const id = synthetic()
  const gift = ref(synthetic(), `Gift of ${spec.name}`, 1)
  const root = ref(id, spec.name, 1)
  const inputs = [gift]
  const extraNodes: RecipeNode[] = []
  if (spec.fortune) {
    const f = giftOfFortune()
    inputs.push(times(f, 1))
    extraNodes.push(...f.nodes)
  }
  if (spec.draconic) {
    const d = draconicTribute()
    inputs.push(times(d, 1))
    extraNodes.push(...d.nodes)
  }
  if (spec.clovers) {
    inputs.push(ref(ITEM.mysticClover, 'Mystic Clover', spec.clovers))
  }
  const nodes: RecipeNode[] = [
    node(root, inputs, {
      source: 'mystic-forge',
      notes: spec.notes ?? 'Collection-gated; themed-gift tree summarized',
    }),
    node(gift, [], { source: 'collection', notes: 'Collection / achievement gift' }),
    ...extraNodes,
  ]
  return {
    id,
    name: spec.name,
    slot: 'back',
    type: 'Back',
    acquisitionMode: spec.acquisitionMode,
    unlocks: [id],
    blurb: spec.blurb,
    recipe: { rootItemId: id, nodes, verified: spec.verified ?? false, wikiUrl: spec.wikiUrl, version: spec.verified ? 2 : 1 },
  }
}

export const BACKS: LegendaryPiece[] = [
  backItem({
    name: 'Ad Infinitum',
    acquisitionMode: 'Fractal',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Ad_Infinitum',
    blurb: 'Fractals. Combine: Unbound + Gift of Infinity + Gift of Fortune + Gift of Ascension.',
    fortune: true,
    verified: true,
  }),
  backItem({
    name: 'The Ascension',
    acquisitionMode: 'PvP',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Ascension',
    blurb: 'PvP League. Combine: Gift of the Competitor + Gift of Skirmishing + Gift of Fortune + Wings of Ascension.',
    fortune: true,
    verified: true,
  }),
  backItem({
    name: 'Warbringer',
    acquisitionMode: 'WvW',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Warbringer',
    blurb: 'WvW. Combine: Warcry + Gift of Warfare + Gift of Fortune + Gift of Conquering.',
    fortune: true,
    verified: true,
  }),
  backItem({
    name: 'Orrax Manifested',
    acquisitionMode: 'open-world', // Janthir Wilds (id 104857)
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Orrax_Manifested',
    blurb: 'Janthir Wilds back item. Combine: Gift of the Mistburned Isles + Gift of Shadows + Gift of the Feast + Orrax Contained (uses a Draconic Tribute).',
    draconic: true, // Draconic Tribute (38 clovers) sits inside the Orrax Contained precursor
    clovers: 30, // +30 Mystic Clovers from Gift of the Side Course
    verified: true,
  }),
]
