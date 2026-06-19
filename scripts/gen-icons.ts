// ---------------------------------------------------------------------------
// Generate a committed icon map (src/data/icons.json) so the UI can show GW2
// item icons offline / instantly (no text->icon flash, no runtime API calls).
//
// Collects every *real* item id referenced anywhere in the catalog — each
// legendary piece's id + armory unlocks, plus every recipe node output/input —
// and resolves its render.guildwars2.com icon URL via the public /v2/items
// endpoint (no API key needed). Synthetic intermediates and wallet currencies
// have no real id and are skipped (ItemIcon falls back to a placeholder).
//
//   npm run gen:icons
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CATALOG } from '../src/data/recipes'
import { CURRENCY_BASE, isSynthetic } from '../src/data/items'

const BASE = 'https://api.guildwars2.com/v2'
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/icons.json')

const isReal = (id: number) => id > 0 && id < CURRENCY_BASE && !isSynthetic(id)

function collectIds(): number[] {
  const ids = new Set<number>()
  for (const piece of CATALOG) {
    if (isReal(piece.id)) ids.add(piece.id)
    for (const u of piece.unlocks) if (isReal(u)) ids.add(u)
    for (const node of piece.recipe.nodes) {
      if (isReal(node.output.itemId)) ids.add(node.output.itemId)
      for (const input of node.inputs) if (isReal(input.itemId)) ids.add(input.itemId)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const ids = collectIds()
  console.log(`Resolving icons for ${ids.length} real item ids…`)

  const map: Record<number, string> = {}
  for (const part of chunk(ids, 150)) {
    const res = await fetch(`${BASE}/items?ids=${part.join(',')}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`  /items chunk failed: ${res.status} (skipping ${part.length} ids)`)
      continue
    }
    const items = (await res.json()) as { id: number; icon?: string }[]
    for (const item of items) if (item.icon) map[item.id] = item.icon
  }

  const resolved = Object.keys(map).length
  // Stable key order keeps the committed diff clean.
  const sorted = Object.fromEntries(
    Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0])),
  )
  writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`Wrote ${resolved}/${ids.length} icons -> ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
