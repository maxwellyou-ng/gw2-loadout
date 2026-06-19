// ---------------------------------------------------------------------------
// `npm run wiki:report` — human-readable drift report. Pure (no network, no
// writes). Renders the reconciler's findings grouped by status so a maintainer
// can bring the catalog in line with the wiki. NEVER edits recipe files.
//
//   npm run wiki:report                     # full markdown report
//   npm run wiki:report -- --scaffold="Bolt"  # draft a recipe stub for one item
// ---------------------------------------------------------------------------

import { reconcile } from './reconcile'
import { classify } from './gate'
import { readBaseline, readSnapshot } from './store'
import { CATEGORIES, type Finding } from './types'
import { canonPiece } from './aliases'

function groupByCategory(findings: Finding[]): Map<string, Finding[]> {
  const m = new Map<string, Finding[]>()
  for (const f of findings) {
    const arr = m.get(f.category) ?? []
    arr.push(f)
    m.set(f.category, arr)
  }
  return m
}

function renderList(findings: Finding[]): string {
  if (findings.length === 0) return '_none_\n'
  const lines: string[] = []
  const byCat = groupByCategory(findings)
  for (const category of [...CATEGORIES, 'intermediates'] as const) {
    const fs = byCat.get(category)
    if (!fs || fs.length === 0) continue
    lines.push(`\n**${category}**`)
    for (const f of fs.sort((a, b) => a.item.localeCompare(b.item))) {
      lines.push(`- \`${f.type}\` **${f.item}** — ${f.message}`)
    }
  }
  return lines.join('\n') + '\n'
}

function report(): void {
  const { findings, stats } = reconcile()
  const baseline = readBaseline()
  const c = classify(findings, baseline)

  console.log('# Legendary recipe ↔ wiki drift report\n')
  console.log(`Generated ${new Date().toISOString()}\n`)
  console.log('## Coverage\n')
  console.log(`- Wiki legendaries (snapshot): **${stats.wikiCount}** (${stats.highConfidence} with a high-confidence parsed recipe)`)
  console.log(`- Catalog entries: **${stats.catalogCount}**`)
  const missing = findings.filter((f) => f.type === 'MISSING_ITEM').length
  console.log(`- Missing from catalog: **${missing}**`)
  console.log(`- Blocking (new/unacknowledged): **${c.blocking.length}**`)
  console.log(`- Acknowledged in baseline: **${c.acknowledged.length}**`)
  console.log(`- Warnings: **${c.warnings.length}**, Info: **${c.infos.length}**\n`)

  console.log('## 🔴 Blocking — new drift, fails `npm run wiki:check`')
  console.log(renderList(c.blocking))

  console.log('## 🟡 Warnings (advisory)')
  console.log(renderList(c.warnings))

  console.log('## ⚪ Acknowledged (recorded in baseline.json)')
  console.log(renderList(c.acknowledged))

  console.log('## ℹ️ Info / low-confidence (excluded from gate)')
  console.log(renderList(c.infos))

  if (c.staleAcknowledgements.length) {
    console.log('\n## 🧹 Stale baseline entries (no longer apply — safe to prune)')
    for (const s of c.staleAcknowledgements) console.log(`- ${s}`)
  }

  console.log('\n---\nTo accept the current state as the new baseline: `npm run wiki:check -- --update-baseline`')
  console.log('To draft a recipe stub for a missing item: `npm run wiki:report -- --scaffold="<Item name>"`')
}

/** Emit a draft recipe entry for a missing item, for a human to finish + verify. */
function scaffold(itemName: string): void {
  const canon = canonPiece(itemName)
  let entry = null
  let category = ''
  for (const cat of CATEGORIES) {
    const snap = readSnapshot(cat)
    const found = snap?.entries.find((e) => canonPiece(e.name) === canon)
    if (found) {
      entry = found
      category = cat
      break
    }
  }
  if (!entry) {
    console.error(`No snapshot entry for "${itemName}". Run npm run wiki:fetch first, or check the name.`)
    process.exit(1)
  }

  const comps = entry.components
    .map((c) => `        ref(synthetic(), ${JSON.stringify(c.name)}, ${c.qty}), // TODO: resolve real item id`)
    .join('\n')

  console.log(`// DRAFT scaffold for ${entry.name} (${category}) — review against ${entry.wikiUrl}`)
  console.log(`// Fill in real item ids, reuse shared builders (giftOfFortune/mysticTribute/etc.),`)
  console.log(`// then set verified:true ONLY once it matches the wiki. Ships verified:false.`)
  console.log(`{
  const id = ${entry.apiId ?? 'synthetic() /* no wiki API id */'}
  const root = ref(id, ${JSON.stringify(entry.name)}, 1)
  const nodes: RecipeNode[] = [
    node(
      root,
      [
${comps || '        // TODO: components (wiki recipe not parsed — confidence low)'}
      ],
      { source: 'mystic-forge', notes: 'Scaffolded from wiki snapshot; verify before trusting.' },
    ),
  ]
  return {
    id,
    name: ${JSON.stringify(entry.name)},
    slot: ${JSON.stringify(category === 'weapons' ? 'weapon' : category === 'trinkets' ? 'trinket' : category === 'backs' ? 'back' : 'armor')},
    type: ${JSON.stringify(entry.type ?? '')},
    acquisitionMode: 'crafting',
    unlocks: [id],
    recipe: { rootItemId: id, nodes, verified: false, wikiUrl: ${JSON.stringify(entry.wikiUrl)}, version: 1 },
  }
}`)
}

const args = process.argv.slice(2)
const scaffoldArg = args.find((a) => a.startsWith('--scaffold'))
if (args.includes('--apply')) {
  // `wiki:report -- --apply` is the documented alias for the auto-fixer.
  const { runFix } = await import('./fix')
  runFix(args.includes('--dry-run'))
} else if (scaffoldArg) {
  const eq = scaffoldArg.indexOf('=')
  const name = eq !== -1 ? scaffoldArg.slice(eq + 1) : process.argv[process.argv.indexOf(scaffoldArg) + 1]
  scaffold((name ?? '').replace(/^["']|["']$/g, ''))
} else {
  report()
}
