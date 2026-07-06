// ---------------------------------------------------------------------------
// `npm run wiki:totals` — end-to-end totals verification (offline gate).
//
// wiki:check verifies each combine ONE level deep (root components + every
// distinct intermediate against its wiki page). This gate closes the loop on
// the numbers the app actually displays by verifying the MULTIPLICATION
// through the whole tree, two independent ways per piece:
//
//   1. WIKI vs CATALOG (data, full depth): expand the committed wiki snapshot
//      as a DAG (piece root components + intermediates.json recipes) and
//      multiply down to the catalog's modeling boundary; walk the catalog's
//      own recipe tree to the same boundary; the two canonical-name → total
//      maps must be identical. Any drift or multiplication slip anywhere in
//      the tree shows up as a per-leaf quantity diff.
//
//   2. ENGINE vs REFERENCE (math, full depth): the engine's flatten
//      (computeProgress against an empty snapshot → gross required per leaf
//      itemId) must equal an independent reference multiply of the same tree
//      implemented here with none of the engine's machinery.
//
// Pieces whose wiki pages carry no parseable recipe (armor sets are prose;
// Selachimorpha / Strife Unending have no {{recipe}}) are SKIPPED for check 1
// and listed explicitly — never silently omitted. Check 2 covers all pieces.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOG } from '../../src/data/recipes'
import { hasGiftRecipe } from '../../src/data/recipes/_builders'
import leafPolicy from '../../src/data/recipes/leaf-policy.json'
import fastAcquire from '../../src/data/recipes/fast-acquire.json'
import { collectGateCandidates } from './gate-candidates'
import { computeProgress } from '../../src/engine'
import { DEFAULT_WEIGHTS } from '../../src/types'
import type { LegendaryPiece, RecipeNode } from '../../src/types'
import { canonComponent, canonPiece } from './aliases'
import { readIntermediates, readSnapshot } from './store'
import { CATEGORIES } from './types'
import type { SnapshotEntry, WikiComponent } from './types'

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'golden-totals.json')

// --- Load the committed wiki snapshot ---------------------------------------

interface WikiRecipeMap {
  /** canon name → direct components (only high-confidence, non-empty). */
  recipes: Map<string, WikiComponent[]>
  /** piece lookup: canonPiece(name) and apiId → snapshot entry. */
  byName: Map<string, SnapshotEntry>
  byApiId: Map<number, SnapshotEntry>
}

function loadWiki(): WikiRecipeMap {
  const recipes = new Map<string, WikiComponent[]>()
  const byName = new Map<string, SnapshotEntry>()
  const byApiId = new Map<number, SnapshotEntry>()

  for (const category of CATEGORIES) {
    const snap = readSnapshot(category)
    if (!snap) continue
    for (const e of snap.entries) {
      byName.set(canonPiece(e.name), e)
      if (e.apiId != null) byApiId.set(e.apiId, e)
    }
  }
  const inter = readIntermediates()
  for (const e of inter?.entries ?? []) {
    if (e.confidence === 'high' && e.components.length > 0) {
      recipes.set(canonComponent(e.name), e.components)
    }
  }
  return { recipes, byName, byApiId }
}

// --- Path 1a: wiki-DAG flatten ----------------------------------------------

/** Multiply the wiki DAG down from `components`, stopping where the snapshot
 *  has no recipe (= the catalog's modeling boundary, by construction: the
 *  intermediates snapshot covers exactly the catalog's expanded nodes). */
function flattenWiki(
  components: WikiComponent[],
  recipes: Map<string, WikiComponent[]>,
): Map<string, number> {
  const out = new Map<string, number>()
  const walk = (name: string, qty: number, path: ReadonlySet<string>): void => {
    const canon = canonComponent(name)
    const children = recipes.get(canon)
    if (!children || path.has(canon)) {
      out.set(canon, (out.get(canon) ?? 0) + qty)
      return
    }
    const next = new Set(path)
    next.add(canon)
    for (const c of children) walk(c.name, qty * c.qty, next)
  }
  for (const c of components) walk(c.name, c.qty, new Set())
  return out
}

// --- Path 1b: catalog-tree flatten to the same boundary ----------------------

/** Walk the piece's own recipe tree, stopping at the identical boundary: a
 *  node is a leaf when the snapshot has no recipe for its canonical name
 *  (vendor gifts, base mats, summarized synthetics) or it has no inputs. */
