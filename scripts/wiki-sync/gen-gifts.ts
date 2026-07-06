// ---------------------------------------------------------------------------
// `npm run wiki:gifts` — generate the gift recipe table the runtime expands.
//
// Themed weapon gifts (Gift of Sunrise, Gift of Astralaria, …) and their shared
// sub-gifts (Gift of the Mists, Gift of Metal, …) each have their own Mystic
// Forge recipe on the wiki, but the curated catalog modelled them as opaque
// leaves — so the RecipeTree stopped at the gift instead of showing its
// ingredients. This generator walks each gift's wiki recipe DAG (reusing the
// Phase-4 expander) and emits a flat table the runtime builder reconstructs
// into nested sub-trees.
//
// Beyond craftable recipes it records, per gift, `acq` — how it's acquired:
//   recipe  — has a {{Recipe}} (Mystic Forge / crafting); expands to its ingredients.
//   vendor  — bought from a vendor ({{Sold by}}); its currency cost is extracted from
//             the rendered Acquisition table by gen-vendor-costs.ts (a separate overlay).
//   reward  — received whole from map completion / story / achievement / collection /
//             reward track; a terminal leaf (nothing is spent to get it).
//
// Granularity policy (mirrors wiki:expand's default): expand ONLY gift nodes.
// Every non-gift component (ingots, runestones, dust/plank promotion chains,
// trophies, currencies) is a terminal leaf — past that boundary lies Mystic-Forge
// material promotion the catalog deliberately treats as terminal. Gifts the
// catalog already deep-models via a dedicated builder (Gift of Fortune / Mastery
// / Condensed Might/Magic) also stop, so the table never double-defines them.
//
// Output: src/data/recipes/generated/gifts.generated.json (committed, auditable).
// This is a maintainer tool run after game updates — NOT part of the build gate.
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { expandWikiRecipe, type WikiTreeNode } from './expand-recipe'
import { fetchWikitext } from './fetch'
import { canonComponent, SUPERSEDED_BY_CURRENCY } from './aliases'
import { itemInfoboxId } from './wikitext'
import { CATALOG } from '../../src/data/recipes'

/** Gifts the catalog already deep-expands via a dedicated builder — leave them
 * to that builder so the table never produces a divergent second definition. */
const BUILDER_OWNED = new Set([
  'gift of fortune',
  'gift of mastery',
  'gift of condensed might',
  'gift of condensed magic',
])

const isExpandableGift = (canon: string): boolean =>
  /^gift of /.test(canon) && !BUILDER_OWNED.has(canon)

/** A stop-set that terminates at everything EXCEPT an expandable gift. */
const STOP_AT_NON_GIFTS = { has: (canon: string) => !isExpandableGift(canon) } as unknown as ReadonlySet<string>

type Acq = 'recipe' | 'vendor' | 'reward'
interface GiftInput {
  name: string
  qty: number
  id?: number | null
  /** Wallet currency id — replaces `id` for ingredients the game converted
   * from inventory items to currencies (SUPERSEDED_BY_CURRENCY). */
  currency?: number
}
interface GiftEntry {
  name: string
  id: number | null
  acq: Acq
  inputs: GiftInput[]
}

/**
 * Classify how a gift is acquired from its wikitext:
 *   recipe  — has a {{Recipe}} (Mystic Forge / crafting).
 *   vendor  — bought from a vendor ({{Sold by}}); its currency cost is extracted
 *             separately from the rendered Acquisition table (see gen-vendor-costs.ts).
 *   reward  — anything else: received whole from map completion / story / achievement
 *             / collection / reward track ({{rewarded by}} or no purchase template).
 * Vendor REQUIRES {{Sold by}}; the default is the whole-reward leaf, never vendor.
 */
// Gifts whose page carries a (historical) {{Sold by}} but are really obtained
// whole from a reward track / map / achievement — classify as reward (a leaf).
const REWARD_OVERRIDE = new Set(['gift of battle'])

