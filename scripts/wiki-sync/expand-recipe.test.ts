// Standalone regression test for the recursive recipe expander (Phase 4).
// Run: npm run wiki:test (bundled with the parser test). Uses an in-memory page
// fetcher so it is fully offline — it exercises the driver's three safety
// properties (stop conditions, cycle protection, builder mapping) plus leaf
// quantity multiplication, independent of the live wiki and the disk cache.

import { expandWikiRecipe, flattenLeaves, countNodes } from './expand-recipe'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

// A tiny synthetic wiki: name -> wikitext. Quantities chosen to make the
// multiplied leaf totals unambiguous.
const PAGES: Record<string, string> = {
  // Top: 2 Widget + 3 Ore.  (Ore is a base material — should NOT expand.)
  Gizmo: `{{Item infobox | id = 100 }}
== Recipe ==
{{Recipe | source = Mystic Forge | ingredient1 = 2 Widget | ingredient2 = 3 Ore }}`,
  // Widget: 5 Ore + 1 Gift of Loops.
  Widget: `{{Item infobox | id = 101 }}
== Recipe ==
{{Recipe | ingredient1 = 5 Ore | ingredient2 = 1 Gift of Loops }}`,
  // Ore is a vendor leaf (no {{recipe}}) — terminal regardless of base set.
  Ore: `{{Item infobox | id = 102 }}
== Acquisition ==
{{Sold by}}`,
  // Gift of Loops references itself -> cycle guard must stop it.
  'Gift of Loops': `{{Item infobox | id = 103 }}
== Recipe ==
{{Recipe | ingredient1 = 1 Gift of Loops | ingredient2 = 1 Ore }}`,
}

const fetchPage = async (name: string): Promise<string | null> => PAGES[name] ?? null

// --- Test 1: full expansion, leaf multiplication ---------------------------
console.log('Recursive expansion + leaf quantity multiplication:')
const full = await expandWikiRecipe('Gizmo', { fetchPage })
const leaves = flattenLeaves(full)
// Ore total = 3 (direct) + 2 Widget × 5 Ore (10) + 2 Widget × 1 Loops × 1 Ore (2) = 15
check('Ore flattened to 15', leaves.get('ore') === 15, [...leaves])
check('Widget is internal (not a leaf)', !leaves.has('widget'))
check('apiId parsed on root', full.apiId === 100, full.apiId)

// --- Test 2: stop condition — base material set ----------------------------
console.log('\nStop condition: base-material set prevents fetch/expand:')
const bounded = await expandWikiRecipe('Gizmo', { fetchPage, baseMaterials: new Set(['widget']) })
const widgetNode = bounded.children.find((c) => c.name === 'Widget')!
check('Widget stopped as base-material', widgetNode.stop === 'base-material', widgetNode.stop)
check('Widget has no children when base', widgetNode.children.length === 0)
check('Widget now counts as a leaf (qty 2)', flattenLeaves(bounded).get('widget') === 2, [...flattenLeaves(bounded)])

// --- Test 3: cycle protection ----------------------------------------------
console.log('\nCycle protection: self-referential recipe stops at the repeat:')
const loops = await expandWikiRecipe('Gift of Loops', { fetchPage })
// root Loops -> [Loops(cycle), Ore(leaf)]
const innerLoops = loops.children.find((c) => c.name === 'Gift of Loops')!
check('inner Gift of Loops marked cycle', innerLoops.stop === 'cycle', innerLoops.stop)
check('expansion terminated (finite node count)', countNodes(loops) === 3, countNodes(loops))

// --- Test 4: builder mapping -----------------------------------------------
console.log('\nBuilder mapping: catalog-owned gift stops without re-expanding:')
const mapped = await expandWikiRecipe('Widget', {
  fetchPage,
  builderOwned: new Set(['gift of loops']),
})
const giftNode = mapped.children.find((c) => c.name === 'Gift of Loops')!
check('Gift of Loops marked builder-owned', giftNode.stop === 'builder-owned', giftNode.stop)
check('builder-owned node has no children', giftNode.children.length === 0)

// --- Test 5: missing page --------------------------------------------------
console.log('\nMissing page becomes a terminal leaf, not a crash:')
const missing = await expandWikiRecipe('Nonexistent Thing', { fetchPage })
check('missing root marked missing-page', missing.stop === 'missing-page', missing.stop)

console.log(`\n${failures === 0 ? 'ALL EXPANDER CHECKS PASSED ✅' : `${failures} EXPANDER CHECK(S) FAILED ❌`}`)
process.exit(failures === 0 ? 0 : 1)
