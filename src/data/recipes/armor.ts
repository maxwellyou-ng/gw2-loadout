// ---------------------------------------------------------------------------
// Full legendary armor catalog. GW2 has four legendary armor lines, each giving
// all six weight-shared armory slots, plus the Fractal gloves (Eikasia) and the
// legendary aquabreather (Selachimorpha):
//   - Obsidian (PvE / SotO):     craft in the Wizard's Tower; 9-clover Prosperity
//   - Triumphant Hero's (WvW):   ascended base + War Prosperity/Prowess/Dedication
//   - Perfected Envoy (Raid):    Refined Envoy base + Prosperity/Prowess/Dedication
//   - Ardent Glorious (PvP):     ascended base + Competitive Prosperity/Prowess/Dedication
// Every line's three game-mode gifts are wiki-verified (2026-06-19); each
// Prosperity gift carries the dominant 15-clover (9 for Obsidian) time-gate, so
// a full set is the real driver of clover demand. Piece ids are synthetic
// (armor sets expose no per-piece API id on the wiki list); the shared gift ids
// are real, so clover/obsidian/ecto demand sums correctly across a set.
// ---------------------------------------------------------------------------

import type { LegendaryPiece, RecipeNode, SlotFamily } from '../../types'
import { ITEM, synthetic, currency, CUR } from '../items'
import { ref, node, giftOfCondensedMight, giftOfCondensedMagic, type SubTree } from './_builders'

/** The six weight-shared armor slots, with a type label the slot picker matches. */
const ARMOR_SLOTS = [
  { key: 'helm', label: 'Helm', might: false },
  { key: 'shoulders', label: 'Shoulders', might: false },
  { key: 'chest', label: 'Chest', might: false },
  { key: 'gloves', label: 'Gloves', might: true },
  { key: 'leggings', label: 'Leggings', might: true },
  { key: 'boots', label: 'Boots', might: true },
] as const

// --- Shared leaf builders ---------------------------------------------------

const eldritchScrollNode = (): RecipeNode =>
  node(ref(ITEM.eldritchScroll, 'Eldritch Scroll', 1), [ref(currency(CUR.spiritShard), 'Spirit Shard', 50)], {
    source: 'vendor',
    notes: 'Miyani / Mystic Forge Attendant: 50 Spirit Shards',
  })

/** Prowess-line gift (Raid / PvP / WvW share the structure: insight token +
 *  Eldritch Scroll + 50 Obsidian Shard + Cube of Stabilized Dark Energy). */
function prowessGift(id: number, name: string, insight: { id: number; name: string; qty: number }): SubTree {
  const out = ref(id, name, 1)
  return {
    out,
    nodes: [
      node(
        out,
        [
          ref(insight.id, insight.name, insight.qty),
          ref(ITEM.eldritchScroll, 'Eldritch Scroll', 1),
          ref(ITEM.obsidianShard, 'Obsidian Shard', 50),
          ref(ITEM.cubeOfStabilizedDarkEnergy, 'Cube of Stabilized Dark Energy', 1),
        ],
        { source: 'mystic-forge' }
      ),
      eldritchScrollNode(),
    ],
  }
}

/** Prosperity-line gift (15 Mystic Clover + a mode token + Condensed Might/Magic).
 *  This is where each line's dominant clover gate lives. */
function prosperityGift(id: number, name: string, modeToken: ItemRefLike): SubTree {
  const cMight = giftOfCondensedMight()
  const cMagic = giftOfCondensedMagic()
  const out = ref(id, name, 1)
  return {
    out,
    nodes: [
      node(
        out,
        [ref(modeToken.id, modeToken.name, modeToken.qty ?? 1), ref(ITEM.mysticClover, 'Mystic Clover', 15), cMight.out, cMagic.out],
        { source: 'mystic-forge', notes: '15-Mystic-Clover time-gate' }
      ),
      ...cMight.nodes,
      ...cMagic.nodes,
    ],
  }
}

interface ItemRefLike {
  id: number
  name: string
  qty?: number
}

interface ArmorLine {
  set: string
  mode: LegendaryPiece['acquisitionMode']
  wikiUrl: string
  /** Ascended/precursor base piece name template, given the slot label. */
  baseName: (slot: string) => string
  prosperity: () => SubTree
  prowess: () => SubTree
  dedication: () => SubTree
}

/** Build all six legendary pieces for a game-mode armor line that combines an
 *  ascended base with three mode gifts (Triumphant / Envoy / Ardent Glorious). */
