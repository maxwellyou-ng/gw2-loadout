// ---------------------------------------------------------------------------
// `npm run wiki:fix` (a.k.a. `npm run wiki:report -- --apply`) — the auto-fixer.
//
// Regenerates the machine-owned recipe layer (src/data/recipes/generated/) for
// every legendary the wiki lists but the curated catalog is MISSING, as long as
// the wiki recipe parsed cleanly (high confidence, real API id, non-empty
// top-level recipe, and not an armor *set*). Every generated piece ships
// `verified: false` — a reviewable draft, never silently trusted.
//
// Safety machinery (this is the whole point of the command):
//   1. snapshot the files it will touch (generated JSON + baseline.json),
//   2. write the regenerated layer,
//   3. validate: `tsc -b`, `npm run check`, `npm run wiki:check`,
//   4. on ANY failure -> restore the snapshots and exit non-zero (never leave a
//      half-written catalog),
//   5. on success -> auto-prune baseline acks the fix resolved, and print a
//      reviewable summary. The JSON diff is the human's review surface.
//
//   npm run wiki:fix              # generate + validate + apply
//   npm run wiki:fix -- --dry-run # report what would be generated; write nothing
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { GENERATED_SYNTHETIC_BASE } from '../../src/data/items'
import type { LegendaryPiece, RecipeNode, SlotFamily } from '../../src/types'
import { canonComponent, canonPiece } from './aliases'
import { catalogPieces } from './catalog-view'
import { readBaseline, readSnapshot, writeBaseline } from './store'
import { CATEGORIES, type Category, type SnapshotEntry } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(HERE, '..', '..')
const GENERATED_JSON = join(
  PROJECT_ROOT,
  'src',
  'data',
  'recipes',
  'generated',
  'recipes.generated.json',
)
const BASELINE_JSON = join(HERE, 'baseline.json')

const CATEGORY_TO_FAMILY: Record<Category, SlotFamily> = {
  weapons: 'weapon',
  armor: 'armor',
  trinkets: 'trinket',
  backs: 'back',
}

const GEN_SYN_SPAN = 500_000 // [9_500_000, 10_000_000) — see items.ts namespace doc

/**
 * Deterministically mint a generated synthetic id from a component's canonical
 * name (FNV-1a). Keying on the canonical name means shared gifts ("Gift of
 * Fortune") get the same id everywhere, so the aggregate view de-dups them,
 * while per-piece gifts stay distinct. Lives in the [9.5M, 10M) sub-range so it
 * can never collide with a curated synthetic id.
 */
function genSyntheticId(canonName: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < canonName.length; i++) {
    h ^= canonName.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return GENERATED_SYNTHETIC_BASE + (Math.abs(h | 0) % GEN_SYN_SPAN)
}

/** An armor *set* entry (e.g. "Ardent Glorious armor") — never auto-written. */
function isArmorSet(entry: SnapshotEntry): boolean {
  return entry.slot === 'armor' && /\barmor$/i.test(entry.name.trim())
}

/** Can this wiki entry be turned into a trustworthy verified:false draft? */
function isGeneratable(entry: SnapshotEntry): boolean {
  return (
    entry.confidence === 'high' &&
    entry.apiId != null &&
    entry.components.length > 0 &&
    !isArmorSet(entry)
  )
}

function buildPiece(entry: SnapshotEntry, category: Category): LegendaryPiece {
  const id = entry.apiId as number
  const inputs = entry.components.map((c) => ({
    itemId: genSyntheticId(canonComponent(c.name)),
    name: c.name,
    qty: c.qty,
  }))
  const node: RecipeNode = {
    output: { itemId: id, name: entry.name, qty: 1 },
    inputs,
    source: 'mystic-forge',
    buyable: false,
    timeGate: { isGated: false },
    notes:
      'Auto-generated from the wiki snapshot. Top-level components only, ' +
      'synthetic ids pending resolution. verified:false until reviewed.',
  }
  return {
    id,
    name: entry.name,
    slot: CATEGORY_TO_FAMILY[category],
    type: entry.type ?? '',
    acquisitionMode: 'crafting',
    unlocks: [id],
    recipe: {
      rootItemId: id,
      nodes: [node],
      verified: false,
      wikiUrl: entry.wikiUrl,
      version: 1,
    },
    blurb: `Auto-generated draft from the GW2 Wiki (${entry.generation ?? 'unknown generation'}). Unverified.`,
  }
}

interface Plan {
  pieces: LegendaryPiece[]
  skipped: { name: string; reason: string }[]
}

