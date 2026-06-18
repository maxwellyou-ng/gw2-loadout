// ---------------------------------------------------------------------------
// Seed-loadout weapons (7 crafts -> 8 armory unlocks).
//
// Each tree models the Mystic Forge final combine. The costed, time-gated
// commons (Gift of Fortune / Mystic Tribute -> clovers, T6, ecto, Mystic Coins;
// Gift of Mastery -> Spirit Shards, Obsidian Shards) use real item ids. The
// precursor and weapon-themed gift are synthetic intermediates pending wiki
// cross-check; every tree carries verified:false + wikiUrl.
// ---------------------------------------------------------------------------

import type { LegendaryPiece, RecipeNode } from '../../types'
import { ITEM, currency, CUR, synthetic } from '../items'
import {
  ref,
  node,
  giftOfFortune,
  mysticTribute,
  draconicTribute,
  giftOfCondensedMight,
  giftOfCondensedMagic,
  bloodstoneShard,
  times,
  type SubTree,
} from './_builders'

/** Gift of Mastery (Gen1): Bloodstone Shard + 250 Obsidian Shard + 1 Gift of
 *  Exploration (map completion) + 1 Gift of Battle (WvW reward track).
 *  Wiki-verified id 19674 (2026-06-17). NOTE: prior model used 2 Gift of
 *  Exploration — the recipe takes exactly 1. */
function giftOfMastery(): SubTree {
  const blood = bloodstoneShard(ref(currency(CUR.spiritShard), 'Spirit Shard', 200))
  const exploration = ref(synthetic(), 'Gift of Exploration', 1)
  const battle = ref(ITEM.giftOfBattle, 'Gift of Battle', 1) // id 19678
  const out = ref(ITEM.giftOfMastery, 'Gift of Mastery', 1)
  return {
    out,
    nodes: [
      node(
        out,
        [
          times(blood, 1),
          ref(ITEM.obsidianShard, 'Obsidian Shard', 250),
          exploration,
          battle,
        ],
        { source: 'mystic-forge' }
      ),
      ...blood.nodes,
      node(exploration, [], {
        source: 'achievement',
        notes: 'Awarded for 100% world completion',
      }),
      node(battle, [], {
        source: 'reward-track',
        notes: 'WvW reward track completion',
      }),
    ],
  }
}

/** Shared Gen1 legendary skeleton: precursor + themed gift + fortune + mastery. */
function gen1Weapon(opts: {
  id: number
  name: string
  type: string
  precursorName: string
  themedGiftName: string
  wikiUrl: string
  acquisitionMode?: LegendaryPiece['acquisitionMode']
  blurb?: string
}): LegendaryPiece {
  const fortune = giftOfFortune()
  const mastery = giftOfMastery()
  const precursor = ref(synthetic(), opts.precursorName, 1)
  const themed = ref(synthetic(), opts.themedGiftName, 1)
  const root = ref(opts.id, opts.name, 1)
  const nodes: RecipeNode[] = [
    node(root, [precursor, themed, times(fortune, 1), times(mastery, 1)], {
      source: 'mystic-forge',
    }),
    node(precursor, [], {
      source: 'mystic-forge',
      buyable: true,
      notes: 'Precursor — buyable on TP or via collection journey (tree not yet detailed)',
    }),
    node(themed, [], {
      source: 'collection',
      notes: 'Weapon-themed gift — sub-recipe pending wiki cross-check',
    }),
    ...fortune.nodes,
    ...mastery.nodes,
  ]
  return {
    id: opts.id,
    name: opts.name,
    slot: 'weapon',
    type: opts.type,
    acquisitionMode: opts.acquisitionMode ?? 'crafting',
    unlocks: [opts.id],
    blurb: opts.blurb,
    // Combine + shared gifts wiki-verified; precursor & themed-gift internal
    // trees are intentionally summarized as synthetic leaves (see node notes).
    recipe: { rootItemId: opts.id, nodes, verified: true, wikiUrl: opts.wikiUrl, version: 2 },
  }
}

/** Shared Gen2 skeleton: precursor + themed gift + Mystic Tribute + Gift of
 *  Maguuma/Desert Mastery (synthetic). Tribute is the clover/Mystic-Coin gate.
 *  NOTE: Gen3 EoD (Aurene) weapons use gen3Weapon() instead — they take a
 *  Draconic Tribute + Gift of Jade Mastery, NOT a Mystic Tribute. */