function gameModeArmorLine(line: ArmorLine): LegendaryPiece[] {
  return ARMOR_SLOTS.map((slot) => {
    const id = synthetic()
    const prosperity = line.prosperity()
    const prowess = line.prowess()
    const dedication = line.dedication()
    const base = ref(synthetic(), line.baseName(slot.label), 1)
    const root = ref(id, `${line.set} ${slot.label}`, 1)
    const nodes: RecipeNode[] = [
      node(root, [base, prosperity.out, prowess.out, dedication.out], {
        source: 'mystic-forge',
        notes: 'Ascended base piece upgraded to legendary with the three mode gifts.',
      }),
      node(base, [], { source: 'craft', notes: 'Ascended base piece (craft or game-mode reward track)' }),
      ...prosperity.nodes,
      ...prowess.nodes,
      ...dedication.nodes,
    ]
    return {
      id,
      name: `${line.set} ${slot.label}`,
      slot: 'armor' as SlotFamily,
      type: slot.label,
      acquisitionMode: line.mode,
      unlocks: [id],
      blurb: `${line.set} legendary armor (${slot.label}). 15-clover gate in the Prosperity gift.`,
      recipe: { rootItemId: id, nodes, verified: true, wikiUrl: line.wikiUrl, version: 2 },
    }
  })
}

// --- Triumphant Hero's (WvW) ------------------------------------------------
const triumphant = gameModeArmorLine({
  set: "Triumphant Hero's",
  mode: 'WvW',
  wikiUrl: "https://wiki.guildwars2.com/wiki/Triumphant_Hero%27s_armor",
  baseName: (s) => `Ascended Triumphant Hero's ${s} (base)`,
  prosperity: () => prosperityGift(ITEM.giftOfWarProsperity, 'Gift of War Prosperity', { id: ITEM.giftOfBattle, name: 'Gift of Battle' }),
  prowess: () => prowessGift(ITEM.giftOfWarProwess, 'Gift of War Prowess', { id: ITEM.legendaryWarInsight, name: 'Legendary War Insight', qty: 1 }),
  dedication: () => {
    const out = ref(ITEM.giftOfWarDedication, 'Gift of War Dedication', 1)
    return {
      out,
      nodes: [
        node(
          out,
          [
            ref(ITEM.certificateOfHonor, 'Certificate of Honor', 1),
            ref(ITEM.certificateOfHeroics, 'Certificate of Heroics', 1),
            ref(ITEM.globOfCondensedSpiritEnergy, 'Glob of Condensed Spirit Energy', 1),
            ref(ITEM.memoryOfBattle, 'Memory of Battle', 250),
          ],
          { source: 'mystic-forge', notes: 'WvW Skirmish-ticket gifts + 250 Memory of Battle' }
        ),
      ],
    }
  },
})

// --- Perfected Envoy (Raid) -------------------------------------------------
const envoy = gameModeArmorLine({
  set: 'Perfected Envoy',
  mode: 'Raid',
  wikiUrl: 'https://wiki.guildwars2.com/wiki/Perfected_Envoy_armor',
  baseName: (s) => `Refined Envoy ${s}`,
  prosperity: () => prosperityGift(ITEM.giftOfProsperity, 'Gift of Prosperity', { id: ITEM.giftOfCraftsmanship, name: 'Gift of Craftsmanship' }),
  prowess: () => prowessGift(ITEM.giftOfProwess, 'Gift of Prowess', { id: currency(CUR.legendaryInsight), name: 'Legendary Insight', qty: 25 }),
  dedication: () => {
    const out = ref(ITEM.giftOfDedication, 'Gift of Dedication', 1)
    return {
      out,
      nodes: [
        node(
          out,
          [
            ref(ITEM.chakEgg, 'Chak Egg', 5),
            ref(ITEM.auricIngot, 'Auric Ingot', 5),
            ref(ITEM.reclaimedMetalPlate, 'Reclaimed Metal Plate', 5),
            ref(ITEM.giftOfThePact, 'Gift of the Pact', 1),
          ],
          { source: 'mystic-forge', notes: 'Heart of Thorns map mats + Gift of the Pact' }
        ),
      ],
    }
  },
})

