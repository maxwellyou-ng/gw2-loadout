// ---------------------------------------------------------------------------
// Seed-loadout armor (4 must-haves). Each source has a distinct tree — which is
// exactly why per-piece curated data matters (brief Section 4).
//   - WvW shoulders: exotic -> ascended -> legendary; War gifts + ascended base
//   - Obsidian helm/boots: SotO open-world collection + Mists-infused mats
//   - Eikasia gloves: Fractal, achievement-gated (Working Together), no forge
// ---------------------------------------------------------------------------

import type { LegendaryPiece, RecipeNode } from '../../types'
import { ITEM, synthetic } from '../items'
import { ref, node, giftOfCondensedMight, giftOfCondensedMagic } from './_builders'

// WvW shoulders — wiki-verified (2026-06-17). Final Mystic Forge combine:
//   ascended Triumphant Hero's piece + Gift of War Prosperity + Gift of War
//   Prowess + Gift of War Dedication. Verified gift recipes:
//   - Prosperity (id from Condensed Might page): 1 Gift of Battle + 15 Mystic
//       Clover + 1 Gift of Condensed Might + 1 Gift of Condensed Magic
//   - Prowess (id 84168): 1 Legendary War Insight + 1 Eldritch Scroll +
//       250 Obsidian Shard + 1 Cube of Stabilized Dark Energy
//   - Dedication (id 83259): 1 Certificate of Honor + 1 Certificate of Heroics
//       + 1 Glob of Condensed Spirit Energy + 250 Memory of Battle
function wvwShoulders(): LegendaryPiece {
  const id = synthetic()
  const ascendedBase = ref(synthetic(), "Ascended Triumphant Hero's Shoulderguards (base)", 1)
  const prosperity = ref(synthetic(), 'Gift of War Prosperity', 1) // id not verified -> synthetic
  const prowess = ref(ITEM.giftOfWarProwess, 'Gift of War Prowess', 1) // id 84168
  const dedication = ref(ITEM.giftOfWarDedication, 'Gift of War Dedication', 1) // id 83259
  const cMight = giftOfCondensedMight()
  const cMagic = giftOfCondensedMagic()
  const root = ref(id, 'Legendary Shoulders (WvW)', 1)
  const nodes: RecipeNode[] = [
    node(root, [ascendedBase, prosperity, prowess, dedication], {
      source: 'mystic-forge',
      notes: 'Ascended -> legendary upgrade; consumes the three War gifts',
    }),
    node(ascendedBase, [], {
      source: 'craft',
      notes: 'Ascended base piece is a prerequisite tier (craft or WvW reward track)',
    }),
    // Prosperity: 15-clover time-gate + the two Condensed gifts.
    node(
      prosperity,
      [
        ref(ITEM.giftOfBattle, 'Gift of Battle', 1),
        ref(ITEM.mysticClover, 'Mystic Clover', 15),
        cMight.out,
        cMagic.out,
      ],
      { source: 'mystic-forge' }
    ),
    node(
      prowess,
      [
        ref(ITEM.legendaryWarInsight, 'Legendary War Insight', 1),
        ref(ITEM.eldritchScroll, 'Eldritch Scroll', 1),
        ref(ITEM.obsidianShard, 'Obsidian Shard', 250),
        ref(ITEM.cubeOfStabilizedDarkEnergy, 'Cube of Stabilized Dark Energy', 1),
      ],
      { source: 'mystic-forge', notes: 'Legendary War Insight gates on WvW Skirmish tickets' }
    ),
    node(
      dedication,
      [
        ref(ITEM.certificateOfHonor, 'Certificate of Honor', 1),
        ref(ITEM.certificateOfHeroics, 'Certificate of Heroics', 1),
        ref(ITEM.globOfCondensedSpiritEnergy, 'Glob of Condensed Spirit Energy', 1),
        ref(ITEM.memoryOfBattle, 'Memory of Battle', 250),
      ],
      { source: 'mystic-forge', notes: 'Memories of Battle from WvW reward tracks' }
    ),
    ...cMight.nodes,
    ...cMagic.nodes,
  ]
  return {
    id,
    name: 'Legendary Shoulders (WvW)',
    slot: 'armor',
    type: 'Heavy Shoulders',
    acquisitionMode: 'WvW',
    unlocks: [id],
    blurb:
      'Exotic -> ascended -> legendary. Final step consumes Gift of War Prosperity / Prowess / Dedication on top of an ascended base piece. 15-clover gate sits in Prosperity.',
    recipe: {
      rootItemId: id,
      nodes,
      verified: true,
      wikiUrl: 'https://wiki.guildwars2.com/wiki/Gift_of_War_Dedication',
      version: 2,
    },
  }
}

