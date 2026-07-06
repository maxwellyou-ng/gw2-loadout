// ---------------------------------------------------------------------------
// `npm run wiki:crafted` — generate the crafted-intermediate recipe table.
//
// Companion to gen-gifts.ts for NON-gift intermediates whose ingredients are
// required on every realistic acquisition path (craft-only items and pure
// currency conversions). The catalog used to model these as opaque leaves, so
// their contents never reached the Materials list — e.g. Cube of Stabilized
// Dark Energy (1 Ball of Dark Energy + 75 Stabilizing Matrix) was a silent
// leaf in ~64 pieces.
//
// CRAFTED_EXPAND is the curated policy: only names on this list are expanded
// (see src/data/recipes/leaf-policy.ts for why everything else stays a leaf —
// promotion recipes and TP-buyable crafted goods must NOT be expanded).
//
// For each name: parse its wiki {{Recipe}} (parse-recipe picks ONE canonical
// template — never a union of alternatives), map wallet-currency ingredients
// to /v2/currencies ids, and resolve item ids for the rest from each
// ingredient page's infobox. Output is committed and auditable:
//   src/data/recipes/generated/crafted.generated.json
// Maintainer tool, run after game updates — NOT part of the build gate.
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchWikitext } from './fetch'
import { parseItemPage } from './parse-recipe'
import { canonComponent, SUPERSEDED_BY_CURRENCY } from './aliases'
import { itemInfoboxId } from './wikitext'

/** Craft-only / currency-conversion intermediates to expand (curated policy). */
const CRAFTED_EXPAND: string[] = [
  // Ascended-material refinements consumed by trinkets/armor — account-bound,
  // recipe is the only path. Vision Crystal hides the classic "don't feed your
  // eaters" mats (Dragonite/Empyreal/Bloodstone).
  'Cube of Stabilized Dark Energy',
  'Vision Crystal',
  'Bloodstone Brick',
  'Dragonite Ingot',
  'Empyreal Star',
  "Augur's Stone",
  // Janthir Wilds (Obsidian armor / Warbringer / Klobjarne) forge combines.
  'Mystic Essence of Animosity',
  'Mystic Essence of Annihilation',
  'Mystic Essence of Carnage',
  'Mystic Essence of Strategy',
  'Neutralized Titan Alloy',
  'Vial of Titan Melted Liquid Obsidian',
  // SotO rift conversion — hides a Mystic Clover per essence (time-gated!).
  'Purified Rift Essence',
  // HoT craft-only component (250 per Gen2.5 weapon via Gift of Maguuma Mastery).
  'Crystalline Ingot',
  // Pure wallet-currency conversions (WvW / PvP / spirit shards).
  'Certificate of Heroics',
  'Certificate of Honor',
  'Certificate of Support',
  'Glob of Condensed Spirit Energy',
  'Jar of Distilled Glory',
  'Record of League Participation',
  'Star of Glory',
  // HoT map refinement (Perfected Envoy armor).
  'Auric Ingot',
  // Gen2 themed-gift components — craft-only forge/discipline recipes hiding
  // the notorious mithril/elder-wood/curio walls and dungeon-gift costs.
  'War Commendation',
  'Relic of the Sunless',
  'Eel Statue',
  'Shark Statue',
  'Unicorn Statue',
  'Wolf Statue',
  'Vial of Liquid Flame',
  'Vial of Quicksilver',
  'Shard of Arah',
  'Shard of Call of the Void',
  'Shard of Endeavor',
  'Shard of Exitare',
  'Shard of Friendship',
  'Shard of Liturgy',
  'Shard of Resolution',
  'Shard of Spero',
  'Shard of Tlehco',
  'Shard of the Crown',
  'Shard of the Dark Arts',
  // HoT craft-only component of Crystalline Ingots.
  'Fulgurite',
  // Ascended weapon parts inside Poems — craft-only, and their Deldrimor
  // Steel / Spiritwood inputs sit behind the DAILY-gated Mithrillium /
  // Spirit-Residue refinements, which feed the earliest-finish math.
  'Deldrimor Steel Ingot',
  'Spiritwood Plank',
  'Deldrimor Steel Axe Blade',
  'Deldrimor Steel Dagger Blade',
  'Deldrimor Steel Greatsword Blade',
  'Deldrimor Steel Hammer Head',
  'Deldrimor Steel Horn',
  'Deldrimor Steel Mace Head',
  'Deldrimor Steel Pistol Barrel',
  'Deldrimor Steel Rifle Barrel',
  'Deldrimor Steel Shield Boss',
  'Deldrimor Steel Sword Blade',
  'Deldrimor Steel Torch Head',
  'Spiritwood Focus Core',
  'Spiritwood Longbow Stave',
  'Spiritwood Scepter Core',
  'Spiritwood Short-Bow Stave',
  'Spiritwood Staff Head',
  // Gen2.5 poem components (scribe-crafted, account-bound).
  'Poem on Axes',
  'Poem on Daggers',
  'Poem on Foci',
  'Poem on Greatswords',
  'Poem on Hammers',
  'Poem on Longbows',
  'Poem on Maces',
  'Poem on Pistols',
  'Poem on Rifles',
  'Poem on Scepters',
  'Poem on Shields',
  'Poem on Short Bows',
  'Poem on Staves',
  'Poem on Swords',
  'Poem on Torches',
  'Poem on Warhorns',
]

