// ---------------------------------------------------------------------------
// Full legendary back-item catalog (brief: ALL legendary back items).
// Catalog reference: https://wiki.guildwars2.com/wiki/Legendary_back_item
//
// Each back item is assembled from its wiki TOP-LEVEL combine via
// `assembleLegendary`: the shared Gift of Fortune (77 clovers + 250 ecto + Gift
// of Might/Magic) expands into its real leaf tree, and the per-item precursor +
// collection gifts are leaves with their real GW2 item ids. Orrax Manifested has
// no Gift of Fortune at top level (its clover/draconic gate is nested inside
// Orrax Contained), so all four components are leaves — matching the wiki.
// ---------------------------------------------------------------------------

import type { AcquisitionMode, LegendaryPiece } from '../../types'
import { assembleLegendary, type TopComponent } from './_builders'

interface BackSpec {
  id: number
  name: string
  acquisitionMode: AcquisitionMode
  wikiUrl: string
  blurb?: string
  components: TopComponent[]
}

const BACK_DATA: BackSpec[] = [
  {
    id: 74155,
    name: 'Ad Infinitum',
    acquisitionMode: 'Fractal',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Ad_Infinitum',
    blurb: 'Fractals. Combine: Unbound + Gift of Infinity + Gift of Fortune + Gift of Ascension.',
    components: [
      { name: 'Unbound', qty: 1, itemId: 72309 },
      { name: 'Gift of Infinity', qty: 1, itemId: 74377 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Ascension', qty: 1, itemId: 37070 },
    ],
  },
  {
    id: 77474,
    name: 'The Ascension',
    acquisitionMode: 'PvP',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Ascension',
    blurb: 'PvP League. Combine: Gift of the Competitor + Gift of Skirmishing + Gift of Fortune + Wings of Ascension.',
    components: [
      { name: 'Gift of the Competitor', qty: 1, itemId: 77509 },
      { name: 'Gift of Skirmishing', qty: 1, itemId: 77485 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Wings of Ascension', qty: 1, itemId: 77536 },
    ],
  },
  {
    id: 81462,
    name: 'Warbringer',
    acquisitionMode: 'WvW',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Warbringer',
    blurb: 'WvW. Combine: Warcry + Gift of Warfare + Gift of Fortune + Gift of Conquering.',
    components: [
      { name: 'Warcry', qty: 1, itemId: 81467 },
      { name: 'Gift of Warfare', qty: 1, itemId: 81478 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Conquering', qty: 1, itemId: 81371 },
    ],
  },
  {
    id: 104857,
    name: 'Orrax Manifested',
    acquisitionMode: 'open-world', // Janthir Wilds
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Orrax_Manifested',
    blurb: 'Janthir Wilds back item. Combine: Gift of the Mistburned Isles + Gift of Shadows + Gift of the Feast + Orrax Contained (the Draconic Tribute / clover gate is nested inside Orrax Contained).',
    components: [
      { name: 'Gift of the Mistburned Isles', qty: 1, itemId: 104962 },
      { name: 'Gift of Shadows', qty: 1, itemId: 104846 },
      { name: 'Gift of the Feast', qty: 1, itemId: 104872 },
      { name: 'Orrax Contained', qty: 1, itemId: 104690 },
    ],
  },
]

export const BACKS: LegendaryPiece[] = BACK_DATA.map((b) =>
  assembleLegendary({
    id: b.id,
    name: b.name,
    slot: 'back',
    type: 'Back',
    acquisitionMode: b.acquisitionMode,
    wikiUrl: b.wikiUrl,
    blurb: b.blurb,
    components: b.components,
  })
)
