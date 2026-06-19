// `npm run wiki:links` — validate every wiki link the app can render. The UI
// links each item by name via lib/format.ts `wikiUrl` (trailing parenthetical
// stripped). This collects every distinct name across the catalog (piece roots,
// every recipe node output + input) and asks the MediaWiki query API, in batches,
// which titles are MISSING (broken link) or REDIRECTED (a rename the catalog
// should follow). Network, read-only; not part of the build gate.

import https from 'node:https'
import { CATALOG } from '../../src/data/recipes'
import { wikiUrl } from '../../src/lib/format'

/** The exact title the app links to (decoded from the real wikiUrl helper). */
const linkTitle = (name: string): string | null => {
  const url = wikiUrl(name)
  if (!url) return null
  return decodeURIComponent(url.replace('https://wiki.guildwars2.com/wiki/', '').replace(/_/g, ' '))
}

// Collect every distinct title the app actually links to (via lib/format.ts).
const titles = new Set<string>()
const add = (name: string) => { const t = linkTitle(name); if (t) titles.add(t) }
for (const piece of CATALOG) {
  add(piece.name)
  for (const n of piece.recipe.nodes) {
    add(n.output.name)
    for (const i of n.inputs) add(i.name)
  }
}
titles.delete('')
const all = [...titles].sort()
console.log(`Checking ${all.length} distinct wiki links …\n`)

/** Shape of the slice of the MediaWiki `action=query` response we read. */
interface WikiQueryResponse {
  query?: {
    redirects?: { from: string; to: string }[]
    normalized?: { from: string; to: string }[]
    pages?: Record<string, { title: string; pageid?: number; missing?: string }>
  }
}

function query(batch: string[]): Promise<WikiQueryResponse> {
  const u =
    'https://wiki.guildwars2.com/api.php?action=query&format=json&redirects=1&titles=' +
    encodeURIComponent(batch.join('|'))
  return new Promise((res, rej) => {
    https.get(u, { headers: { 'User-Agent': 'gw2-loadout-tracker/1.0 (link check)' } }, (r) => {
      let d = ''
      r.on('data', (c) => (d += c))
      r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const missing: string[] = []
const redirects: { from: string; to: string }[] = []
const normalized: { from: string; to: string }[] = []

for (let i = 0; i < all.length; i += 40) {
  const batch = all.slice(i, i + 40)
  const j = await query(batch)
  const q: NonNullable<WikiQueryResponse['query']> = j.query ?? {}
  for (const r of q.redirects ?? []) redirects.push({ from: r.from, to: r.to })
  for (const n of q.normalized ?? []) normalized.push({ from: n.from, to: n.to })
  for (const p of Object.values(q.pages ?? {})) {
    if (p.missing !== undefined || p.pageid === undefined) missing.push(p.title)
  }
  await sleep(150)
}

console.log(`🔗 Redirects (link works, but the wiki renamed the page — consider updating the name):`)
if (redirects.length === 0) console.log('  none')
for (const r of redirects) console.log(`  → "${r.from}"  ⇒  "${r.to}"`)

console.log(`\n❌ Missing pages (broken link — name is wrong or the page was deleted):`)
if (missing.length === 0) console.log('  none')
for (const m of missing.sort()) console.log(`  ✗ "${m}"`)

console.log(`\n${missing.length === 0 ? `LINK CHECK PASSED ✅ — all ${all.length} links resolve` : `${missing.length} BROKEN LINK(S) ❌`}` +
  (redirects.length ? ` (${redirects.length} redirect(s) to review)` : ''))
process.exit(missing.length === 0 ? 0 : 1)
