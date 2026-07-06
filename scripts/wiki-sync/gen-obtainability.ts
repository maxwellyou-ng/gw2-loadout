// ---------------------------------------------------------------------------
// `npm run wiki:obtainable` — obtainability audit over every real-item leaf in
// the golden totals (i.e. everything the UI actually tells a player to save).
// Fetches each leaf's wiki page and flags:
//
//   - {{historical}}-marked pages and "no longer obtainable/available" notices
//   - "discontinued" mentions (context printed for judgment)
//   - disambiguation pages (the tracked name is ambiguous — check the id)
//   - tenders recorded in discontinued.json
//   - gem-store-container-only acquisition (has "Gem Store", no {{Sold by}} /
//     {{Recipe}}) — the Black Lion Commemorative Sprocket case: such items are
//     NOT wiki-marked historical when their container simply left the store,
//     which is exactly why this heuristic and the denylist exist.
//
// Maintainer review tool, run after game updates alongside the gen-* scripts:
// it prints a review list and always exits 0 — a human decides whether a flag
// is a dead path (add to discontinued.json + fix the recipe) or a false alarm.
// First full audit: 2026-07-05 (300 leaves; 1 dead tender, 12 wrong ids found).
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonComponent } from './aliases'
import { fetchWikitext } from './fetch'
import { CATALOG } from '../../src/data/recipes'
import { CURRENCY_BASE } from '../../src/data/items'

const HERE = dirname(fileURLToPath(import.meta.url))
const GOLDEN_PATH = join(HERE, 'golden-totals.json')

interface Flag {
  id: number
  name: string
  marks: string[]
}

function leafNames(): Map<number, string> {
  // Golden totals hold the leaf ids; the catalog nodes carry their display names.
  const nameById = new Map<number, string>()
  for (const piece of CATALOG)
    for (const n of piece.recipe.nodes) for (const r of [n.output, ...n.inputs]) if (!nameById.has(r.itemId)) nameById.set(r.itemId, r.name)

  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Record<string, { leaves: Record<string, number> }>
  const leaves = new Map<number, string>()
  for (const e of Object.values(golden)) {
    for (const idStr of Object.keys(e.leaves)) {
      const id = Number(idStr)
      if (id >= CURRENCY_BASE) continue // currencies + synthetics: not wiki-page items
      const name = nameById.get(id)
      if (name && !leaves.has(id)) leaves.set(id, name)
    }
  }
  return leaves
}

function inspect(wikitext: string, canon: string, dead: ReadonlySet<string>): string[] {
  const low = wikitext.toLowerCase()
  const marks: string[] = []
  if (dead.has(canon)) marks.push('recorded in discontinued.json')
  if (/\{\{\s*historical/i.test(wikitext)) marks.push('{{historical}} template')
  const gone = low.match(/no longer (?:be )?(?:obtainable|available|obtained|acquirable)/)
  if (gone) marks.push(`"${gone[0]}" notice`)
  const disc = low.indexOf('discontinued')
  if (disc >= 0) marks.push(`"discontinued" mention: …${wikitext.slice(Math.max(0, disc - 60), disc + 60).replace(/\s+/g, ' ')}…`)
  if (/^\s*\{\{\s*disambig/i.test(wikitext)) marks.push('DISAMBIGUATION page — tracked name is ambiguous')
  if (/gem store/i.test(wikitext) && !/\{\{\s*sold by/i.test(wikitext) && !/\{\{\s*recipe\s*[\n|]/i.test(wikitext))
    marks.push('gem-store-container acquisition only — verify the container is currently sold')
  return marks
}

async function main(): Promise<void> {
  const noCache = process.argv.includes('--no-cache')
  const dead = new Set(
    (JSON.parse(readFileSync(join(HERE, 'discontinued.json'), 'utf8')) as { items: { name: string }[] }).items.map((i) =>
      canonComponent(i.name),
    ),
  )
  const leaves = leafNames()
  console.log(`wiki:obtainable — auditing ${leaves.size} real-item leaves from the golden totals …\n`)

  const flags: Flag[] = []
  const unreachable: string[] = []
  for (const [id, name] of [...leaves.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    try {
      const { wikitext } = await fetchWikitext(name, { noCache })
      const marks = inspect(wikitext, canonComponent(name), dead)
      if (marks.length) flags.push({ id, name, marks })
    } catch (err) {
      unreachable.push(`${name} (id ${id}): ${(err as Error).message}`)
    }
  }

  if (flags.length) {
    console.log(`NEEDS REVIEW — ${flags.length} leaf item(s):\n`)
    for (const f of flags) {
      console.log(`  ${f.name} (id ${f.id})`)
      for (const m of f.marks) console.log(`    - ${m}`)
    }
    console.log(
      '\nFor each: confirm on the wiki whether a live acquisition path exists. Dead path → add the item to ' +
        'discontinued.json and repoint the recipe (gen-vendor-costs override / recipe fix); false alarm → ignore.',
    )
  } else {
    console.log('OBTAINABILITY CLEAN ✅ — no leaf carries a historical/discontinued/ambiguity marker.')
  }
  if (unreachable.length) {
    console.log(`\nNo wiki page found (name↔page drift or fetch error) — ${unreachable.length}:`)
    for (const u of unreachable) console.log(`  ${u}`)
  }
}

main().catch((err) => {
  console.error('wiki:obtainable failed:', err)
  process.exit(1)
})