/** Pure: decide what to generate by diffing every snapshot against the catalog. */
function plan(): Plan {
  const cat = catalogPieces()
  const catNames = new Set(cat.map((p) => canonPiece(p.name)))
  const catIds = new Set(cat.map((p) => p.id))

  const pieces: LegendaryPiece[] = []
  const skipped: { name: string; reason: string }[] = []

  for (const category of CATEGORIES) {
    const snap = readSnapshot(category)
    if (!snap) continue
    for (const entry of snap.entries) {
      if (catNames.has(canonPiece(entry.name))) continue // catalog already has it
      if (!isGeneratable(entry)) {
        const reason = isArmorSet(entry)
          ? 'armor set (no clean per-piece recipe)'
          : entry.apiId == null
            ? 'no wiki API id'
            : entry.confidence !== 'high'
              ? `low confidence (${entry.parseNote ?? 'unparsed'})`
              : 'empty top-level recipe'
        skipped.push({ name: entry.name, reason })
        continue
      }
      if (entry.apiId != null && catIds.has(entry.apiId)) continue // id already curated
      pieces.push(buildPiece(entry, category))
    }
  }

  pieces.sort((a, b) => a.name.localeCompare(b.name))
  return { pieces, skipped }
}

function run(cmd: string): void {
  execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'inherit' })
}

function runFix(dryRun: boolean): void {
  const { pieces, skipped } = plan()

  console.log(`wiki:fix — ${pieces.length} draft(s) to generate, ${skipped.length} skipped.\n`)
  if (pieces.length) {
    console.log('Would generate (verified:false drafts):')
    for (const p of pieces) {
      const comps = p.recipe.nodes[0]?.inputs.length ?? 0
      console.log(`  + ${p.name}  (api ${p.id}, ${comps} components)`)
    }
    console.log('')
  }
  if (skipped.length) {
    console.log('Skipped (routed to the manual/curated lane):')
    for (const s of skipped.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  - ${s.name} — ${s.reason}`)
    }
    console.log('')
  }

  if (dryRun) {
    console.log('Dry run — nothing written. Re-run without --dry-run to apply.')
    return
  }
  if (pieces.length === 0) {
    console.log('Nothing to generate; catalog already covers every generatable wiki entry.')
    return
  }

  // --- 1. snapshot the files we will touch, for revert-on-failure -----------
  const prevGenerated = existsSync(GENERATED_JSON) ? readFileSync(GENERATED_JSON, 'utf8') : null
  const prevBaseline = existsSync(BASELINE_JSON) ? readFileSync(BASELINE_JSON, 'utf8') : null

  // --- 2. write the regenerated layer ---------------------------------------
  writeFileSync(GENERATED_JSON, JSON.stringify(pieces, null, 2) + '\n')

  // --- 3. validate; revert everything on ANY failure ------------------------
  try {
    console.log('Validating generated catalog (tsc -b, npm run check, npm run wiki:check)…\n')
    run('npx tsc -b')
    run('npm run check')
    run('npm run wiki:check')
  } catch {
    console.error('\n❌ Validation failed — reverting all writes (no half-written catalog).')
    if (prevGenerated != null) writeFileSync(GENERATED_JSON, prevGenerated)
    else writeFileSync(GENERATED_JSON, '[]\n')
    if (prevBaseline != null) writeFileSync(BASELINE_JSON, prevBaseline)
    process.exit(1)
  }

  // --- 4. auto-prune baseline acks the fix resolved -------------------------
  // The newly-authored drafts are no longer MISSING, so their acknowledgedMissing
  // entries are stale. Prune exactly the names we just generated. (We can't ask
  // the live catalog here — the generated JSON was imported statically at module
  // load, so this process still sees the pre-write catalog; the child-process
  // validation above is what reconciles against the freshly written file.)
  const resolvedNames = new Set(pieces.map((p) => canonPiece(p.name)))
  const baseline = readBaseline()
  const keptMissing = baseline.acknowledgedMissing.filter(
    (n) => !resolvedNames.has(canonPiece(n)),
  )
  const prunedCount = baseline.acknowledgedMissing.length - keptMissing.length
  if (prunedCount > 0) {
    writeBaseline({ ...baseline, acknowledgedMissing: keptMissing })
    console.log(`\nPruned ${prunedCount} resolved entr(y/ies) from baseline.acknowledgedMissing.`)
  }

  console.log(
    `\n✅ wiki:fix applied — ${pieces.length} verified:false draft(s) written to ` +
      'src/data/recipes/generated/recipes.generated.json.',
  )
  console.log('Review the JSON diff, then promote individual recipes to verified:true as you confirm them.')
}

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')

// Run when invoked directly (npm run wiki:fix) or imported by report --apply.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) runFix(dryRun)

export { runFix }