function flattenCatalogToBoundary(
  piece: LegendaryPiece,
  recipes: Map<string, WikiComponent[]>,
): Map<string, number> {
  const nodeByOutput = new Map<number, RecipeNode>()
  for (const n of piece.recipe.nodes) nodeByOutput.set(n.output.itemId, n)

  const out = new Map<string, number>()
  const walk = (itemId: number, name: string, qty: number, isRoot: boolean, path: ReadonlySet<number>): void => {
    const node = nodeByOutput.get(itemId)
    const canon = canonComponent(name)
    const stop =
      !node || node.inputs.length === 0 || (!isRoot && !recipes.has(canon)) || path.has(itemId)
    if (stop) {
      out.set(canon, (out.get(canon) ?? 0) + qty)
      return
    }
    const per = node.output.qty || 1
    if (per !== 1) throw new Error(`${piece.name}: node ${name} outputs ${per} per craft — update flattenWiki to model output quantities before trusting this gate`)
    const next = new Set(path)
    next.add(itemId)
    for (const input of node.inputs) walk(input.itemId, input.name, qty * input.qty, false, next)
  }
  walk(piece.recipe.rootItemId, piece.name, 1, true, new Set())
  return out
}

// --- Path 2: reference full-depth flatten (engine math check) ----------------

function flattenReference(piece: LegendaryPiece): Map<number, number> {
  const nodeByOutput = new Map<number, RecipeNode>()
  for (const n of piece.recipe.nodes) nodeByOutput.set(n.output.itemId, n)
  const out = new Map<number, number>()
  const walk = (itemId: number, qty: number, path: ReadonlySet<number>): void => {
    const node = nodeByOutput.get(itemId)
    if (!node || node.inputs.length === 0 || path.has(itemId)) {
      out.set(itemId, (out.get(itemId) ?? 0) + qty)
      return
    }
    const next = new Set(path)
    next.add(itemId)
    for (const input of node.inputs) walk(input.itemId, qty * input.qty, next)
  }
  // Mirror the engine's entry point: expand the piece id itself. A piece with
  // no producing node (collection/vendor rewards like Selachimorpha) is its own
  // single tracked leaf, exactly as the engine records it.
  const root = nodeByOutput.get(piece.id)
  if (!root || root.inputs.length === 0) {
    out.set(piece.id, 1)
    return out
  }
  for (const input of root.inputs) walk(input.itemId, input.qty, new Set([piece.id]))
  return out
}

// --- Diff + report ------------------------------------------------------------

function diffMaps<K>(a: Map<K, number>, b: Map<K, number>): { key: K; a: number; b: number }[] {
  const keys = new Set<K>([...a.keys(), ...b.keys()])
  const out: { key: K; a: number; b: number }[] = []
  for (const k of keys) {
    const av = a.get(k) ?? 0
    const bv = b.get(k) ?? 0
    if (av !== bv) out.push({ key: k, a: av, b: bv })
  }
  return out
}

// --- Golden totals: committed regression snapshot of every displayed number ---

/** Per piece: engine leaf totals + the flags the buy-out / time-gate math
 *  hangs off. Any engine or recipe change that alters a displayed total shows
 *  up as a reviewable diff of this committed file instead of shipping silently.
 *  Re-bless intentionally with `npm run wiki:totals -- --update`. */
interface GoldenPiece {
  name: string
  leaves: Record<string, number>
  buyableIds: number[]
  timeGatedIds: number[]
}
type Golden = Record<string, GoldenPiece>

function currentGolden(): Golden {
  const out: Golden = {}
  for (const piece of [...CATALOG].sort((a, b) => a.id - b.id)) {
    const prog = computeProgress(piece, {}, {}, DEFAULT_WEIGHTS)
    const leaves: Record<string, number> = {}
    const buyableIds: number[] = []
    const timeGatedIds: number[] = []
    for (const m of [...prog.remainingMaterials].sort((a, b) => a.itemId - b.itemId)) {
      leaves[String(m.itemId)] = m.required
      if (m.buyable) buyableIds.push(m.itemId)
      if (m.timeGate.isGated) timeGatedIds.push(m.itemId)
    }
    out[String(piece.id)] = { name: piece.name, leaves, buyableIds, timeGatedIds }
  }
  return out
}

/** Compare committed golden vs current; returns human-readable drift lines. */
function goldenDrift(committed: Golden, current: Golden): string[] {
  const lines: string[] = []
  const ids = new Set([...Object.keys(committed), ...Object.keys(current)])
  for (const id of ids) {
    const a = committed[id]
    const b = current[id]
    if (!a) {
      lines.push(`+ ${b.name} (piece added)`)
      continue
    }
    if (!b) {
      lines.push(`- ${a.name} (piece removed)`)
      continue
    }
    const leafIds = new Set([...Object.keys(a.leaves), ...Object.keys(b.leaves)])
    for (const lid of leafIds) {
      const av = a.leaves[lid] ?? 0
      const bv = b.leaves[lid] ?? 0
      if (av !== bv) lines.push(`~ ${b.name}: leaf ${lid} required ${av} → ${bv}`)
    }
    const flagDiff = (label: string, xs: number[], ys: number[]): void => {
      const x = new Set(xs)
      const y = new Set(ys)
      for (const v of xs) if (!y.has(v)) lines.push(`~ ${b.name}: ${label} lost ${v}`)
      for (const v of ys) if (!x.has(v)) lines.push(`~ ${b.name}: ${label} gained ${v}`)
    }
    flagDiff('buyable', a.buyableIds, b.buyableIds)
    flagDiff('time-gated', a.timeGatedIds, b.timeGatedIds)
  }
  return lines
}

