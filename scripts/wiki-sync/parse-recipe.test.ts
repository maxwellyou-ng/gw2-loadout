// Standalone regression test for the wiki recipe parser (run: npm run wiki:test).
// Uses inline wikitext fixtures distilled from real GW2 wiki pages, so it is
// independent of the on-disk cache. Guards the two accuracy-critical behaviours:
//   1. A real `{{Recipe|ingredient1=…}}` parses to high-confidence components.
//   2. `{{recipe list}}` (the "Used in" nav box) is NOT mistaken for a recipe,
//      and vendor-sold leaves (`{{Sold by}}`) are classified as such — not as a
//      bogus "{{recipe}} found but no ingredients parsed".

import { parseItemPage } from './parse-recipe'
import { extractTemplates } from './wikitext'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

// --- Fixture 1: a normal Mystic Forge recipe (Twilight-shaped) --------------
const TWILIGHT = `{{Weapon infobox
| id = 30704
}}
== Recipe ==
{{Recipe
| source = Mystic Forge
| quantity = 1
| ingredient1 = 1 Dusk
| ingredient2 = 1 Gift of Twilight
| ingredient3 = 1 Gift of Mastery
| ingredient4 = 1 Gift of Fortune
}}
== Used in ==
{{recipe list}}`

console.log('Real recipe ({{Recipe}} with ingredients):')
const r1 = parseItemPage(TWILIGHT)
check('apiId parsed', r1.apiId === 30704, r1.apiId)
check('confidence high', r1.confidence === 'high', r1.confidence)
check('4 components', r1.components.length === 4, r1.components.map((c) => `${c.qty} ${c.name}`))
check('Dusk x1 present', r1.components.some((c) => c.name === 'Dusk' && c.qty === 1))

// --- Fixture 2: ONLY a {{recipe list}} nav box (the false-match bug) --------
const RECIPE_LIST_ONLY = `{{Item infobox
| id = 12345
}}
== Used in ==
{{recipe list}}`

console.log('\n{{recipe list}} nav box must NOT match as a recipe:')
check('extractTemplates(recipe) ignores {{recipe list}}', extractTemplates(RECIPE_LIST_ONLY, 'recipe').length === 0)
const r2 = parseItemPage(RECIPE_LIST_ONLY)
check('confidence low', r2.confidence === 'low', r2.confidence)
check('reports no recipe (not "no ingredients")', /no \{\{recipe\}\} template found/.test(r2.parseNote ?? ''), r2.parseNote)

// --- Fixture 3: vendor-sold leaf (Eldritch-Scroll-shaped) -------------------
const VENDOR = `{{Item infobox
| id = 20852
}}
== Acquisition ==
{{Sold by}}
== Used in ==
{{recipe list}}`

console.log('\nVendor-sold leaf classification:')
const r3 = parseItemPage(VENDOR)
check('apiId parsed', r3.apiId === 20852, r3.apiId)
check('confidence low', r3.confidence === 'low', r3.confidence)
check('classified as vendor-sold', /vendor-sold item/.test(r3.parseNote ?? ''), r3.parseNote)

// --- Fixture 4: bare {{recipe}} with no ingredients -------------------------
const EMPTY_RECIPE = `{{Item infobox
| id = 999
}}
== Recipe ==
{{recipe}}`

console.log('\nEmpty {{recipe}} still reports "no ingredients":')
const r4 = parseItemPage(EMPTY_RECIPE)
check('matched the template', extractTemplates(EMPTY_RECIPE, 'recipe').length === 1)
check('low confidence, no ingredients', /no ingredients parsed/.test(r4.parseNote ?? ''), r4.parseNote)

console.log(`\n${failures === 0 ? 'ALL PARSER CHECKS PASSED ✅' : `${failures} PARSER CHECK(S) FAILED ❌`}`)
process.exit(failures === 0 ? 0 : 1)
