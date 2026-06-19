// ---------------------------------------------------------------------------
// `npm run wiki:fetch` — refresh the committed snapshot from the live wiki.
//
// For each category: enumerate the legendaries (Phase A), then fetch + parse
// each item's recipe (Phase B), and write snapshot/<category>.json. Curated
// entries are preserved (never overwritten); if their upstream wikitext changed
// since curation, we warn so a human can re-check. This is the only script that
// performs network I/O or writes snapshots.
//
//   npm run wiki:fetch                 # all categories, using the disk cache
//   npm run wiki:fetch -- --no-cache   # force re-download
//   npm run wiki:fetch -- --only=weapons,trinkets
// ---------------------------------------------------------------------------

import { CATEGORIES, LIST_PAGES, type Category, type SnapshotEntry, type SnapshotFile } from './types'
import { enumerateCategory } from './parse-list'
import { parseItemPage } from './parse-recipe'
import { fetchWikitext, hashText } from './fetch'
import { readSnapshot, writeSnapshot } from './store'

interface Args {
  noCache: boolean
  only: Category[] | null
}

function parseArgs(argv: string[]): Args {
  let noCache = false
  let only: Category[] | null = null
  for (const a of argv) {
    if (a === '--no-cache') noCache = true
    else if (a.startsWith('--only=')) {
      only = a
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is Category => (CATEGORIES as string[]).includes(s))
    }
  }
  return { noCache, only }
}

async function buildCategory(category: Category, noCache: boolean): Promise<SnapshotFile> {
  const previous = readSnapshot(category)
  const curated = new Map<string, SnapshotEntry>()
  for (const e of previous?.entries ?? []) {
    if (e.source === 'curated') curated.set(e.name.toLowerCase(), e)
  }

  console.log(`\n[${category}] enumerating ${LIST_PAGES[category]} …`)
  const { entries: listed, sourcePages } = await enumerateCategory(
    category,
    LIST_PAGES[category],
    { noCache },
  )
  console.log(`[${category}] ${listed.length} legendaries listed`)

  const out: SnapshotEntry[] = []
  for (const item of listed) {
    const existingCurated = curated.get(item.name.toLowerCase())

    // Fetch the item page (recipe + infobox id). Tolerate per-item failure.
    let page
    try {
      page = await fetchWikitext(item.name, { noCache })
    } catch (err) {
      console.warn(`  ! ${item.name}: fetch failed (${(err as Error).message}) — keeping prior/low-confidence`)
      out.push(
        existingCurated ?? {
          name: item.name,
          apiId: null,
          slot: category,
          type: item.type,
          generation: item.generation,
          wikiUrl: item.wikiUrl,
          confidence: 'low',
          source: 'auto',
          wikitextHash: null,
          components: [],
          parseNote: 'item page fetch failed',
        },
      )
      continue
    }

    if (existingCurated) {
      // Preserve human-curated data; warn if upstream changed since curation.
      if (existingCurated.wikitextHash && existingCurated.wikitextHash !== page.hash) {
        console.warn(
          `  ~ ${item.name}: CURATED entry — wiki page changed since curation; re-verify`,
        )
      }
      out.push(existingCurated)
      continue
    }

    const parsed = parseItemPage(page.wikitext)
    out.push({
      name: item.name,
      apiId: parsed.apiId,
      slot: category,
      type: item.type,
      generation: item.generation,
      wikiUrl: item.wikiUrl,
      confidence: parsed.confidence,
      source: 'auto',
      wikitextHash: hashText(page.wikitext),
      components: parsed.components,
      parseNote: parsed.parseNote,
    })
    const tag = parsed.confidence === 'high' ? `${parsed.components.length} comps` : `LOW: ${parsed.parseNote}`
    console.log(`  • ${item.name} (id ${parsed.apiId ?? '—'}) — ${tag}`)
  }

  return {
    category,
    generatedAt: new Date().toISOString(),
    sourcePages,
    entries: out,
  }
}

async function main() {
  const { noCache, only } = parseArgs(process.argv.slice(2))
  const targets = only ?? CATEGORIES
  for (const category of targets) {
    const file = await buildCategory(category, noCache)
    writeSnapshot(file)
    const high = file.entries.filter((e) => e.confidence === 'high').length
    console.log(`[${category}] wrote ${file.entries.length} entries (${high} high-confidence)`)
  }
  console.log('\nSnapshot refresh complete. Review the git diff, then run: npm run wiki:report')
}

main().catch((err) => {
  console.error('wiki:fetch failed:', err)
  process.exit(1)
})
