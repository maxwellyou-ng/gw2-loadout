// ---------------------------------------------------------------------------
// Generate a committed icon map (src/data/icons.json) so the UI can show GW2
// item icons offline / instantly (no text->icon flash, no runtime API calls).
//
// Collects every *real* item id referenced anywhere in the catalog — each
// legendary piece's id + armory unlocks, plus every recipe node output/input —
// and resolves its render.guildwars2.com icon URL via the public /v2/items
// endpoint (no API key needed). Wallet-currency leaves (ids at CURRENCY_BASE +
// currencyId) resolve via /v2/currencies and are keyed by their namespaced id,
// so ItemIcon needs no special casing. Synthetic intermediates have no real id
// and are skipped (ItemIcon falls back to a placeholder).
//
//   npm run gen:icons
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CATALOG } from '../src/data/recipes'
import { CURRENCY_BASE, isCurrency, isSynthetic } from '../src/data/items'

const BASE = 'https://api.guildwars2.com/v2'
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/icons.json')

const isReal = (id: number) => id > 0 && id < CURRENCY_BASE && !isSynthetic(id)

function collectIds(): { items: number[]; currencies: number[] } {
  const items = new Set<number>()
  const currencies = new Set<number>()
  const add = (id: number) => {
    if (isReal(id)) items.add(id)
    else if (isCurrency(id)) currencies.add(id - CURRENCY_BASE)
  }
  for (const piece of CATALOG) {
    add(piece.id)
    for (const u of piece.unlocks) add(u)
    for (const node of piece.recipe.nodes) {
      add(node.output.itemId)
      for (const input of node.inputs) add(input.itemId)
    }
  }
  return {
    items: [...items].sort((a, b) => a - b),
    currencies: [...currencies].sort((a, b) => a - b),
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const { items, currencies } = collectIds()
  console.log(`Resolving icons for ${items.length} real item ids + ${currencies.length} currencies…`)

  const map: Record<number, string> = {}
  for (const part of chunk(items, 150)) {
    const res = await fetch(`${BASE}/items?ids=${part.join(',')}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`  /items chunk failed: ${res.status} (skipping ${part.length} ids)`)
      continue
    }
    const got = (await res.json()) as { id: number; icon?: string }[]
    for (const item of got) if (item.icon) map[item.id] = item.icon
  }

  // Wallet currencies, keyed at CURRENCY_BASE + id (the leaf id the UI sees).
  if (currencies.length > 0) {
    const res = await fetch(`${BASE}/currencies?ids=${currencies.join(',')}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const got = (await res.json()) as { id: number; icon?: string }[]
      for (const c of got) if (c.icon) map[CURRENCY_BASE + c.id] = c.icon
    } else {
      console.warn(`  /currencies failed: ${res.status} (skipping ${currencies.length} ids)`)
    }
  }

  const resolved = Object.keys(map).length
  // Stable key order keeps the committed diff clean.
  const sorted = Object.fromEntries(
    Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0])),
  )
  writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`Wrote ${resolved}/${items.length + currencies.length} icons -> ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
