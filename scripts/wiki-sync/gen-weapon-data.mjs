// Codegen: emit the WEAPON_DATA array literal for src/data/recipes/weapons.ts
// from the committed weapons snapshot + resolved item-ids.json. Reviewed and
// pasted into weapons.ts (the factory itself is hand-written). Shared gifts
// (Gift of Fortune/Mastery, Mystic/Draconic Tribute) are emitted WITHOUT an id
// so the factory expands them into real leaf trees.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const snap = JSON.parse(readFileSync(join(HERE, 'snapshot', 'weapons.json'), 'utf8'))
const ids = JSON.parse(readFileSync(join(HERE, 'item-ids.json'), 'utf8'))

const SHARED = new Set(['gift of fortune', 'gift of mastery', 'mystic tribute', 'draconic tribute'])
const GEN_MODE = {
  'Generation 1': 'crafting',
  'Generation 2': 'crafting',
  'Generation 3': 'crafting',
  'Standalone weapons': 'open-world',
}

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const lines = []
for (const e of snap.entries) {
  if (e.confidence !== 'high' || e.components.length === 0) continue // skip Ancora Bellum (dual-unlock, see aethericAnchor)
  if (e.name === 'Eternity') continue // special-cased in weapons.ts
  const mode = GEN_MODE[e.generation] ?? 'crafting'
  const comps = e.components.map((c) => {
    const canon = c.name.trim().toLowerCase()
    if (SHARED.has(canon)) return `{ name: ${q(c.name)}, qty: ${c.qty} }`
    const id = ids[canon]?.id
    const idPart = id ? `, itemId: ${id}` : ''
    return `{ name: ${q(c.name)}, qty: ${c.qty}${idPart} }`
  })
  lines.push(
    `  { id: ${e.apiId}, name: ${q(e.name)}, type: ${q(e.type)}, mode: ${q(mode)}, gen: ${q(e.generation ?? '')},\n` +
      `    wikiUrl: ${q(e.wikiUrl)},\n` +
      `    components: [\n      ${comps.join(',\n      ')},\n    ] },`,
  )
}
console.log(lines.join('\n'))
console.log(`\n// ${lines.length} weapons emitted`)