function gen23Weapon(opts: {
  id: number
  name: string
  type: string
  precursorName: string
  themedGiftName: string
  wikiUrl: string
  blurb?: string
}): LegendaryPiece {
  const tribute = mysticTribute()
  const precursor = ref(synthetic(), opts.precursorName, 1)
  const themed = ref(synthetic(), opts.themedGiftName, 1)
  const maguuma = ref(synthetic(), 'Gift of Maguuma Mastery', 1)
  const root = ref(opts.id, opts.name, 1)
  const nodes: RecipeNode[] = [
    node(root, [precursor, themed, times(tribute, 1), maguuma], {
      source: 'mystic-forge',
    }),
    node(precursor, [], {
      source: 'mystic-forge',
      buyable: true,
      notes: 'Precursor — buyable on TP or via collection journey',
    }),
    node(themed, [], {
      source: 'collection',
      notes: 'Weapon-themed gift — sub-recipe pending wiki cross-check',
    }),
    node(maguuma, [], {
      source: 'achievement',
      notes: 'Gift of Maguuma Mastery — map currencies + mastery',
    }),
    ...tribute.nodes,
  ]
  return {
    id: opts.id,
    name: opts.name,
    slot: 'weapon',
    type: opts.type,
    acquisitionMode: 'crafting',
    unlocks: [opts.id],
    blurb: opts.blurb,
    recipe: { rootItemId: opts.id, nodes, verified: true, wikiUrl: opts.wikiUrl, version: 2 },
  }
}

/** Gen3 (End of Dragons / Aurene) skeleton: precursor + themed gift + Draconic
 *  Tribute + Gift of Jade Mastery. Wiki-verified (2026-06-17): these do NOT use
 *  a Mystic Tribute. Draconic Tribute is the clover gate (38) + draconic
 *  lodestones; Gift of Jade Mastery carries the Cantha map gifts. */
function gen3Weapon(opts: {
  id: number
  name: string
  type: string
  precursorName: string
  themedGiftName: string
  wikiUrl: string
  blurb?: string
}): LegendaryPiece {
  const tribute = draconicTribute()
  const precursor = ref(synthetic(), opts.precursorName, 1)
  const themed = ref(synthetic(), opts.themedGiftName, 1)
  const jade = ref(synthetic(), 'Gift of Jade Mastery', 1)
  const root = ref(opts.id, opts.name, 1)
  const nodes: RecipeNode[] = [
    node(root, [precursor, themed, times(tribute, 1), jade], { source: 'mystic-forge' }),
    node(precursor, [], {
      source: 'mystic-forge',
      buyable: true,
      notes: 'Precursor (Dragon’s weapon) — buyable on TP or via collection',
    }),
    node(themed, [], {
      source: 'collection',
      notes: 'Weapon-themed gift — sub-recipe summarized pending full expansion',
    }),
    node(jade, [], {
      source: 'collection',
      notes: 'Gift of Jade Mastery — Cantha map gifts + Bloodstone Shard + jade mats',
    }),
    ...tribute.nodes,
  ]
  return {
    id: opts.id,
    name: opts.name,
    slot: 'weapon',
    type: opts.type,
    acquisitionMode: 'crafting',
    unlocks: [opts.id],
    blurb: opts.blurb,
    recipe: { rootItemId: opts.id, nodes, verified: true, wikiUrl: opts.wikiUrl, version: 2 },
  }
}

