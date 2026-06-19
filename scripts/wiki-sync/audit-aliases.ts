// Trust audit for the canon layer (run: npm run wiki:audit). The reconciler
// matches wiki↔catalog by canonicalized name, so the masking risk is a canonical
// name that collapses two GENUINELY DIFFERENT items (different API/item ids) into
// one — then a wrong match can pass the gate as "clean". Case/plural/alias
// variants of the SAME item collapsing together is the intended behaviour and is
// NOT flagged (we key on ids, not spelling). Also flags no-op alias entries.
// Read-only, no network. Exits non-zero only on a real id-level collision.

import { canonPiece, canonComponent, PIECE_ALIASES, COMPONENT_ALIASES } from './aliases'
import { catalogIntermediates, catalogPieces } from './catalog-view'
import { readSnapshot } from './store'
import { isSynthetic, isCurrency } from '../../src/data/items'
import { CATEGORIES } from './types'

let problems = 0

/** Report when one canonical name maps to more than one distinct real id. */
function idCollisions(label: string, rows: { name: string; id: number | null }[], canon: (s: string) => string) {
  const byCanon = new Map<string, { ids: Set<number>; names: Set<string> }>()
  for (const { name, id } of rows) {
    const k = canon(name)
    if (!byCanon.has(k)) byCanon.set(k, { ids: new Set(), names: new Set() })
    const e = byCanon.get(k)!
    e.names.add(name)
    if (id != null && !isSynthetic(id) && !isCurrency(id)) e.ids.add(id)
  }
  const hits = [...byCanon.entries()].filter(([, e]) => e.ids.size > 1)
  console.log(`\n[${label}] ${byCanon.size} canonical names; ${hits.length} id-level collision(s)`)
  for (const [k, e] of hits) {
    problems++
    console.log(`  ✗ "${k}" maps to distinct ids {${[...e.ids].join(', ')}} from names ${[...e.names].map((n) => JSON.stringify(n)).join(', ')}`)
  }
}

// --- 1. Pieces: wiki apiId + catalog id, keyed by canonPiece -----------------
// A piece's own id and everything it `unlocks` are ONE identity (e.g. Aetheric
// Anchor 105497 unlocks Ancora Bellum 106273), so the wiki listing a piece by an
// unlocked id is an intended match, not a collision. Fold unlocks → piece id.
const identityOf = new Map<number, number>()
const pieces = catalogPieces()
for (const p of pieces) { identityOf.set(p.id, p.id); for (const u of p.unlocks) identityOf.set(u, p.id) }
const ident = (id: number) => identityOf.get(id) ?? id

const pieceRows: { name: string; id: number | null }[] = []
for (const cat of CATEGORIES) for (const e of readSnapshot(cat)?.entries ?? []) pieceRows.push({ name: e.name, id: e.apiId == null ? null : ident(e.apiId) })
for (const p of pieces) pieceRows.push({ name: p.name, id: ident(p.id) })
idCollisions('piece names', pieceRows, canonPiece)

// --- 2. Components: catalog ingredient ids, keyed by canonComponent ----------
const compRows: { name: string; id: number | null }[] = []
for (const it of catalogIntermediates()) for (const i of it.inputs) compRows.push({ name: i.name, id: i.itemId })
idCollisions('component names', compRows, canonComponent)

// --- 3. No-op alias entries (key === value) ----------------------------------
console.log('\n[no-op aliases]:')
let noops = 0
for (const [k, v] of Object.entries({ ...PIECE_ALIASES, ...COMPONENT_ALIASES })) {
  if (k === v) { problems++; noops++; console.log(`  ✗ "${k}" → "${v}" (identity; delete it)`) }
}
if (noops === 0) console.log('  none')

console.log(`\n${problems === 0 ? 'ALIAS AUDIT PASSED ✅ — no id-level masking collisions, no no-op aliases' : `${problems} ALIAS ISSUE(S) ❌`}`)
process.exit(problems === 0 ? 0 : 1)