/** Wallet currencies by canonical ingredient name (/v2/currencies, 2026-07-03).
 *  Tolerates the wiki's singular/plural drift ("Ascended Shard(s) of Glory"). */
const CURRENCY_BY_NAME: Record<string, number> = {
  coin: 1,
  karma: 2,
  'spirit shard': 23,
  'spirit shards': 23,
  'badge of honor': 15,
  'ascended shard of glory': 33,
  'ascended shards of glory': 33,
  'pvp league ticket': 30,
  'pvp league tickets': 30,
  'testimony of jade heroics': 65,
  'research note': 61,
  'research notes': 61,
}

/** Items with no parseable {{Recipe}} whose cost is nonetheless fixed and
 *  wiki-documented (vendor conversions) — hand-curated, cite the page. */
const STATIC_RECIPES: Record<string, { name: string; qty: number; currency: number }[]> = {
  // https://wiki.guildwars2.com/wiki/Augur's_Stone — Miyani, 20 Spirit Shards.
  "augur's stone": [{ name: 'Spirit Shard', qty: 20, currency: 23 }],
}

/** Wiki recipe text sometimes pluralizes ingredient names — normalize to the
 *  item's real display name so one material never renders under two labels. */
const NAME_FIX: Record<string, string> = {
  'piles of bloodstone dust': 'Pile of Bloodstone Dust',
  'mystic clovers': 'Mystic Clover',
}

interface CraftedInput {
  name: string
  qty: number
  id?: number | null
  /** Wallet currency id — mutually exclusive with `id`. */
  currency?: number
}
interface CraftedEntry {
  name: string
  id: number | null
  inputs: CraftedInput[]
}

async function main(): Promise<void> {
  const noCache = process.argv.includes('--no-cache')
  let fetched = 0
  const fetchPage = async (name: string): Promise<string | null> => {
    try {
      const page = await fetchWikitext(name, { noCache })
      if (!page.fromCache) fetched++
      return page.wikitext
    } catch (err) {
      console.warn(`  ! ${name}: ${(err as Error).message}`)
      return null
    }
  }

  const table: Record<string, CraftedEntry> = {}
  const failures: string[] = []

  for (const name of CRAFTED_EXPAND) {
    const canon = canonComponent(name)
    const wikitext = await fetchPage(name)
    const apiId = wikitext ? itemInfoboxId(wikitext) : null

    const staticRecipe = STATIC_RECIPES[canon]
    if (staticRecipe) {
      table[canon] = { name, id: apiId, inputs: staticRecipe.map((i) => ({ ...i })) }
      continue
    }
    if (!wikitext) {
      failures.push(`${name}: page missing`)
      continue
    }
    const parsed = parseItemPage(wikitext)
    if (parsed.confidence !== 'high' || parsed.components.length === 0) {
      failures.push(`${name}: no high-confidence {{Recipe}} (${parsed.parseNote ?? 'unknown'})`)
      continue
    }
    const inputs: CraftedInput[] = parsed.components.map((c) => {
      const cName = NAME_FIX[canonComponent(c.name)] ?? c.name
      const sup = SUPERSEDED_BY_CURRENCY[canonComponent(cName)]
      if (sup) return { name: sup.name, qty: c.qty, currency: sup.currency }
      const cur = CURRENCY_BY_NAME[canonComponent(cName)]
      return cur != null ? { name: cName, qty: c.qty, currency: cur } : { name: cName, qty: c.qty, id: null }
    })
    table[canon] = { name, id: parsed.apiId, inputs }
  }

  // Resolve real item ids for non-currency ingredients from their page infobox
  // (same approach as gen-gifts Pass 3). Unresolved stay null → synthetic id at
  // runtime (still counted, just not inventory-matchable).
  const nullNames = new Set<string>()
  for (const e of Object.values(table)) for (const i of e.inputs) if (i.currency == null && i.id == null) nullNames.add(i.name)
  const idByName = new Map<string, number>()
  for (const nm of [...nullNames].sort()) {
    const wikitext = await fetchPage(nm)
    const id = wikitext ? itemInfoboxId(wikitext) : null
    if (id != null) idByName.set(nm, id)
  }
  for (const e of Object.values(table)) {
    for (const i of e.inputs) if (i.currency == null && i.id == null && idByName.has(i.name)) i.id = idByName.get(i.name)!
  }

  const ordered = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)))
  const here = dirname(fileURLToPath(import.meta.url))
  const out = resolve(here, '../../src/data/recipes/generated/crafted.generated.json')
  writeFileSync(out, JSON.stringify(ordered, null, 2) + '\n')

  console.log(`\n✅ ${Object.keys(ordered).length}/${CRAFTED_EXPAND.length} crafted recipes → ${out}`)
  console.log(`   resolved ${idByName.size}/${nullNames.size} ingredient ids; ${fetched} live fetches (rest cached).`)
  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} entries failed — fix or remove from CRAFTED_EXPAND:`)
    for (const f of failures) console.error('   ' + f)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('wiki:crafted failed:', err)
  process.exit(1)
})
