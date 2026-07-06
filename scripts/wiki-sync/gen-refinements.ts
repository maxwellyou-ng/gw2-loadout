// ---------------------------------------------------------------------------
// `npm run wiki:refinements` — deterministic refinement recipes for the basic
// crafting materials legendaries consume in bulk (metal ingots, wood planks,
// cloth bolts, leather squares), straight from the official GW2 API
// (/v2/recipes — exact ratios, no wiki parsing).
//
// Why: these were opaque leaves ("promotion" in leaf-policy), so a player
// holding Mithril Ore saw no credit toward a 250-ingot requirement and the
// tree view hid the ore tier entirely. As expansions, the engine's
// intermediate-crediting (progress.ts flatten) shows both tiers: owned ingots
// reduce the ore still required. T6 trophy/dust Mystic Forge *promotions* stay
// leaves deliberately — non-deterministic and direct acquisition is the norm.
//
// Output: src/data/recipes/generated/refinements.generated.json, same shape as
// crafted.generated.json (merged into the CRAFTED table by _builders.ts).
// Maintainer tool; rerun only if ArenaNet changes refinement ratios (rare).
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonComponent } from './aliases'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(HERE, '../../src/data/recipes/generated/refinements.generated.json')
const API = 'https://api.guildwars2.com/v2'
const UA = { 'User-Agent': 'gw2-loadout-wikisync/1.0 (refinement recipes; contact: project maintainer)' }

/** The refined materials the catalog references as bulk requirements
 * (item ids cross-checked by `npm run wiki:ids`). */
const REFINED: { name: string; id: number }[] = [
  // Metal ingots (Gift of Metal and friends)
  { name: 'Iron Ingot', id: 19683 },
  { name: 'Steel Ingot', id: 19688 },
  { name: 'Darksteel Ingot', id: 19681 },
  { name: 'Mithril Ingot', id: 19684 },
  { name: 'Platinum Ingot', id: 19686 },
  { name: 'Orichalcum Ingot', id: 19685 },
  // Wood planks (Gift of Wood / Gift of Nature lines)
  { name: 'Soft Wood Plank', id: 19713 },
  { name: 'Seasoned Wood Plank', id: 19714 },
  { name: 'Hard Wood Plank', id: 19711 },
  { name: 'Elder Wood Plank', id: 19709 },
  { name: 'Ancient Wood Plank', id: 19712 },
  // Cloth + leather refinements
  { name: 'Bolt of Gossamer', id: 19746 },
  { name: 'Cured Hardened Leather Square', id: 19737 },
]

interface ApiRecipe {
  id: number
  type: string
  output_item_id: number
  output_item_count: number
  disciplines: string[]
  min_rating: number
  ingredients: { item_id: number; count: number }[]
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: UA })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  return res.json() as Promise<T>
}

async function main(): Promise<void> {
  console.log(`Fetching ${REFINED.length} refinement recipes from /v2/recipes …\n`)
  const table: Record<string, { name: string; id: number; discipline: string; inputs: { name: string; qty: number; id: number }[] }> = {}
  const ingredientIds = new Set<number>()
  const recipesByOutput = new Map<number, ApiRecipe>()

  for (const r of REFINED) {
    const searchIds = await getJson<number[]>(`/recipes/search?output=${r.id}`)
    if (!searchIds.length) throw new Error(`${r.name}: no API recipe produces item ${r.id}`)
    const recipes = await getJson<ApiRecipe[]>(`/recipes?ids=${searchIds.join(',')}`)
    // Refinements are the sole "Refinement"-type recipe for their output; the
    // model assumes 1 output per craft — fail loudly if the game ever changes.
    const refinement = recipes.find((x) => x.type === 'Refinement') ?? recipes[0]
    if (refinement.output_item_count !== 1)
      throw new Error(`${r.name}: output_item_count=${refinement.output_item_count} — per-craft model assumes 1`)
    recipesByOutput.set(r.id, refinement)
    refinement.ingredients.forEach((i) => ingredientIds.add(i.item_id))
  }

  const items = await getJson<{ id: number; name: string }[]>(`/items?ids=${[...ingredientIds].join(',')}`)
  const nameById = new Map(items.map((i) => [i.id, i.name]))

  for (const r of REFINED) {
    const rec = recipesByOutput.get(r.id)!
    table[canonComponent(r.name)] = {
      name: r.name,
      id: r.id,
      discipline: `${rec.disciplines.join('/')} ${rec.min_rating}`,
      inputs: rec.ingredients.map((i) => ({ name: nameById.get(i.item_id) ?? `item ${i.item_id}`, qty: i.count, id: i.item_id })),
    }
    const inputs = table[canonComponent(r.name)].inputs.map((i) => `${i.qty}× ${i.name}`).join(' + ')
    console.log(`  ${r.name} ← ${inputs}`)
  }

  const ordered = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(OUT_PATH, JSON.stringify(ordered, null, 2) + '\n')
  console.log(`\n✅ ${Object.keys(ordered).length} refinement recipes → ${OUT_PATH}`)
}

main().catch((err) => {
  console.error('wiki:refinements failed:', err)
  process.exit(1)
})