// --- Ardent Glorious (PvP) --------------------------------------------------
const ardent = gameModeArmorLine({
  set: 'Ardent Glorious',
  mode: 'PvP',
  wikiUrl: 'https://wiki.guildwars2.com/wiki/Ardent_Glorious_armor',
  baseName: (s) => `Ardent Glorious ${s} (ascended)`,
  prosperity: () => prosperityGift(ITEM.giftOfCompetitiveProsperity, 'Gift of Competitive Prosperity', { id: synthetic(), name: 'Mist Core Fragment' }),
  prowess: () => prowessGift(ITEM.giftOfCompetitiveProwess, 'Gift of Competitive Prowess', { id: synthetic(), name: 'Record of League Victories', qty: 1 }),
  dedication: () => {
    const out = ref(ITEM.giftOfCompetitiveDedication, 'Gift of Competitive Dedication', 1)
    return {
      out,
      nodes: [
        node(
          out,
          [
            ref(ITEM.recordOfLeagueParticipation, 'Record of League Participation', 1),
            ref(ITEM.starOfGlory, 'Star of Glory', 1),
            ref(ITEM.globOfCondensedSpiritEnergy, 'Glob of Condensed Spirit Energy', 1),
            ref(ITEM.jarOfDistilledGlory, 'Jar of Distilled Glory', 1),
          ],
          { source: 'mystic-forge', notes: 'PvP League reward gifts' }
        ),
      ],
    }
  },
})

// --- Obsidian (PvE / SotO) — crafted in the Wizard's Tower, 9-clover gate ----
// Per-piece: Gift of (Magical|Mighty) Prosperity + Gift of Expertise + Gift of
// the Astral Ward + a per-slot Arcanum. Wiki-verified 2026-06-18.
function obsidianPiece(slot: (typeof ARMOR_SLOTS)[number]): LegendaryPiece {
  const id = synthetic()
  const condensed = slot.might ? giftOfCondensedMight() : giftOfCondensedMagic()
  const prosperity = ref(
    slot.might ? ITEM.giftOfMightyProsperity : ITEM.giftOfMagicalProsperity,
    `Gift of ${slot.might ? 'Mighty' : 'Magical'} Prosperity`,
    1
  )
  const expertise = ref(ITEM.giftOfExpertise, 'Gift of Expertise', 1)
  const astralWard = ref(ITEM.giftOfTheAstralWard, 'Gift of the Astral Ward', 1)
  const arcanum = ref(synthetic(), `Arcanum (${slot.label})`, 1)
  const name = `Obsidian ${slot.label}`
  const root = ref(id, name, 1)
  const nodes: RecipeNode[] = [
    node(root, [prosperity, expertise, astralWard, arcanum], {
      source: 'craft',
      discipline: 'Armorsmith/Tailor/Leatherworker 500 (Wizard’s Tower)',
      notes: 'Final step is a normal craft, not a Mystic Forge combine.',
    }),
    node(
      prosperity,
      [
        ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1),
        ref(ITEM.mysticClover, 'Mystic Clover', 9),
        condensed.out,
        ref(ITEM.giftOfResearch, 'Gift of Research', 1),
      ],
      { source: 'mystic-forge', notes: '9-clover time-gate lives here' }
    ),
    node(
      expertise,
      [
        ref(ITEM.amalgamatedRiftEssence, 'Amalgamated Rift Essence', 12),
        ref(ITEM.obsidianShard, 'Obsidian Shard', 50),
        ref(ITEM.eldritchScroll, 'Eldritch Scroll', 1),
        ref(ITEM.cubeOfStabilizedDarkEnergy, 'Cube of Stabilized Dark Energy', 1),
      ],
      { source: 'mystic-forge' }
    ),
    node(astralWard, [], { source: 'collection', notes: 'SotO map gifts (Skywatch/Amnytas/Inner Nayos) + Gift of Persistence' }),
    node(arcanum, [], { source: 'collection', notes: 'Per-slot collection unlock, bought from Lyhr for a Lesser Vision Crystal' }),
    node(
      ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1),
      [ref(currency(CUR.provisionerToken), 'Provisioner Token', 50)],
      { source: 'vendor', notes: '50 Provisioner Tokens' }
    ),
    eldritchScrollNode(),
    ...condensed.nodes,
  ]
  return {
    id,
    name,
    slot: 'armor',
    type: slot.label,
    acquisitionMode: 'open-world',
    unlocks: [id],
    blurb: 'SotO open-world. Crafted (not forged) in the Wizard’s Tower; 9-clover gate per piece via Gift of Prosperity.',
    recipe: { rootItemId: id, nodes, verified: true, wikiUrl: 'https://wiki.guildwars2.com/wiki/Obsidian_armor', version: 2 },
  }
}
const obsidian = ARMOR_SLOTS.map(obsidianPiece)

