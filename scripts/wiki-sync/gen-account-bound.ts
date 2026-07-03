// ---------------------------------------------------------------------------
// `npm run wiki:account-bound` — generate the account-bound item manifest.
//
// The engine's `leafBuyable` used to default unknown real ids to "buyable",
// which mislabelled account-bound materials (Ball of Dark Energy, Exotic
// Essence of Luck, gen2 collection precursors, tribute items, …) as Trading
// Post purchases — telling users to buy things that cannot be bought. This
// generator asks the authoritative source: /v2/items `flags` for every
// distinct real-item leaf and intermediate in the catalog, and writes the ids
// flagged AccountBound/SoulbindOnAcquire. `leafBuyable` treats this manifest
// as an override that beats node-level flags.
//
// Output: src/data/recipes/generated/account-bound.generated.json (committed).
// Maintainer tool, rerun after catalog/game updates — NOT part of the gate.
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CATALOG } from '../../src/data/recipes'
import { isCurrency, isSynthetic } from '../../src/data/items'

async function main(): Promise<void> {
  // Every distinct real item id referenced anywhere in the catalog's trees.
  const byId = new Map<number, string>()
  for (const p of CATALOG) {
    for (const n of p.recipe.nodes) {
      for (const r of [n.output, ...n.inputs]) {
        if (!isCurrency(r.itemId) && !isSynthetic(r.itemId)) byId.set(r.itemId, r.name)
      }
    }
  }
  const ids = [...byId.keys()].sort((a, b) => a - b)
  console.log(`Checking ${ids.length} distinct item ids against /v2/items …`)

  const bound: Record<string, string> = {}
  let missing = 0
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const res = await fetch('https://api.guildwars2.com/v2/items?ids=' + chunk.join(','))
    if (!res.ok) throw new Error(`/v2/items ${res.status}`)
    const items = (await res.json()) as { id: number; name: string; flags?: string[] }[]
    missing += chunk.length - items.length // ids the API doesn't expose
    for (const it of items) {
      if (it.flags?.includes('AccountBound') || it.flags?.includes('SoulbindOnAcquire')) {
        bound[String(it.id)] = it.name
      }
    }
  }

  const here = dirname(fileURLToPath(import.meta.url))
  const out = resolve(here, '../../src/data/recipes/generated/account-bound.generated.json')
  writeFileSync(out, JSON.stringify(bound, null, 1) + '\n')
  console.log(`✅ ${Object.keys(bound).length} account-bound ids → ${out} (${missing} ids not in the API)`)
}

main().catch((err) => {
  console.error('wiki:account-bound failed:', err)
  process.exit(1)
})