// Obsidian armor — wiki-verified (2026-06-17). IMPORTANT: the final recipe is a
// normal CRAFT (Armorsmith 500 for heavy) made in the Wizard's Tower — NOT a
// Mystic Forge combine, and there is no 50,000-karma cost (that was wrong).
// Per piece the heavy-line components are:
//   Gift of (Mighty|Magical) Prosperity  [helm/shoulders/chest -> Magical;
//       gloves/leggings/boots -> Mighty]  = Gift of Craftsmanship + 50
//       Provisioner Tokens + 9 Mystic Clover + Gift of Condensed Might/Magic
//       + Gift of Research
//   Gift of Expertise = 12 Amalgamated Rift Essence + 600 Glob of Ectoplasm +
//       Eldritch Scroll + Cube of Stabilized Dark Energy
//   Gift of the Astral Ward = Skywatch/Amnytas/Inner Nayos map gifts + Gift of
//       Persistence
//   one Arcanum (per-slot collection unlock)
// The 9-Mystic-Clover line is the dominant time-gate.
function obsidianPiece(name: string, type: string, slot: 'helm' | 'boots'): LegendaryPiece {
  const id = synthetic()
  // Gloves/leggings/boots use Mighty (Condensed Might); helm/shoulders/chest use Magical.
  const useMight = slot === 'boots'
  const condensed = useMight ? giftOfCondensedMight() : giftOfCondensedMagic()
  const prosperity = ref(synthetic(), `Gift of ${useMight ? 'Mighty' : 'Magical'} Prosperity`, 1)
  const expertise = ref(synthetic(), 'Gift of Expertise', 1)
  const astralWard = ref(synthetic(), 'Gift of the Astral Ward', 1)
  const arcanum = ref(synthetic(), `Arcanum (${slot})`, 1)
  const root = ref(id, name, 1)
  const nodes: RecipeNode[] = [
    node(root, [prosperity, expertise, astralWard, arcanum], {
      source: 'craft',
      discipline: 'Armorsmith 500 (Wizard’s Tower only)',
      notes: 'Final step is a normal craft, not a Mystic Forge combine.',
    }),
    node(
      prosperity,
      [
        ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1),
        ref(ITEM.provisionerToken, 'Provisioner Token', 50),
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
        ref(ITEM.ectoplasm, 'Glob of Ectoplasm', 600),
        ref(ITEM.eldritchScroll, 'Eldritch Scroll', 1),
        ref(ITEM.cubeOfStabilizedDarkEnergy, 'Cube of Stabilized Dark Energy', 1),
      ],
      { source: 'mystic-forge' }
    ),
    node(astralWard, [], { source: 'collection', notes: 'SotO map gifts (Skywatch/Amnytas/Inner Nayos) + Gift of Persistence' }),
    node(arcanum, [], { source: 'collection', notes: 'Per-slot collection unlock, bought from Lyhr for a Lesser Vision Crystal' }),
    ...condensed.nodes,
  ]
  return {
    id,
    name,
    slot: 'armor',
    type,
    acquisitionMode: 'open-world',
    unlocks: [id],
    blurb: 'SotO open-world. Crafted (not forged) in the Wizard’s Tower; 9-clover gate per piece via Gift of Prosperity.',
    recipe: {
      rootItemId: id,
      nodes,
      verified: true,
      wikiUrl: 'https://wiki.guildwars2.com/wiki/Obsidian_armor',
      version: 2,
    },
  }
}

// Eikasia, Mists-Grasper — wiki-verified (2026-06-17). CORRECTIONS: the gating
// achievement is "Incursive Investigation" (NOT "Working Together"); the dust
// gate is 150 Fractalline Dust via "Incursive Investigation: Infinite
// Recursion" from Quickplay Fractals (the old 100 + Fractal/Pristine Relic
// figures were wrong). The FIRST armor class is a free reward box from the
// achievement; the other two classes are bought from the Mist Stranger. The
// per-pair craft material list bundles 2 Gift of Prosperity (9 clovers each =
// 18-clover gate) + 200 Icy Runestones + a Fractalline Spark.
function eikasiaGloves(): LegendaryPiece {
  const id = synthetic()
  const achievement = ref(synthetic(), 'Incursive Investigation (achievement)', 1)
  const fractallineSpark = ref(synthetic(), 'Fractalline Spark', 1)
  const magicalProsp = ref(synthetic(), 'Gift of Magical Prosperity', 1)
  const mightyProsp = ref(synthetic(), 'Gift of Mighty Prosperity', 1)
  const cMagic = giftOfCondensedMagic()
  const cMight = giftOfCondensedMight()
  const root = ref(id, 'Eikasia, Mists-Grasper (Gloves)', 1)
  const nodes: RecipeNode[] = [
    node(root, [achievement, magicalProsp, mightyProsp, fractallineSpark, ref(ITEM.icyRunestone, 'Icy Runestone', 200)], {
      source: 'collection',
      notes: 'First class free from achievement reward box; others bought from Mist Stranger.',
    }),
    node(achievement, [], {
      source: 'achievement',
      notes: 'Incursive Investigation (Quickplay Fractals) — gates the gloves',
    }),
    node(fractallineSpark, [ref(ITEM.fractallineDust, 'Fractalline Dust', 150)], {
      source: 'achievement',
      notes: 'Infinite Recursion: collect 150 Fractalline Dust from Quickplay Fractals',
    }),
    node(magicalProsp, [ref(ITEM.mysticClover, 'Mystic Clover', 9), cMagic.out, ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1)], {
      source: 'mystic-forge',
      notes: '9-clover gate',
    }),
    node(mightyProsp, [ref(ITEM.mysticClover, 'Mystic Clover', 9), cMight.out, ref(ITEM.giftOfCraftsmanship, 'Gift of Craftsmanship', 1)], {
      source: 'mystic-forge',
      notes: '9-clover gate',
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
    recipe: {
      rootItemId: id,
      nodes,
      verified: true,
      wikiUrl: 'https://wiki.guildwars2.com/wiki/Eikasia,_Mists-Grasper',
      version: 2,
    },
  }
}

export const ARMOR: LegendaryPiece[] = [
  obsidianPiece('Obsidian Helm', 'Heavy Helm', 'helm'),
  obsidianPiece('Obsidian Boots', 'Heavy Boots', 'boots'),
  wvwShoulders(),
  eikasiaGloves(),
]