function classifyAcq(wikitext: string, name: string): Acq {
  if (REWARD_OVERRIDE.has(canonComponent(name))) return 'reward'
  if (/\{\{Recipe\s*[\n|]/i.test(wikitext)) return 'recipe'
  if (/\{\{Sold by\}\}/i.test(wikitext)) return 'vendor'
  return 'reward'
}

/** Every distinct expandable-gift name referenced anywhere in the catalog. */
function rootGiftNames(): string[] {
  const seen = new Map<string, string>() // canon -> display name
  for (const piece of CATALOG) {
    for (const n of piece.recipe.nodes) {
      for (const ref of [n.output, ...n.inputs]) {
        const canon = canonComponent(ref.name)
        if (isExpandableGift(canon) && !seen.has(canon)) seen.set(canon, ref.name)
      }
    }
  }
  return [...seen.values()].sort()
}

async function main(): Promise<void> {
  const noCache = process.argv.includes('--no-cache')
  const roots = rootGiftNames()
  console.log(`Generating gift recipe table from ${roots.length} catalog gift roots …\n`)

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

  // Pass 1: expand recipe DAGs. Record every gift NODE we meet (internal or leaf,
  // excluding builder-owned) plus the direct inputs of expanded ones.
  const giftNodes = new Map<string, { name: string; id: number | null }>()
  const inputsByCanon = new Map<string, GiftInput[]>()
  const collect = (node: WikiTreeNode): void => {
    const canon = canonComponent(node.name)
    if (isExpandableGift(canon)) {
      if (!giftNodes.has(canon)) giftNodes.set(canon, { name: node.name, id: node.apiId })
      if (node.stop === null && node.children.length > 0 && !inputsByCanon.has(canon)) {
        inputsByCanon.set(
          canon,
          node.children.map((c) => {
            const sup = SUPERSEDED_BY_CURRENCY[canonComponent(c.name)]
            return sup
              ? { name: sup.name, qty: c.qty, currency: sup.currency }
              : { name: c.name, qty: c.qty, id: c.apiId }
          }),
        )
      }
    }
    node.children.forEach(collect)
  }

  for (const root of roots) {
    const tree = await expandWikiRecipe(root, { fetchPage, baseMaterials: STOP_AT_NON_GIFTS, maxDepth: 12 })
    if (tree.stop === 'missing-page') {
      console.warn(`  ? ${root}: no wiki page found — skipped`)
      continue
    }
    collect(tree)
  }

  // Pass 2: classify acquisition for every gift node. (Vendor currency costs are
  // extracted separately from rendered HTML by gen-vendor-costs.ts.)
  const table: Record<string, GiftEntry> = {}
  for (const [canon, { name, id }] of giftNodes) {
    const wikitext = await fetchPage(name)
    const acq = wikitext ? classifyAcq(wikitext, name) : 'reward'
    const inputs = inputsByCanon.get(canon) ?? []
    table[canon] = { name, id, acq, inputs }
  }

  // Pass 3: resolve real item ids for material-leaf inputs the expander left null
  // (it stops at base materials without fetching them), from each item's wiki
  // infobox (`| id = N`). Real ids let leaves match inventory and render verified
  // (not synthetic → unverified) under a verified parent. Items with no infobox id
  // (e.g. armor-set ascended bases) stay null → synthetic at runtime.
  const nullInputs = new Set<string>()
  for (const e of Object.values(table)) for (const inp of e.inputs) if (inp.currency == null && inp.id == null) nullInputs.add(inp.name)
  const idByName = new Map<string, number>()
  for (const nm of [...nullInputs].sort()) {
    const wikitext = await fetchPage(nm)
    const id = wikitext ? itemInfoboxId(wikitext) : null
    if (id != null) idByName.set(nm, id)
  }
  for (const e of Object.values(table)) {
    for (const inp of e.inputs) if (inp.currency == null && inp.id == null && idByName.has(inp.name)) inp.id = idByName.get(inp.name)!
  }
  console.log(`   resolved ${idByName.size}/${nullInputs.size} material-leaf ids`)

  const ordered = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)))
  const here = dirname(fileURLToPath(import.meta.url))
  const out = resolve(here, '../../src/data/recipes/generated/gifts.generated.json')
  writeFileSync(out, JSON.stringify(ordered, null, 2) + '\n')

  const entries = Object.values(ordered)
  const byAcq = (a: Acq) => entries.filter((e) => e.acq === a).length
  console.log(`\n✅ ${entries.length} gift recipes → ${out}`)
  console.log(`   recipe:${byAcq('recipe')}  vendor:${byAcq('vendor')}  reward:${byAcq('reward')}`)
  console.log(`   ${fetched} live fetch${fetched === 1 ? '' : 'es'} (rest cached).`)
}

main().catch((err) => {
  console.error('wiki:gifts failed:', err)
  process.exit(1)
})