// --- Eikasia, Mists-Grasper (Fractal gloves) --------------------------------
// Achievement-gated (Incursive Investigation, 150 Fractalline Dust); craft path
// adds an 18-clover gate via two Gift of Prosperity.
function eikasiaGloves(): LegendaryPiece {
  const id = synthetic()
  const achievement = ref(synthetic(), 'Incursive Investigation (achievement)', 1)
  const fractallineSpark = ref(ITEM.fractallineSpark, 'Fractalline Spark', 1)
  const magicalProsp = ref(ITEM.giftOfMagicalProsperity, 'Gift of Magical Prosperity', 1)
  const mightyProsp = ref(ITEM.giftOfMightyProsperity, 'Gift of Mighty Prosperity', 1)
  const cMagic = giftOfCondensedMagic()
  const cMight = giftOfCondensedMight()
  const root = ref(id, 'Eikasia, Mists-Grasper (Gloves)', 1)
  const nodes: RecipeNode[] = [
    node(root, [achievement, magicalProsp, mightyProsp, fractallineSpark, ref(ITEM.icyRunestone, 'Icy Runestone', 200)], {
      source: 'collection',
      notes: 'First class free from achievement reward box; others bought from Mist Stranger.',
    }),
    node(achievement, [], { source: 'achievement', notes: 'Incursive Investigation (Quickplay Fractals) — gates the gloves' }),
    node(fractallineSpark, [ref(ITEM.fractallineDust, 'Fractalline Dust', 150)], {
      source: 'achievement',
      notes: 'Infinite Recursion: collect 150 Fractalline Dust from Quickplay Fractals',
    }),
    node(magicalProsp, [ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1), ref(ITEM.mysticClover, 'Mystic Clover', 9), cMagic.out, ref(ITEM.giftOfResearch, 'Gift of Research', 1)], {
      source: 'mystic-forge',
      notes: '9-clover gate',
    }),
    node(mightyProsp, [ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1), ref(ITEM.mysticClover, 'Mystic Clover', 9), cMight.out, ref(ITEM.giftOfResearch, 'Gift of Research', 1)], {
      source: 'mystic-forge',
      notes: '9-clover gate',
    }),
    node(ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1), [ref(currency(CUR.provisionerToken), 'Provisioner Token', 50)], {
      source: 'vendor',
      notes: '50 Provisioner Tokens',
    }),
    ...cMagic.nodes,
    ...cMight.nodes,
  ]
  return {
    id,
    name: 'Eikasia, Mists-Grasper (Gloves)',
    slot: 'armor',
    type: 'Gloves',
    acquisitionMode: 'Fractal',
    unlocks: [id],
    blurb:
      'Fractal gloves. Gated on the Incursive Investigation achievement (Quickplay Fractals, 150 Fractalline Dust). Craft path adds an 18-clover gate via two Gift of Prosperity.',
    recipe: { rootItemId: id, nodes, verified: true, wikiUrl: 'https://wiki.guildwars2.com/wiki/Eikasia,_Mists-Grasper', version: 2 },
  }
}

// --- Selachimorpha (legendary aquabreather) ---------------------------------
// Aquatic headgear. The wiki page exposes no machine-parseable {{recipe}}
// (collection/achievement reward), so this is a structural stub: verified:false.
function selachimorpha(): LegendaryPiece {
  const id = synthetic()
  const root = ref(id, 'Selachimorpha', 1)
  return {
    id,
    name: 'Selachimorpha',
    slot: 'armor',
    type: 'Aquabreather',
    acquisitionMode: 'collection',
    unlocks: [id],
    blurb: 'Legendary aquatic headgear (aquabreather). Collection-gated; full recipe pending wiki cross-check.',
    recipe: {
      rootItemId: id,
      nodes: [node(root, [], { source: 'collection', notes: 'Collection / achievement reward; recipe not yet modeled' })],
      verified: false,
      wikiUrl: 'https://wiki.guildwars2.com/wiki/Selachimorpha',
      version: 1,
    },
  }
}

export const ARMOR: LegendaryPiece[] = [
  ...obsidian,
  ...triumphant,
  ...envoy,
  ...ardent,
  eikasiaGloves(),
  selachimorpha(),
]
