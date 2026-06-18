// Standalone sanity check for the computation engine (run: npx tsx scripts/engine-check.ts).
// Validates recipe flattening, the weighted completion score, time-gate days,
// the buy-out split, and name-based owned detection — without a live API key.

import { CATALOG, pieceByName } from '../src/data/recipes'
import { computeProgress, mergeInventory } from '../src/engine'
import { DEFAULT_WEIGHTS } from '../src/types'
import { ITEM, currency, CUR } from '../src/data/items'
import type { SyncMeta } from '../src/types'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  const ok = cond ? 'PASS' : 'FAIL'
  if (!cond) failures++
  console.log(`  [${ok}] ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

const emptyMeta: SyncMeta = {
  lastSynced: null,
  characters: [],
  ownedArmoryIds: [],
  ownedArmoryNames: [],
  achievements: {},
}

console.log(`Catalog size: ${CATALOG.length} pieces`)
console.log(`Unique ids: ${new Set(CATALOG.map((p) => p.id)).size}`)

// --- 1. Aetheric Anchor: dual unlock, clover gate, no precursor -------------
console.log('\nAetheric Anchor:')
const anchor = pieceByName('Aetheric Anchor')!
check('exists', !!anchor)
check('two armory unlocks', anchor.unlocks.length === 2, anchor.unlocks.length)
const anchorProg = computeProgress(anchor, {}, {}, DEFAULT_WEIGHTS, emptyMeta)
const anchorClover = anchorProg.remainingMaterials.find((m) => m.itemId === ITEM.mysticClover)
check('requires Mystic Clovers', !!anchorClover, anchorClover?.required)
check('clovers are time-gated', !!anchorClover?.timeGate.isGated)
check('completion score 0 with empty inventory', anchorProg.completionScore === 0)
check('has an earliest finish date (gated)', anchorProg.earliestFinishDate !== null, anchorProg.earliestFinishDate)
check('time-gate debt present', anchorProg.timeGateDebt.length > 0, anchorProg.timeGateDebt.map((d) => `${d.name}:${d.days}d`))

// --- 2. Incinerator (Gen1): full shared tree leaves -------------------------
console.log('\nIncinerator (Gen1):')
const inc = pieceByName('Incinerator')!
const incProg = computeProgress(inc, {}, {}, DEFAULT_WEIGHTS, emptyMeta)
const incEcto = incProg.remainingMaterials.find((m) => m.itemId === ITEM.ectoplasm)
const incClover = incProg.remainingMaterials.find((m) => m.itemId === ITEM.mysticClover)
const incFang = incProg.remainingMaterials.find((m) => m.itemId === ITEM.viciousFang)
const incSpirit = incProg.remainingMaterials.find((m) => m.itemId === currency(CUR.spiritShard))
const incObsidian = incProg.remainingMaterials.find((m) => m.itemId === ITEM.obsidianShard)
check('250 Globs of Ectoplasm', incEcto?.required === 250, incEcto?.required)
check('77 Mystic Clovers', incClover?.required === 77, incClover?.required)
check('250 Vicious Fang (Gift of Might)', incFang?.required === 250, incFang?.required)
check('200 Spirit Shards (Bloodstone Shard)', incSpirit?.required === 200, incSpirit?.required)
check('Spirit Shards flagged grind-only', incSpirit?.buyable === false)
check('250 Obsidian Shards', incObsidian?.required === 250, incObsidian?.required)
check('ecto is buyable', incEcto?.buyable === true)

// --- 3. Owned detection by name -> auto Done --------------------------------
console.log('\nOwned detection:')
const ownedMeta: SyncMeta = { ...emptyMeta, ownedArmoryNames: ['incinerator'] }
const incOwned = computeProgress(inc, {}, {}, DEFAULT_WEIGHTS, ownedMeta)
check('name match -> owned', incOwned.owned === true)
check('owned -> completion 1', incOwned.completionScore === 1)
check('owned -> no finish date', incOwned.earliestFinishDate === null)

// --- 4. Partial inventory raises progress + buy-out math --------------------
console.log('\nPartial inventory + pricing:')
const snap = mergeInventory({
  materials: [
    { id: ITEM.mysticClover, count: 77 }, // clovers fully satisfied for Incinerator's 77
    { id: ITEM.ectoplasm, count: 125 }, // half the ecto
  ],
})
const prices = { [ITEM.ectoplasm]: 5000 } // 50s each
const partial = computeProgress(inc, snap, prices, DEFAULT_WEIGHTS, emptyMeta)
const ectoRemain = partial.remainingMaterials.find((m) => m.itemId === ITEM.ectoplasm)
check('ecto remaining = 125', ectoRemain?.remaining === 125, ectoRemain?.remaining)
check('ecto buy-out counted', partial.buyOutGold >= 125 * 5000, partial.buyOutGold)
check('time progress improved by clovers', partial.timeProgress > anchorProg.timeProgress * 0 + incProg.timeProgress, {
  before: incProg.timeProgress.toFixed(3),
  after: partial.timeProgress.toFixed(3),
})

// --- 5. Eikasia, Mists-Grasper: achievement-gated Fractal gloves ------------
// Wiki-verified (2026-06-17): gate is the "Incursive Investigation" achievement
// (NOT "Working Together"); 150 Fractalline Dust from Quickplay Fractals; the
// craft path bundles an 18-Mystic-Clover gate via two Gift of Prosperity.
console.log('\nEikasia, Mists-Grasper:')
const eik = pieceByName('Eikasia, Mists-Grasper (Gloves)')!
const eikProg = computeProgress(eik, {}, {}, DEFAULT_WEIGHTS, emptyMeta)
const hasAchievement = eik.recipe.nodes.some((n) => n.source === 'achievement')
const eikClover = eikProg.remainingMaterials.find((m) => m.itemId === ITEM.mysticClover)
check('exists under verified name', !!eik)
check('has achievement gate (Incursive Investigation)', hasAchievement === true)
check('18-clover gate present', eikClover?.required === 18, eikClover?.required)
check('clovers are time-gated (grind-only)', eikProg.remainingNonPurchasable.some((m) => m.itemId === ITEM.mysticClover))

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED ✅' : `${failures} CHECK(S) FAILED ❌`}`)
process.exit(failures === 0 ? 0 : 1)