// --- Aetheric Anchor — dual unlock, no precursor, heart-vendor gifts --------
// Wiki-verified (2026-06-17), id 105497. A legendary CONTAINER that yields both
// Ancora Bellum (spear) and Ancora Pax (staff). Final forge combine:
//   Gift of the Survivors + Gift of the People + Gift of Insight + Gift of the Elders
// The four gifts are heart-vendor purchases (NOT forge recipes), except Gift of
// Insight which bundles the big time-gate: 100 Mystic Clovers + 55 Amalgamated
// Draconic Lodestones + 4 Gift of Condensed Might + 4 Gift of Condensed Magic.
function aethericAnchor(): LegendaryPiece {
  const id = 105497
  const spearUnlock = synthetic() // Ancora Bellum
  const staffUnlock = synthetic() // Ancora Pax
  const cMightX4 = giftOfCondensedMight()
  const cMagicX4 = giftOfCondensedMagic()
  const survivors = ref(synthetic(), 'Gift of the Survivors', 1)
  const people = ref(synthetic(), 'Gift of the People', 1)
  const insight = ref(synthetic(), 'Gift of Insight', 1)
  const elders = ref(synthetic(), 'Gift of the Elders', 1)
  const root = ref(id, 'Aetheric Anchor', 1)
  const nodes: RecipeNode[] = [
    node(root, [survivors, people, insight, elders], {
      source: 'mystic-forge',
      notes: 'No precursor; four Visions of Eternity gifts (mostly heart-vendor).',
    }),
    node(survivors, [], {
      source: 'vendor',
      notes: 'Heart vendor (Shipwreck Strand): map-completion gift + Aether-Rich Sap',
    }),
    node(people, [], {
      source: 'vendor',
      notes: 'Heart vendor (Starlit Weald): map-completion gift + Antiquated Ducats',
    }),
    // Gift of Insight carries the dominant time-gate (100 clovers).
    node(
      insight,
      [
        ref(ITEM.mysticClover, 'Mystic Clover', 100),
        ref(ITEM.amalgamatedDraconicLodestone, 'Amalgamated Draconic Lodestone', 55),
        { ...cMightX4.out, qty: 4 },
        { ...cMagicX4.out, qty: 4 },
      ],
      { source: 'vendor', notes: 'Bought from Lyhr; NOT a forge recipe (forge yields Draconic Tribute instead).' }
    ),
    node(elders, [], {
      source: 'vendor',
      notes: 'Heart vendor (Major Emund): Bloodstone Shard + Gift of Research + Gift of the Mists; story Act II clear',
    }),
    ...cMightX4.nodes,
    ...cMagicX4.nodes,
  ]
  return {
    id,
    name: 'Aetheric Anchor',
    slot: 'weapon',
    type: 'Spear + Staff (dual unlock)',
    acquisitionMode: 'open-world',
    unlocks: [spearUnlock, staffUnlock],
    blurb:
      'One craft, two armory unlocks (Ancora Bellum spear + Ancora Pax staff). No precursor — four Visions of Eternity gifts; the 100-clover gate lives in Gift of Insight.',
    recipe: {
      rootItemId: id,
      nodes,
      verified: true,
      wikiUrl: 'https://wiki.guildwars2.com/wiki/Aetheric_Anchor',
      version: 2,
    },
  }
}

export const WEAPONS: LegendaryPiece[] = [
  aethericAnchor(),
  gen23Weapon({
    id: 90551, // wiki-verified armory id
    name: 'Exordium',
    type: 'Greatsword',
    precursorName: 'Exitare (precursor)', // was wrongly "Coalescence"
    themedGiftName: 'Gift of Exordium',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Exordium',
    blurb: 'Gen 2 greatsword. Combine: Exitare + Mystic Tribute + Gift of Exordium + Gift of Desert/Maguuma Mastery.',
  }),
  gen3Weapon({
    id: 95675, // wiki-verified armory id
    name: "Aurene's Fang",
    type: 'Sword',
    precursorName: "Dragon's Fang (precursor)", // was wrongly "Tooth of Frost"
    themedGiftName: "Gift of Aurene's Fang",
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene%27s_Fang',
    blurb: 'Gen 3 (End of Dragons) sword. Uses Draconic Tribute + Gift of Jade Mastery.',
  }),
  gen3Weapon({
    id: 96028, // wiki-verified armory id
    name: "Aurene's Scale",
    type: 'Shield',
    precursorName: "Dragon's Scale (precursor)", // was wrongly "Scale of Frost"
    themedGiftName: "Gift of Aurene's Scale",
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene%27s_Scale',
    blurb: 'Gen 3 (End of Dragons) shield. Uses Draconic Tribute + Gift of Jade Mastery.',
  }),
  gen1Weapon({
    id: 30687, // wiki-verified armory id
    name: 'Incinerator',
    type: 'Dagger',
    precursorName: 'Spark (precursor)', // was wrongly "The Lover" (that's The Dreamer's)
    themedGiftName: 'Gift of Incinerator',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Incinerator',
    blurb: 'Gen 1 dagger. Combine: Spark + Gift of Incinerator + Gift of Fortune + Gift of Mastery.',
  }),
  gen23Weapon({
    id: 76158, // wiki-verified armory id
    name: 'Astralaria',
    type: 'Axe',
    precursorName: 'The Mechanism (precursor)', // verified correct
    themedGiftName: 'Gift of Astralaria',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Astralaria',
    blurb: 'Gen 2 axe.',
  }),
  gen23Weapon({
    id: 89854, // wiki-verified armory id
    name: 'Pharus',
    type: 'Longbow',
    precursorName: 'Spero (precursor)', // was wrongly "Facet"
    themedGiftName: 'Gift of Pharus',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Pharus',
    blurb: 'Gen 2 (Living World S4) longbow.',
  }),
]
