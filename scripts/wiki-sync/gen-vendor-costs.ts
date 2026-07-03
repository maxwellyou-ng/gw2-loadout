// ---------------------------------------------------------------------------
// `npm run wiki:vendor-costs` — extract the purchase cost of every vendor gift.
//
// Vendor gifts ({{Sold by}}) don't carry their cost in wikitext — it's rendered
// server-side into the page's *Acquisition* table. So we fetch the RENDERED HTML
// (action=parse&prop=text), find the table's "Cost" column, and read the amounts
// + currency/item icons (each icon's `alt` is its name). Currencies resolve to
// GW2 wallet ids (/v2/currencies); coins fold into copper; anything else is an
// item tender recorded by name (id resolved where possible, else left for review).
//
// Output: src/data/recipes/generated/vendor-costs.generated.json — keyed by gift
// canonical name → [{ name, qty, currency?: walletId, id?: itemId|null }]. The
// runtime (buildGiftSubTree) merges these as tracked leaves so vendor gifts
// expand to show what they cost. Gifts whose cost can't be parsed cleanly are
// printed as a "needs review" list for a manual pass.
//
// Maintainer tool, run after game updates. NOT part of the build gate.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonComponent } from './aliases'
import { fetchWikitext } from './fetch'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, 'cache-html')
const API = 'https://wiki.guildwars2.com/api.php'
const UA = 'gw2-loadout-wikisync/1.0 (legendary recipe reconciliation; contact: project maintainer)'
const DELAY_MS = 300
const GIFTS_PATH = resolve(HERE, '../../src/data/recipes/generated/gifts.generated.json')
const OUT_PATH = resolve(HERE, '../../src/data/recipes/generated/vendor-costs.generated.json')

interface CostComponent {
  name: string
  qty: number
  currency?: number
  id?: number | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let lastRequest = 0

/** Fetch a page's rendered HTML (cached on disk). */
async function fetchHtml(page: string, noCache: boolean): Promise<string> {
  const safe = page.replace(/[^a-z0-9]+/gi, '_').slice(0, 120)
  const h = createHash('sha1').update(page).digest('hex').slice(0, 8)
  const path = join(CACHE_DIR, `${safe}.${h}.json`)
  if (!noCache && existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')).html

  const wait = DELAY_MS - (Date.now() - lastRequest)
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()
  const url = `${API}?action=parse&prop=text&format=json&redirects=1&page=${encodeURIComponent(page)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { error?: { info?: string }; parse?: { text: { '*': string } } }
  if (json.error || !json.parse) throw new Error(json.error?.info ?? 'no parse result')
  const html = json.parse.text['*']
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(path, JSON.stringify({ html }, null, 2))
  return html
}

/** GW2 wallet currency name (lowercased) → id, plus coin aliases. */
async function currencyMap(): Promise<Map<string, number>> {
  const res = await fetch('https://api.guildwars2.com/v2/currencies?ids=all', { headers: { 'User-Agent': UA } })
  const list = (await res.json()) as { id: number; name: string }[]
  const m = new Map<string, number>()
  for (const c of list) m.set(c.name.toLowerCase(), c.id)
  m.set('gold coin', 1)
  m.set('silver coin', 1)
  m.set('copper coin', 1)
  return m
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim()
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')

/** Coin denomination multiplier to copper, or null if not a coin. */
function coinScale(alt: string): number | null {
  const a = alt.toLowerCase()
  if (a === 'gold coin') return 10000
  if (a === 'silver coin') return 100
  if (a === 'copper coin') return 1
  return null
}

/**
 * Parse the cost(s) from a gift's rendered Acquisition table. Finds the table
 * with a "Cost" column, reads the first data row whose Cost cell parses cleanly,
 * and zips its amounts with its currency/item icons.
 */
function parseVendorCost(html: string, currencies: Map<string, number>): CostComponent[] | null {
  for (const tableMatch of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const table = tableMatch[0]
    const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => stripTags(m[1]).toLowerCase())
    const costIdx = headers.indexOf('cost')
    if (costIdx < 0 || !headers.includes('vendor')) continue

    for (const rowMatch of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])
      if (cells.length <= costIdx) continue
      const cell = cells[costIdx]
      const alts = [...cell.matchAll(/alt="([^"]+)"/g)].map((m) => decode(m[1]))
      const amounts = (stripTags(cell).match(/[\d,]+/g) || []).map((x) => Number(x.replace(/,/g, '')))
      if (!alts.length || amounts.length < alts.length) continue

      let copper = 0
      const out: CostComponent[] = []
      alts.forEach((alt, i) => {
        const qty = amounts[i]
        const scale = coinScale(alt)
        if (scale != null) {
          copper += qty * scale
          return
        }
        const cur = currencies.get(alt.toLowerCase())
        if (cur != null) out.push({ name: alt, qty, currency: cur })
        else out.push({ name: alt, qty, id: null }) // item tender — id resolved later / in review
      })
      if (copper > 0) out.push({ name: 'Coin', qty: copper, currency: 1 })
      if (out.length) return out
    }
  }
  return null
}

async function main(): Promise<void> {
  const noCache = process.argv.includes('--no-cache')
  const table = JSON.parse(readFileSync(GIFTS_PATH, 'utf8')) as Record<string, { name: string; acq: string }>
  const vendorGifts = Object.values(table).filter((e) => e.acq === 'vendor')
  console.log(`Extracting vendor costs for ${vendorGifts.length} vendor gifts …\n`)

  const currencies = await currencyMap()
  const overlay: Record<string, CostComponent[]> = {}
  const needsReview: string[] = []
  const itemTenders = new Set<string>()

  for (const g of vendorGifts) {
    let cost: CostComponent[] | null = null
    try {
      cost = parseVendorCost(await fetchHtml(g.name, noCache), currencies)
    } catch (err) {
      console.warn(`  ! ${g.name}: ${(err as Error).message}`)
    }
    if (cost && cost.length) {
      overlay[canonComponent(g.name)] = cost
      cost.filter((c) => c.currency == null).forEach((c) => itemTenders.add(c.name))
    } else {
      needsReview.push(g.name)
    }
  }

  // Resolve real item ids for item tenders (non-currency costs) from each item's
  // wiki infobox (`| id = NNNNN`), so map materials track against inventory too.
  const idByName = new Map<string, number>()
  const unresolved: string[] = []
  for (const name of [...itemTenders].sort()) {
    try {
      const { wikitext } = await fetchWikitext(name)
      const m = wikitext.match(/\|\s*id\s*=\s*(\d+)/i)
      if (m) idByName.set(name, Number(m[1]))
      else unresolved.push(name)
    } catch {
      unresolved.push(name)
    }
  }
  for (const cost of Object.values(overlay)) {
    for (const c of cost) {
      if (c.currency == null && idByName.has(c.name)) c.id = idByName.get(c.name)!
    }
  }

  const ordered = Object.fromEntries(Object.entries(overlay).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(OUT_PATH, JSON.stringify(ordered, null, 2) + '\n')

  console.log(`\n✅ ${Object.keys(ordered).length} vendor costs → ${OUT_PATH}`)
  console.log(`   item tenders: ${idByName.size} resolved to real ids, ${unresolved.length} unresolved (id:null → synthetic leaf)`)
  if (unresolved.length) console.log(`   unresolved: ${unresolved.join(', ')}`)
  console.log(`\n   NEEDS MANUAL REVIEW (no parseable cost) — ${needsReview.length}:\n   ${needsReview.sort().join(', ') || '(none)'}`)
}

main().catch((err) => {
  console.error('wiki:vendor-costs failed:', err)
  process.exit(1)
})
