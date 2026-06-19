// ---------------------------------------------------------------------------
// Full legendary trinket catalog (brief: ALL legendary trinkets).
// Catalog reference: https://wiki.guildwars2.com/wiki/Legendary_trinket
//
// Each trinket is assembled from its wiki TOP-LEVEL Mystic Forge components via
// `assembleLegendary`: the shared Mystic Tribute (77 clovers + 250 Mystic Coin +
// 4 Condensed gifts) expands into its real leaf tree, and the per-trinket
// precursor + collection gifts are leaves carrying their real GW2 item ids
// (resolved from the wiki). Real armory ids let unlocks match the account.
// Prismatic Champion's Regalia (direct achievement reward) and Strife Unending
// (no parseable wiki recipe) are hand-modeled below.
// ---------------------------------------------------------------------------

import type { AcquisitionMode, LegendaryPiece } from '../../types'
import { ITEM, synthetic } from '../items'
import { ref, node, assembleLegendary, type TopComponent } from './_builders'

interface TrinketSpec {
  id: number
  name: string
  type: string // displayed slot label (Accessory / Ring / Amulet)
  acquisitionMode: AcquisitionMode
  wikiUrl: string
  blurb?: string
  components: TopComponent[]
}

// Mystic-Tribute trinkets + the two Visions-of-Eternity gift trinkets, modeled
// exactly as the wiki lists their top-level combine (see snapshot/trinkets.json).
const TRINKET_DATA: TrinketSpec[] = [
  {
    id: 81908,
    name: 'Aurora',
    type: 'Accessory',
    acquisitionMode: 'collection',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurora',
    blurb: 'Living World Season 3 collection. Combine: Spark of Sentience + Mystic Tribute + Gift of Sentience + Gift of Draconic Mastery.',
    components: [
      { name: 'Spark of Sentience', qty: 1, itemId: 81729 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Sentience', qty: 1, itemId: 81796 },
      { name: 'Gift of Draconic Mastery', qty: 1, itemId: 81861 },
    ],
  },
  {
    id: 91048,
    name: 'Vision',
    type: 'Accessory',
    acquisitionMode: 'collection',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Vision',
    blurb: 'Living World Season 4 collection. Combine: Glimpse + Mystic Tribute + Gift of Prescience + Gift of Arid Mastery.',
    components: [
      { name: 'Glimpse', qty: 1, itemId: 91035 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Prescience', qty: 1, itemId: 90985 },
      { name: 'Gift of Arid Mastery', qty: 1, itemId: 91041 },
    ],
  },
  {
    id: 91234,
    name: 'Coalescence',
    type: 'Ring', // wiki-verified: Ring
    acquisitionMode: 'Raid',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Coalescence',
    blurb: 'Raid ring (Sun/Moon variants). Combine: Hateful Sworl + Gift of Patience + Mystic Tribute + Gift of Compassion.',
    components: [
      { name: 'Hateful Sworl', qty: 1, itemId: 86104 },
      { name: 'Gift of Patience', qty: 1, itemId: 91193 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Compassion', qty: 1, itemId: 91225 },
    ],
  },
  {
    id: 92991,
    name: 'Transcendence',
    type: 'Amulet',
    acquisitionMode: 'PvP',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Transcendence',
    blurb: 'PvP legendary amulet. Combine: Gift of the Champion + Mist Pendant + Mystic Tribute + Gift of Skirmishing.',
    components: [
      { name: 'Gift of the Champion', qty: 1, itemId: 93036 },
      { name: 'Mist Pendant', qty: 1, itemId: 79980 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Skirmishing', qty: 1, itemId: 77485 },
    ],
  },
  {
    id: 93105,
    name: 'Conflux',
    type: 'Ring',
    acquisitionMode: 'WvW',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Conflux',
    blurb: 'WvW legendary ring. Combine: Gift of the World + Mist Band (Infused) + Mystic Tribute + Gift of Conquering.',
    components: [
      { name: 'Gift of the World', qty: 1, itemId: 93190 },
      { name: 'Mist Band (Infused)', qty: 1, itemId: 80058 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Conquering', qty: 1, itemId: 81371 },
    ],
  },
  {
    id: 107022,
    name: 'Endless Summer',
    type: 'Ring', // wiki-verified (id 107022)
    acquisitionMode: 'open-world',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Endless_Summer',
    blurb: 'Visions of Eternity ring. Combine: Gift of Rays + Gift of the Survivors + Gift of the People + Gift of the Hylek. (No Mystic Tribute; the clover gate is nested inside Gift of Rays.)',
    components: [
      { name: 'Gift of Rays', qty: 1, itemId: 107040 },
      { name: 'Gift of the Survivors', qty: 1, itemId: 106712 },
      { name: 'Gift of the People', qty: 1, itemId: 105804 },
      { name: 'Gift of the Hylek', qty: 1, itemId: 106986 },
    ],
  },
  {
    id: 109070,
    name: 'Stella Radians',
    type: 'Accessory',
    acquisitionMode: 'open-world',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Stella_Radians',
    blurb: 'Visions of Eternity accessory. Combine: Mystic Tribute + Gift of Galdra + Gift of Shadowstones + Vial of Liquid Shadowstone.',
    components: [
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Galdra', qty: 1, itemId: 109469 },
      { name: 'Gift of Shadowstones', qty: 1, itemId: 109161 },
      { name: 'Vial of Liquid Shadowstone', qty: 1, itemId: 109391 },
    ],
  },
]

// Prismatic Champion's Regalia — a DIRECT achievement reward (no Mystic Forge
// combine). Awarded for completing all 24 Return meta-achievements. No tribute
// or clover gate; modeled as a single collection node.
function prismaticChampionsRegalia(): LegendaryPiece {
  const id = ITEM.prismaticChampionsRegalia // 95380
  const root = ref(id, "Prismatic Champion's Regalia", 1)
  return {
    id,
    name: "Prismatic Champion's Regalia",
    slot: 'trinket',
    type: 'Amulet',
    acquisitionMode: 'collection',
    unlocks: [id],
    blurb:
      'Direct achievement reward — no Mystic Forge combine. Complete all 24 Return meta-achievements (Seasons of the Dragons). No tribute or clover gate.',
    recipe: {
      rootItemId: id,
      nodes: [
        node(root, [], {
          source: 'achievement',
          notes: 'Awarded directly at achievement tier 4; not crafted in the Mystic Forge.',
        }),
      ],
      verified: true,
      wikiUrl: "https://wiki.guildwars2.com/wiki/Prismatic_Champion%27s_Regalia",
      version: 2,
    },
  }
}

// Strife Unending — WvW Mists Research accessory. The wiki page has no parseable
// {{recipe}} (excluded from the gate), so this is a best-effort hand model: the
// dominant gate is 45 Mystic Clovers via 3 Gift of War Prosperity. verified:false.
function strifeUnending(): LegendaryPiece {
  const id = 109012
  const root = ref(id, 'Strife Unending', 1)
  const gift = ref(synthetic(), 'Gift of the Mist Warrior', 1)
  return {
    id,
    name: 'Strife Unending',
    slot: 'trinket',
    type: 'Accessory',
    acquisitionMode: 'WvW',
    unlocks: [id],
    blurb: 'WvW accessory (Mists Research). Mists-gated; the clover gate sits inside the Gift of War Prosperity line.',
    recipe: {
      rootItemId: id,
      nodes: [
        node(root, [gift, ref(ITEM.mysticClover, 'Mystic Clover', 45)], {
          source: 'mystic-forge',
          notes: 'Wiki recipe not machine-parseable; clover count from the Gift of War Prosperity line.',
        }),
        node(gift, [], { source: 'collection', notes: 'Mists Research collection gift' }),
      ],
      verified: false,
      wikiUrl: 'https://wiki.guildwars2.com/wiki/Strife_Unending',
      version: 1,
    },
  }
}

export const TRINKETS: LegendaryPiece[] = [
  ...TRINKET_DATA.map((t) =>
    assembleLegendary({
      id: t.id,
      name: t.name,
      slot: 'trinket',
      type: t.type,
      acquisitionMode: t.acquisitionMode,
      wikiUrl: t.wikiUrl,
      blurb: t.blurb,
      components: t.components,
    })
  ),
  prismaticChampionsRegalia(),
  strifeUnending(),
]
