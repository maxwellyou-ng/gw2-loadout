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

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CATEGORIES,
  LIST_PAGES,
  type Category,
  type IntermediateEntry,
  type IntermediateSnapshotFile,
  type SnapshotEntry,
  type SnapshotFile,
} from './types'
import { enumerateCategory } from './parse-list'
import { parseItemPage } from './parse-recipe'
import { fetchWikitext, hashText, wikiUrl } from './fetch'
import { readSnapshot, writeSnapshot, writeIntermediates } from './store'
import { catalogIntermediates } from './catalog-view'
import { diffComponents, isCleanDiff } from './compare'

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

const HERE = dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = join(HERE, '..', '..', 'src', 'data', 'verified-intermediates.ts')

/**
 * Phase C: fetch + parse the wiki recipe page for every distinct catalog
 * intermediate (shared gift / sub-gift), write the committed snapshot, and emit
 * the app-facing manifest of intermediate names whose direct ingredients match
 * the wiki (so the detail tree can badge those nodes "verified"). An intermediate
 * only earns the manifest when its page parsed high-confidence AND diffs clean.
 */
async function buildIntermediates(noCache: boolean): Promise<{ total: number; verified: number }> {
  const intermediates = catalogIntermediates()
  console.log(`\n[intermediates] verifying ${intermediates.length} distinct shared gifts/sub-gifts …`)

  const entries: IntermediateEntry[] = []
  const verifiedNames: string[] = []

  for (const it of intermediates) {
    let page
    try {
      page = await fetchWikitext(it.name, { noCache })
    } catch (err) {
      console.warn(`  ! ${it.name}: fetch failed (${(err as Error).message}) — recorded low-confidence`)
      entries.push({
        name: it.name,
        apiId: null,
        syntheticId: it.syntheticId,
        wikiUrl: wikiUrl(it.name),
        confidence: 'low',
        wikitextHash: null,
        components: [],
        parseNote: 'item page fetch failed',
      })
      continue
    }

    const parsed = parseItemPage(page.wikitext)
    entries.push({
      name: it.name,
      apiId: parsed.apiId,
      syntheticId: it.syntheticId,
      wikiUrl: wikiUrl(it.name),
      confidence: parsed.confidence,
      wikitextHash: hashText(page.wikitext),
      components: parsed.components,
      parseNote: parsed.parseNote,
    })

    if (parsed.confidence === 'high' && parsed.components.length > 0) {
      const clean = isCleanDiff(diffComponents(parsed.components, it.inputs))
      if (clean) {
        verifiedNames.push(it.name)
        console.log(`  ✓ ${it.name} — matches wiki (${parsed.components.length} ingredients)`)
      } else {
        console.log(`  ✗ ${it.name} — DRIFT vs wiki (see npm run wiki:report)`)
      }
    } else {
      console.log(`  · ${it.name} — LOW: ${parsed.parseNote ?? 'no recipe'}`)
    }
  }

  const file: IntermediateSnapshotFile = {
    generatedAt: new Date().toISOString(),
    entries: entries.sort((a, b) => a.name.localeCompare(b.name)),
  }
  writeIntermediates(file)
  writeManifest(verifiedNames.sort())
  return { total: intermediates.length, verified: verifiedNames.length }
}

/** Emit src/data/verified-intermediates.ts — names matched exactly by the app. */
function writeManifest(names: string[]): void {
  const body =
    `// AUTO-GENERATED by \`npm run wiki:fetch\`. Do not edit by hand.\n` +
    `//\n` +
    `// Output names of crafted intermediates (shared gifts / sub-gifts) whose direct\n` +
    `// ingredients match the GW2 wiki recipe in the committed snapshot. The detail\n` +
    `// tree badges nodes whose output.name is in this set as wiki-verified; anything\n` +
    `// absent renders as unverified and must be cross-checked. Regenerate after game\n` +
    `// updates with \`npm run wiki:fetch\`.\n` +
    `export const VERIFIED_INTERMEDIATES: ReadonlySet<string> = new Set([\n` +
    names.map((n) => `  ${JSON.stringify(n)},`).join('\n') +
    (names.length ? '\n' : '') +
    `])\n`
  writeFileSync(MANIFEST_PATH, body)
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
  // Intermediates span all categories, so refresh them on a full run only.
  if (!only) {
    const { total, verified } = await buildIntermediates(noCache)
    console.log(`[intermediates] ${verified}/${total} verified against the wiki`)
  }
  console.log('\nSnapshot refresh complete. Review the git diff, then run: npm run wiki:report')
}

main().catch((err) => {
  console.error('wiki:fetch failed:', err)
  process.exit(1)
})