function main(): void {
  const update = process.argv.includes('--update')
  const wiki = loadWiki()
  let failures = 0
  let compared = 0
  const skipped: { name: string; reason: string }[] = []

  for (const piece of CATALOG) {
    // ---- Check 2 (all pieces): engine flatten == reference multiply --------
    const engine = new Map<number, number>()
    for (const m of computeProgress(piece, {}, {}, DEFAULT_WEIGHTS).remainingMaterials) {
      engine.set(m.itemId, m.required)
    }
    const reference = flattenReference(piece)
    const mathDiff = diffMaps(engine, reference)
    if (mathDiff.length > 0) {
      failures++
      console.error(`❌ ${piece.name}: engine flatten ≠ reference multiply`)
      for (const d of mathDiff.slice(0, 6)) console.error(`     item ${d.key}: engine ${d.a} vs reference ${d.b}`)
    }

    // ---- Check 1 (wiki-covered pieces): wiki DAG == catalog tree -----------
    const entry =
      wiki.byApiId.get(piece.recipe.rootItemId) ?? wiki.byName.get(canonPiece(piece.name))
    if (!entry) {
      skipped.push({ name: piece.name, reason: 'no wiki snapshot entry (weapon variant / misc slot)' })
      continue
    }
    if (entry.components.length === 0) {
      skipped.push({
        name: piece.name,
        reason: entry.parseNote ?? 'wiki page has no parseable {{recipe}} (prose armor set / vendor / collection)',
      })
      continue
    }

    const wikiTotals = flattenWiki(entry.components, wiki.recipes)
    const catalogTotals = flattenCatalogToBoundary(piece, wiki.recipes)
    const dataDiff = diffMaps(wikiTotals, catalogTotals)
    compared++
    if (dataDiff.length > 0) {
      failures++
      console.error(`❌ ${piece.name}: wiki totals ≠ catalog totals (${dataDiff.length} leaves differ)`)
      for (const d of dataDiff.slice(0, 6)) console.error(`     ${d.key}: wiki ${d.a} vs catalog ${d.b}`)
    }
  }

  // De-dup the skip list by name (weapon variants share entries).
  const skipByReason = new Map<string, string[]>()
  for (const s of skipped) {
    const list = skipByReason.get(s.reason) ?? []
    list.push(s.name)
    skipByReason.set(s.reason, list)
  }
  console.log(`\nwiki:totals — ${CATALOG.length} pieces: ${compared} full-depth wiki-compared, ${skipped.length} skipped, all ${CATALOG.length} engine-math-checked.`)
  if (skipped.length > 0) {
    console.log('Skipped for the wiki comparison (no parseable wiki recipe — the documented manual lane):')
    for (const [reason, names] of skipByReason) {
      console.log(`  • ${reason}:`)
      console.log(`      ${names.join(', ')}`)
    }
  }

  // ---- Check 3: leaf policy — nothing expandable may stay a leaf -------------
  // A material whose ingredients are required on every acquisition path (gift
  // recipes, itemized vendor costs, crafted intermediates) must never sit as an
  // opaque leaf — that's how 250 Exotic Essence of Luck and the Cube of
  // Stabilized Dark Energy's matrices stayed invisible to users. Kept leaves
  // are documented decisions in leaf-policy.json (maintained by
  // `npm run wiki:leaf-audit`, whose --check mode catches unclassified names).
  {
    const policy = leafPolicy as Record<string, { name: string; action: string; reason: string }>
    const offenders = new Map<string, string[]>()
    for (const piece of CATALOG) {
      const producing = new Map(piece.recipe.nodes.map((n) => [n.output.itemId, n]))
      const seen = new Set<number>()
      for (const n of piece.recipe.nodes) {
        for (const i of n.inputs) {
          if (seen.has(i.itemId)) continue
          seen.add(i.itemId)
          const node = producing.get(i.itemId)
          if (node && node.inputs.length > 0) continue
          if (!hasGiftRecipe(i.name)) continue
          const list = offenders.get(i.name) ?? []
          list.push(piece.name)
          offenders.set(i.name, list)
        }
      }
    }
    if (offenders.size > 0) {
      failures++
      console.error(`\n❌ ${offenders.size} expandable material(s) modeled as opaque leaves (hidden requirements):`)
      for (const [name, pieces] of offenders) {
        console.error(`   • ${name} — leaf in ${pieces.length} piece(s): ${pieces.slice(0, 4).join(', ')}${pieces.length > 4 ? ', …' : ''}`)
      }
    }
    // Every policy entry marked 'expand' must actually be covered by the tables.
    const uncovered = Object.values(policy).filter((e) => e.action === 'expand' && !hasGiftRecipe(e.name))
    if (uncovered.length > 0) {
      failures++
      console.error(`\n❌ ${uncovered.length} leaf-policy 'expand' name(s) not covered by the gift/crafted tables:`)
      for (const e of uncovered) console.error(`   • ${e.name}`)
    }
    if (offenders.size === 0 && uncovered.length === 0) {
      console.log(`Leaf policy: no expandable material is modeled as a leaf (${Object.keys(policy).length} kept leaves documented).`)
    }
  }

  // ---- Check 4: gate-or-allowlist — no unclassified non-buyable bulk leaf ----
  // Anything a player can't TP-buy and needs in bulk must either be registered
  // in TIME_GATED (bounded pace → shows on the Forecast) or documented in
  // fast-acquire.json with a reason (quickly acquirable / gated elsewhere).
  // Seed/maintain the allowlist with `npm run wiki:gate-audit`.
  {
    const allow = fastAcquire as Record<string, { name: string; itemId: number; reason: string }>
    const problems: string[] = []
    const candidates = collectGateCandidates()
    const canonSeen = new Set<string>()
    for (const c of candidates) {
      canonSeen.add(c.canon)
      const entry = allow[c.canon]
      if (c.gated && entry) problems.push(`• ${c.name} — in TIME_GATED *and* fast-acquire.json (stale allowlist entry)`)
      if (!c.gated && !entry)
        problems.push(`• ${c.name} (id ${c.itemId}, max ${c.maxRequired}) — neither time-gated nor allowlisted`)
      if (!c.gated && entry?.reason.includes('UNCLASSIFIED'))
        problems.push(`• ${c.name} — allowlisted but UNCLASSIFIED (write a real reason)`)
    }
    for (const [canon, e] of Object.entries(allow)) {
      if (!canonSeen.has(canon)) problems.push(`• ${e.name} — allowlisted but no longer a catalog candidate (prune via wiki:gate-audit)`)
    }
    if (problems.length > 0) {
      failures++
      console.error(`\n❌ Gate audit — ${problems.length} unclassified non-buyable bulk leaf/leaves:`)
      for (const p of problems) console.error(`   ${p}`)
      console.error('   Register in TIME_GATED (src/data/items.ts) or run `npm run wiki:gate-audit` and document the reason.')
    } else {
      const gated = candidates.filter((c) => c.gated).length
      console.log(
        `Gate audit: all ${candidates.length} non-buyable bulk leaves classified (${gated} time-gated, ${Object.keys(allow).length} fast-acquire).`,
      )
    }
  }

  // ---- Golden totals regression ---------------------------------------------
  const current = currentGolden()
  if (update) {
    writeFileSync(GOLDEN_PATH, JSON.stringify(current, null, 1) + '\n')
    console.log(`\nGolden totals re-blessed → ${GOLDEN_PATH} (review + commit the diff).`)
  } else if (!existsSync(GOLDEN_PATH)) {
    failures++
    console.error(`\n❌ ${GOLDEN_PATH} missing — run \`npm run wiki:totals -- --update\` and commit it.`)
  } else {
    const committed = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden
    const drift = goldenDrift(committed, current)
    if (drift.length > 0) {
      failures++
      console.error(`\n❌ Golden totals drift — ${drift.length} change(s) to displayed numbers:`)
      for (const line of drift.slice(0, 20)) console.error(`   ${line}`)
      if (drift.length > 20) console.error(`   … and ${drift.length - 20} more`)
      console.error('   If intentional: `npm run wiki:totals -- --update`, review the JSON diff, commit.')
    } else {
      console.log('Golden totals: no drift against the committed snapshot.')
    }
  }

  if (failures > 0) {
    console.error(`\nWIKI TOTALS FAILED ❌ — ${failures} finding(s).`)
    process.exit(1)
  }
  console.log('\nWIKI TOTALS PASSED ✅ — full-tree quantities match the wiki snapshot, the engine math matches the reference multiply, and displayed totals match the committed golden snapshot.')
}

main()
