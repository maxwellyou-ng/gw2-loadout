// ---------------------------------------------------------------------------
// `npm run wiki:ids` — the id↔name gate. Every {name, id} pair the catalog or
// the generated tables reference must agree with the official GW2 API, every
// currency id must exist in /v2/currencies, and nothing may reference a tender
// recorded as discontinued (discontinued.json).
//
// Why: a wrong id is silently corrosive — the tracker demands an item nobody
// can get, credits inventory the player doesn't have, or never credits what
// they do have. This gate would have caught 12 of the 13 defects found in the
// 2026-07-05 obtainability audit: 10 food ids that were nourishment EFFECT ids
// (see wikitext.ts#itemInfoboxId), and the two item-ids-turned-wallet-currency
// (Legendary Insight, Tales of Dungeon Delving). The 13th (the Black Lion
// Commemorative Sprocket dead vendor path) is what discontinued.json is for.
//
// Network: reads api.guildwars2.com. Mismatches fail (exit 1); an unreachable
// API skips with a loud notice (exit 0) so an ArenaNet outage can't block CI.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonComponent, SUPERSEDED_BY_CURRENCY } from './aliases'
import { CATALOG } from '../../src/data/recipes'
import { CURRENCY_BASE, SYNTHETIC_BASE } from '../../src/data/items'

const HERE = dirname(fileURLToPath(import.meta.url))
const UA = { 'User-Agent': 'gw2-loadout-wikisync/1.0 (id gate; contact: project maintainer)' }

interface Ref {
  name: string
  id?: number | null
  currency?: number
  where: string
}

/** Collect every name+id / name+currency reference from the generated tables. */
function generatedRefs(): Ref[] {
  const refs: Ref[] = []
  const gen = (f: string) => JSON.parse(readFileSync(join(HERE, '../../src/data/recipes/generated', f), 'utf8'))

  const gifts = gen('gifts.generated.json') as Record<string, { name: string; id: number | null; inputs: Ref[] }>
  for (const [k, e] of Object.entries(gifts)) {
    refs.push({ name: e.name, id: e.id, where: `gifts:${k}` })
    for (const i of e.inputs) refs.push({ ...i, where: `gifts:${k}` })
  }
  const crafted = gen('crafted.generated.json') as Record<string, { name: string; id: number | null; inputs: Ref[] }>
  for (const [k, e] of Object.entries(crafted)) {
    refs.push({ name: e.name, id: e.id, where: `crafted:${k}` })
    for (const i of e.inputs) refs.push({ ...i, where: `crafted:${k}` })
  }
  const vendor = gen('vendor-costs.generated.json') as Record<string, Ref[]>
  for (const [k, costs] of Object.entries(vendor)) for (const c of costs) refs.push({ ...c, where: `vendor:${k}` })
  return refs
}

/** Collect every real-item reference the assembled catalog exposes (curated TS
 * + expansions) — the superset the UI can actually render. */
function catalogRefs(): Ref[] {
  const refs: Ref[] = []
  for (const piece of CATALOG) {
    for (const n of piece.recipe.nodes) {
      for (const r of [n.output, ...n.inputs]) {
        if (r.itemId >= CURRENCY_BASE && r.itemId < SYNTHETIC_BASE)
          refs.push({ name: r.name, currency: r.itemId - CURRENCY_BASE, where: `catalog:${piece.name}` })
        else if (r.itemId < CURRENCY_BASE) refs.push({ name: r.name, id: r.itemId, where: `catalog:${piece.name}` })
      }
    }
  }
  return refs
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: UA })
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function main(): Promise<void> {
  const discontinued = JSON.parse(readFileSync(join(HERE, 'discontinued.json'), 'utf8')) as {
    items: { id: number; name: string }[]
  }
  const deadIds = new Map(discontinued.items.map((i) => [i.id, i.name]))
  const deadNames = new Set(discontinued.items.map((i) => canonComponent(i.name)))

  const refs = [...generatedRefs(), ...catalogRefs()]

  // Dedupe: one check per (id|currency, canonical name) pair; remember one witness.
  const byItem = new Map<string, Ref>()
  for (const r of refs) {
    if (r.id == null && r.currency == null) continue
    const key = r.currency != null ? `c${r.currency}:${canonComponent(r.name)}` : `i${r.id}:${canonComponent(r.name)}`
    if (!byItem.has(key)) byItem.set(key, r)
  }
  const checks = [...byItem.values()]
  const itemIds = [...new Set(checks.filter((r) => r.id != null).map((r) => r.id!))]
  console.log(`wiki:ids — checking ${checks.length} distinct name↔id pairs (${itemIds.length} item ids) against the GW2 API …`)

  let apiNames: Map<number, string>
  let currencyNames: Map<number, string>
  try {
    apiNames = new Map()
    for (let i = 0; i < itemIds.length; i += 200) {
      const chunk = itemIds.slice(i, i + 200)
      const items = (await fetchJson(`https://api.guildwars2.com/v2/items?ids=${chunk.join(',')}`)) as
        | { id: number; name: string }[]
        | { text?: string }
      if (Array.isArray(items)) for (const it of items) apiNames.set(it.id, it.name)
    }
    const curs = (await fetchJson('https://api.guildwars2.com/v2/currencies?ids=all')) as { id: number; name: string }[]
    currencyNames = new Map(curs.map((c) => [c.id, c.name]))
  } catch (err) {
    console.warn(`\nWIKI IDS SKIPPED ⚠️  — GW2 API unreachable (${(err as Error).message}). Re-run when it is back.`)
    return
  }

  const failures: string[] = []
  for (const r of checks) {
    const canon = canonComponent(r.name)
    if (r.currency != null) {
      const apiName = currencyNames.get(r.currency)
      if (apiName == null) {
        failures.push(`${r.where}: "${r.name}" references currency ${r.currency}, which /v2/currencies does not list`)
      } else if (canonComponent(apiName) !== canon) {
        failures.push(`${r.where}: "${r.name}" (currency ${r.currency}) — API names that currency "${apiName}"`)
      }
      continue
    }
    const id = r.id!
    if (deadIds.has(id) || deadNames.has(canon)) {
      failures.push(`${r.where}: "${r.name}" (id ${id}) is a DISCONTINUED tender (discontinued.json) — dead acquisition path`)
      continue
    }
    if (SUPERSEDED_BY_CURRENCY[canon]) {
      failures.push(
        `${r.where}: "${r.name}" (id ${id}) was converted to wallet currency ${SUPERSEDED_BY_CURRENCY[canon].currency} — reference the currency, not the retired item`,
      )
      continue
    }
    const apiName = apiNames.get(id)
    if (apiName == null) {
      failures.push(`${r.where}: "${r.name}" claims item id ${id}, which /v2/items does not know`)
    } else if (canonComponent(apiName) !== canon) {
      failures.push(`${r.where}: "${r.name}" (id ${id}) — the API names that item "${apiName}"`)
    }
  }

  if (!failures.length) {
    console.log(`WIKI IDS PASSED ✅ — every referenced id matches its API name; no discontinued tenders referenced.`)
    return
  }
  console.error(`\nWIKI IDS FAILED ❌ — ${failures.length} bad reference(s):\n`)
  for (const f of failures.sort()) console.error(`  ${f}`)
  console.error(
    '\nFix the id (wiki Item infobox / itemInfoboxId), alias a legitimate name variant in aliases.ts, ' +
      'or route a converted item through SUPERSEDED_BY_CURRENCY.',
  )
  process.exit(1)
}

main().catch((err) => {
  console.error('wiki:ids failed:', err)
  process.exit(1)
})
