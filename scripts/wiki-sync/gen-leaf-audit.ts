// ---------------------------------------------------------------------------
// `npm run wiki:leaf-audit` — classify every leaf material that has a recipe.
//
// The user-facing invariant: a material whose ingredients are required on
// every acquisition path must never sit as an opaque leaf (that's how 250
// Exotic Essence of Luck and the Cube of Stabilized Dark Energy's matrices
// stayed invisible). But MOST leaf-with-recipe cases are correct leaves:
// tier-promotion recipes (Vicious Claw ← 50 Large Claw + …, self-referential)
// and TP-buyable crafted goods (sigils, food, lodestones) where buying is the
// normal path.
//
// This tool walks every distinct terminal leaf in the catalog, parses its
// (cached) wiki page, and maintains src/data/recipes/leaf-policy.json:
//   expand          — must be covered by the gift/crafted tables (never a leaf)
//   leaf:promotion  — self-referential tier promotion (auto-detected)
//   leaf:tp-buyable — tradeable on the TP; buying is a legitimate direct path
//   leaf:direct     — account-bound but acquired directly (drops/salvage/maps)
//   leaf:variants   — multiple player-chosen recipe variants (e.g. Mystic Curio)
//
// New names are ADDED with an auto-guess (never overwriting hand decisions);
// `--check` fails if any leaf-with-recipe name is missing from the policy —
// run it after wiki:fetch / catalog changes. The offline build gate
// (wiki:totals) separately enforces that nothing expandable stays a leaf and
// that every `expand` entry is actually covered by the tables.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CATALOG } from '../../src/data/recipes'
import { hasGiftRecipe } from '../../src/data/recipes/_builders'
import { isAccountBound, isCurrency, isSynthetic, isTimeGated } from '../../src/data/items'
import { fetchWikitext } from './fetch'
import { parseItemPage } from './parse-recipe'
import { canonComponent } from './aliases'

export interface LeafPolicyEntry {
  name: string
  action: 'expand' | 'leaf'
  reason: string
}
export type LeafPolicy = Record<string, LeafPolicyEntry>

const POLICY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/data/recipes/leaf-policy.json',
)

/** Every distinct terminal leaf (real items only) across the catalog. */
function catalogLeaves(): Map<string, { name: string; itemId: number }> {
  const out = new Map<string, { name: string; itemId: number }>()
  for (const p of CATALOG) {
    const producing = new Map(p.recipe.nodes.map((n) => [n.output.itemId, n]))
    for (const n of p.recipe.nodes) {
      for (const i of n.inputs) {
        const node = producing.get(i.itemId)
        if (node && node.inputs.length > 0) continue
        if (isCurrency(i.itemId) || isSynthetic(i.itemId) || isTimeGated(i.itemId)) continue
        const canon = canonComponent(i.name)
        if (!out.has(canon)) out.set(canon, { name: i.name, itemId: i.itemId })
      }
    }
  }
  return out
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check')
  const policy: LeafPolicy = existsSync(POLICY_PATH)
    ? (JSON.parse(readFileSync(POLICY_PATH, 'utf8')) as LeafPolicy)
    : {}

  const leaves = catalogLeaves()
  console.log(`Auditing ${leaves.size} distinct leaf materials …`)

  let fetched = 0
  const added: string[] = []
  const unclassified: string[] = []

  for (const [canon, { name, itemId }] of [...leaves].sort()) {
    let wikitext: string | null
    try {
      const page = await fetchWikitext(name, {})
      if (!page.fromCache) fetched++
      wikitext = page.wikitext
    } catch {
      continue // no page — nothing craftable to classify
    }
    if (!wikitext) continue
    const parsed = parseItemPage(wikitext)
    if (parsed.confidence !== 'high' || parsed.components.length === 0) continue

    // This leaf has a parseable recipe — it must be classified.
    if (policy[canon]) continue
    if (checkOnly) {
      unclassified.push(name)
      continue
    }

    // Auto-guess for new entries (hand-review anything not a promotion).
    const selfRef = parsed.components.some((c) => canonComponent(c.name) === canon)
    let entry: LeafPolicyEntry
    if (hasGiftRecipe(name)) {
      entry = { name, action: 'expand', reason: 'covered by gift/crafted tables' }
    } else if (selfRef) {
      entry = { name, action: 'leaf', reason: 'promotion — self-referential tier upgrade, direct acquisition is the norm' }
    } else if (isAccountBound(itemId)) {
      entry = { name, action: 'leaf', reason: 'REVIEW: account-bound with a recipe — verify a direct acquisition path exists, else move to expand' }
    } else {
      entry = { name, action: 'leaf', reason: 'tp-buyable — purchasing is a legitimate direct path' }
    }
    policy[canon] = entry
    added.push(`${name} → ${entry.action} (${entry.reason.split(' — ')[0]})`)
  }

  if (checkOnly) {
    if (unclassified.length > 0) {
      console.error(`❌ ${unclassified.length} leaf material(s) have a wiki recipe but no leaf-policy entry:`)
      for (const n of unclassified) console.error('   • ' + n)
      console.error('Run `npm run wiki:leaf-audit` (no --check) to add skeleton entries, then triage them.')
      process.exit(1)
    }
    console.log('✅ every leaf-with-recipe material is classified in leaf-policy.json.')
    return
  }

  const ordered = Object.fromEntries(Object.entries(policy).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(POLICY_PATH, JSON.stringify(ordered, null, 1) + '\n')
  console.log(`✅ ${Object.keys(ordered).length} classified (${added.length} new) → ${POLICY_PATH}; ${fetched} live fetches.`)
  if (added.length > 0) {
    console.log('New entries (review any marked REVIEW):')
    for (const a of added) console.log('   • ' + a)
  }
}

main().catch((err) => {
  console.error('wiki:leaf-audit failed:', err)
  process.exit(1)
})
