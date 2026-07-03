// Standalone sanity check for the computation engine (run: npx tsx scripts/engine-check.ts).
// Validates recipe flattening, the weighted completion score, time-gate days,
// the buy-out split, and name-based owned detection — without a live API key.

import { CATALOG, pieceByName } from '../src/data/recipes'
import {
  computeProgress,
  mergeInventory,
  allocateProgress,
  aggregateRequirements,
  aggregateIntermediates,
  intermediateRequirements,
  compareCandidates,
  isFinishLinePush,
} from '../src/engine'
import { DEFAULT_WEIGHTS } from '../src/types'
import { ITEM, currency, CUR, isSynthetic } from '../src/data/items'
import type { SyncMeta } from '../src/types'
import {
  SLOT_ORDER,
  buildSeedLoadout,
  normalizeLoadout,
  type Loadout,
  type LoadoutSlot,
} from '../src/data/loadout'
import { encode, decode } from '../src/lib/buildcode'

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

// --- 6. Whole-loadout aggregation: shared mats de-dup, owned subtracted once -
// Incinerator (77 clovers) + Eikasia (18 clovers) share the Mystic Clover mat.
// The aggregate required must be the *sum* (95), and owned is subtracted once.
console.log('\nWhole-loadout aggregation:')
const mkSlot = (over: Partial<LoadoutSlot> & { key: LoadoutSlot['key'] }): LoadoutSlot => {
  const meta = SLOT_ORDER.find((s) => s.key === over.key)!
  return {
    key: over.key,
    label: over.label ?? meta.label,
    family: over.family ?? meta.family,
    tracked: over.tracked ?? true,
    flexible: over.flexible ?? false,
    priority: over.priority ?? 1,
    chosenPieceId: over.chosenPieceId ?? null,
    candidateIds: over.candidateIds ?? [],
  }
}
const incPiece = pieceByName('Incinerator')!
const eikPiece = pieceByName('Eikasia, Mists-Grasper (Gloves)')!
const aggSlots: LoadoutSlot[] = [
  mkSlot({ key: 'weapon5', chosenPieceId: incPiece.id }),
  mkSlot({ key: 'gloves', chosenPieceId: eikPiece.id }),
  // Untracked slot with another clover piece — must NOT contribute.
  mkSlot({ key: 'weapon1', chosenPieceId: anchor.id, tracked: false }),
]
const aggEmpty = aggregateRequirements(aggSlots, {}, {})
const aggClover = aggEmpty.materials.find((m) => m.itemId === ITEM.mysticClover)
// Exactly 77 + 18 — the untracked anchor (which also needs clovers) is excluded.
check('aggregate clovers = 77 + 18, untracked excluded', aggClover?.required === 95, aggClover?.required)
const aggOwned = aggregateRequirements(aggSlots, mergeInventory({ materials: [{ id: ITEM.mysticClover, count: 50 }] }), {})
const aggCloverOwned = aggOwned.materials.find((m) => m.itemId === ITEM.mysticClover)
check('owned subtracted once: 95 - 50 = 45', aggCloverOwned?.remaining === 45, aggCloverOwned?.remaining)
check('aggregate time-gate debt includes clovers', aggOwned.timeGateDebt.some((d) => d.itemId === ITEM.mysticClover))

// --- 7. Gift-level vs base-level granularity (feature 5) --------------------
console.log('\nGift / intermediate granularity:')
const incInter = intermediateRequirements(incPiece, {}, {})
check('gift-level includes Gift of Fortune (direct combine input)', incInter.some((m) => m.itemId === ITEM.giftOfFortune))
check('gift-level omits deep base mat (Vicious Fang inside the gift)', !incInter.some((m) => m.itemId === ITEM.viciousFang))
check('base-level still includes Vicious Fang', incProg.remainingMaterials.some((m) => m.itemId === ITEM.viciousFang))
// Two tracked slots needing the same gift sum to 2 (and stay at gift level —
// no descent into the gift's base mats).
const interAgg = aggregateIntermediates(
  [mkSlot({ key: 'weapon5', chosenPieceId: incPiece.id }), mkSlot({ key: 'weapon6', chosenPieceId: incPiece.id })],
  {},
  {},
)
const aggFortune = interAgg.materials.find((m) => m.itemId === ITEM.giftOfFortune)
check('two pieces needing a gift aggregate to 2 Gift of Fortune', aggFortune?.required === 2, aggFortune?.required)
check('gift-level aggregate omits deep base mats', !interAgg.materials.some((m) => m.itemId === ITEM.viciousFang))

// --- 8. normalizeLoadout: all 8 weapon slots + flexible boolean -------------
console.log('\nnormalizeLoadout:')
const normed = normalizeLoadout(buildSeedLoadout())
const weaponSlots = normed.slots.filter((s) => s.family === 'weapon')
check('exposes all 8 weapon slots', weaponSlots.length === 8, weaponSlots.length)
check('every slot has a boolean flexible', normed.slots.every((s) => typeof s.flexible === 'boolean'))
// Migrating a loadout missing weapon8 backfills it as a blank slot.
const missing8 = normalizeLoadout({ name: 't', slots: normed.slots.filter((s) => s.key !== 'weapon8') })
check('backfills missing weapon8', missing8.slots.some((s) => s.key === 'weapon8' && s.chosenPieceId === null))

// --- 9. Build-code round-trip + v1 back-compat + no-key leakage (Phase 5) ---
console.log('\nBuild code:')
// A normalized loadout round-trips losslessly (label/family rehydrated from
// SLOT_ORDER; decode also normalizes, so slot sets match exactly).
const rtLoadout: Loadout = normalizeLoadout({
  name: 'Round-trip test',
  slots: [
    mkSlot({ key: 'helm', priority: 1, chosenPieceId: pieceByName('Obsidian Helm')?.id ?? null }),
    mkSlot({ key: 'chest', flexible: true, priority: 5, tracked: true, candidateIds: [incPiece.id, eikPiece.id] }),
    mkSlot({ key: 'back', flexible: false, priority: 11, tracked: false }),
  ],
})
const roundTripped = decode(encode(rtLoadout))
const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
check('decode(encode(x)) deep-equals x', deepEqual(roundTripped, rtLoadout))
const code = encode(rtLoadout)
check('build code is v2 version-prefixed', code.startsWith('gw2-v2.'), code.slice(0, 10))
const fakeKey = 'ABCDEF12-3456-7890-ABCD-EF1234567890DEADBEEF'
check('build code never contains an api key', !code.includes(fakeKey))
check('decode rejects a garbage code', (() => { try { decode('not-a-code'); return false } catch { return true } })())

// Legacy v1 codes (status index) still decode, mapping status->flexible.
const b64url = (s: string) =>
  Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const v1code =
  'gw2-v1.' +
  b64url(
    JSON.stringify({
      n: 'Legacy',
      s: [
        { k: 'chest', c: null, s: 1, t: 1, p: 5, n: [] }, // status index 1 = 'flexible'
        { k: 'helm', c: null, s: 0, t: 1, p: 1, n: [] }, // status index 0 = 'must-have'
      ],
    }),
  )
const v1decoded = decode(v1code)
const v1chest = v1decoded.slots.find((s) => s.key === 'chest')
const v1helm = v1decoded.slots.find((s) => s.key === 'helm')
check("v1 'flexible' status -> flexible true", v1chest?.flexible === true)
check("v1 'must-have' status -> flexible false", v1helm?.flexible === false)
check('v1 tracked preserved', v1chest?.tracked === true)

// --- 9b. Consumption-correct allocation (crafting consumes materials) -------
// Owned stock covers each requirement once: the allocation walk depletes the
// snapshot in priority order, so one stack (or one banked gift) never
// satisfies two pieces at the same time.
console.log('\nConsumption-correct allocation:')

// 77 owned clovers, Incinerator (77, priority 1) + Eikasia (18, priority 2):
// the clovers go to Incinerator; Eikasia still needs all 18 — not both covered.
const consSlots: LoadoutSlot[] = [
  mkSlot({ key: 'weapon5', chosenPieceId: incPiece.id, priority: 1 }),
  mkSlot({ key: 'gloves', chosenPieceId: eikPiece.id, priority: 2 }),
]
const cloverSnap = mergeInventory({ materials: [{ id: ITEM.mysticClover, count: 77 }] })
const alloc = allocateProgress(consSlots, cloverSnap, {})
const incAlloc = alloc['weapon5']!
const eikAlloc = alloc['gloves']!
const incAllocClover = incAlloc.remainingMaterials.find((m) => m.itemId === ITEM.mysticClover)
const eikAllocClover = eikAlloc.remainingMaterials.find((m) => m.itemId === ITEM.mysticClover)
check('priority piece consumes the stack (clover remaining 0)', incAllocClover == null, incAllocClover?.remaining)
check('lower-priority piece gets nothing (still needs 18)', eikAllocClover?.remaining === 18, eikAllocClover?.remaining)
check('consumed map records the claim', incAlloc.consumed[ITEM.mysticClover] === 77, incAlloc.consumed[ITEM.mysticClover])

// Reversing priorities reverses the allocation.
const consRev: LoadoutSlot[] = [
  mkSlot({ key: 'weapon5', chosenPieceId: incPiece.id, priority: 2 }),
  mkSlot({ key: 'gloves', chosenPieceId: eikPiece.id, priority: 1 }),
]
const allocRev = allocateProgress(consRev, cloverSnap, {})
const incRevClover = allocRev['weapon5']!.remainingMaterials.find((m) => m.itemId === ITEM.mysticClover)
check('reversed priority: Eikasia credited 18, Incinerator needs 18 more (77-59)', incRevClover?.remaining === 18, incRevClover?.remaining)

// Aggregate remaining reconciles with the allocation walk (leaf-only snapshot).
const consAgg = aggregateRequirements(consSlots, cloverSnap, {})
const consAggClover = consAgg.materials.find((m) => m.itemId === ITEM.mysticClover)
check('aggregate: required 95, remaining 18 after one 77-stack', consAggClover?.required === 95 && consAggClover?.remaining === 18, consAggClover && { req: consAggClover.required, rem: consAggClover.remaining })
{
  const remainingById = new Map<number, number>()
  for (const key of ['weapon5', 'gloves'] as const) {
    for (const m of alloc[key]!.remainingMaterials) {
      remainingById.set(m.itemId, (remainingById.get(m.itemId) ?? 0) + m.remaining)
    }
  }
  const mismatch = consAgg.materials.filter((m) => m.remaining !== (remainingById.get(m.itemId) ?? 0))
  check('aggregate remaining == Σ allocated remaining, per item', mismatch.length === 0, mismatch.slice(0, 3).map((m) => m.name))
}

// One banked Gift of Fortune + two pieces needing one each: exactly one
// piece's worth of the gift's base mats (77 clovers, 250 ecto) drops out.
const twoInc: LoadoutSlot[] = [
  mkSlot({ key: 'weapon5', chosenPieceId: incPiece.id, priority: 1 }),
  mkSlot({ key: 'weapon6', chosenPieceId: incPiece.id, priority: 2 }),
]
const giftSnap = { [ITEM.giftOfFortune]: 1 }
const giftAgg = aggregateRequirements(twoInc, giftSnap, {})
const giftAggClover = giftAgg.materials.find((m) => m.itemId === ITEM.mysticClover)
const giftAggEcto = giftAgg.materials.find((m) => m.itemId === ITEM.ectoplasm)
check('one banked gift credits one piece: clovers 154 → 77 remaining', giftAggClover?.required === 154 && giftAggClover?.remaining === 77, giftAggClover && { req: giftAggClover.required, rem: giftAggClover.remaining })
check('…and ecto 500 → 250 remaining', giftAggEcto?.required === 500 && giftAggEcto?.remaining === 250, giftAggEcto && { req: giftAggEcto.required, rem: giftAggEcto.remaining })

// An already-unlocked piece is never crafted: it consumes nothing and
// contributes nothing to the shopping list.
const ownedIncMeta: SyncMeta = { ...emptyMeta, ownedArmoryNames: ['incinerator'] }
const ownedAgg = aggregateRequirements(consSlots, {}, {}, ownedIncMeta)
const ownedAggClover = ownedAgg.materials.find((m) => m.itemId === ITEM.mysticClover)
check('unlocked piece excluded from aggregate (only Eikasia’s 18 clovers)', ownedAggClover?.required === 18, ownedAggClover?.required)
const ownedAlloc = allocateProgress(consSlots, cloverSnap, {}, DEFAULT_WEIGHTS, ownedIncMeta)
check('unlocked piece consumes nothing (Eikasia gets the stack)', ownedAlloc['gloves']!.remainingMaterials.find((m) => m.itemId === ITEM.mysticClover) == null)

// --- 10. Forecaster data contract + re-pace math (Phase 6.7) ----------------
// The forecaster reads aggregateRequirements().timeGateDebt and recomputes
// days = ceil(remaining / pace). Validate the contract + that raising the pace
// shortens the projection.
console.log('\nForecaster:')
const fcSlots: LoadoutSlot[] = [mkSlot({ key: 'weapon5', chosenPieceId: incPiece.id })]
const fcAgg = aggregateRequirements(fcSlots, {}, {})
const fcClover = fcAgg.timeGateDebt.find((d) => d.itemId === ITEM.mysticClover)
check('forecaster sees clover debt with dailyRate 6', fcClover?.dailyRate === 6, fcClover?.dailyRate)
check('default days = ceil(remaining / 6)', fcClover?.days === Math.ceil(fcClover!.remaining / 6), fcClover?.days)
const repacedDays = Math.ceil(fcClover!.remaining / 12) // assume buying clovers: 12/day
check('raising pace to 12/day shortens the projection', repacedDays < fcClover!.days, { before: fcClover!.days, after: repacedDays })

// --- 11. History overall = mean of per-piece scores (Phase 6.9) -------------
console.log('\nSnapshot history:')
const hpA = computeProgress(incPiece, {}, {}, DEFAULT_WEIGHTS, emptyMeta).completionScore
const hpB = computeProgress(eikPiece, {}, {}, DEFAULT_WEIGHTS, emptyMeta).completionScore
const overall = (hpA + hpB) / 2
const byPiece = { [incPiece.id]: hpA, [eikPiece.id]: hpB }
const recomputed = Object.values(byPiece).reduce((s, v) => s + v, 0) / Object.values(byPiece).length
check('overall equals mean of per-piece scores', Math.abs(recomputed - overall) < 1e-9, { overall, recomputed })

// --- 12. Catalog-wide aggregation invariants (property checks) ---------------
// Random tracked combos over the WHOLE catalog with random leaf-only
// inventories: the totals identities must hold for every combination, not just
// the hand-picked fixtures above. Seeded PRNG — failures are reproducible.
console.log('\nCatalog-wide aggregation invariants:')
{
  let seed = 0xc0ffee
  const rand = () => {
    // LCG (Numerical Recipes) — deterministic across runs.
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]

  const slotKeys = SLOT_ORDER.map((s) => s.key)
  let bad = 0
  const TRIALS = 30
  for (let t = 0; t < TRIALS; t++) {
    const n = 2 + Math.floor(rand() * 5)
    const keys = [...slotKeys]
    const slots: LoadoutSlot[] = []
    const pieces: (typeof CATALOG)[number][] = []
    for (let i = 0; i < n && keys.length > 0; i++) {
      const key = keys.splice(Math.floor(rand() * keys.length), 1)[0]
      const piece = pick(CATALOG)
      pieces.push(piece)
      slots.push(mkSlot({ key, chosenPieceId: piece.id, priority: i + 1 }))
    }

    // Gross per-piece leaf requirements (empty snapshot).
    const grossById = new Map<number, number>()
    const leafInfo = new Map<number, { buyable: boolean; dailyRate?: number; gated: boolean }>()
    for (const piece of pieces) {
      for (const m of computeProgress(piece, {}, {}, DEFAULT_WEIGHTS, emptyMeta).remainingMaterials) {
        grossById.set(m.itemId, (grossById.get(m.itemId) ?? 0) + m.required)
        leafInfo.set(m.itemId, { buyable: m.buyable, dailyRate: m.timeGate.dailyRate, gated: m.timeGate.isGated })
      }
    }

    // Random leaf-only inventory + random prices over those leaves. Two
    // exclusions keep the plain identity applicable: synthetic ids never match
    // inventory (id-namespace contract), and an id that is a *producible
    // intermediate* in any selected tree gets intermediate-credited (pruning
    // its subtree), which is deeper than this identity models.
    const producible = new Set<number>()
    for (const piece of pieces) {
      for (const nd of piece.recipe.nodes) if (nd.inputs.length > 0) producible.add(nd.output.itemId)
    }
    const snapshot: Record<number, number> = {}
    const prices: Record<number, number> = {}
    for (const [id, req] of grossById) {
      if (!isSynthetic(id) && !producible.has(id) && rand() < 0.5) snapshot[id] = Math.floor(rand() * req * 1.5)
      if (rand() < 0.5) prices[id] = 1 + Math.floor(rand() * 10_000)
    }

    const agg = aggregateRequirements(slots, snapshot, prices, emptyMeta)
    const aggById = new Map(agg.materials.map((m) => [m.itemId, m]))

    for (const [id, req] of grossById) {
      const row = aggById.get(id)
      if (!row || row.required !== req) { bad++; console.log(`  [FAIL] trial ${t}: required(${id}) ${row?.required} != Σ gross ${req}`); break }
      const owned = snapshot[id] ?? 0
      const expectRemaining = Math.max(0, req - owned)
      if (row.remaining !== expectRemaining) { bad++; console.log(`  [FAIL] trial ${t}: remaining(${id}) ${row.remaining} != max(0, ${req} - ${owned})`); break }
      if (row.owned !== req - expectRemaining) { bad++; console.log(`  [FAIL] trial ${t}: owned(${id}) ${row.owned} != required - remaining`); break }
    }

    // buyOutGold identity + time-gate day identity.
    const expectGold = agg.materials.reduce(
      (s, m) => s + (m.buyable && m.unitPrice != null ? m.remaining * m.unitPrice : 0), 0)
    if (agg.buyOutGold !== expectGold) { bad++; console.log(`  [FAIL] trial ${t}: buyOutGold ${agg.buyOutGold} != Σ remaining×price ${expectGold}`) }
    for (const d of agg.timeGateDebt) {
      if (d.days !== Math.ceil(d.remaining / d.dailyRate)) { bad++; console.log(`  [FAIL] trial ${t}: debt days ${d.days} != ceil(${d.remaining}/${d.dailyRate})`); break }
    }

    // Untracked slots never contribute.
    const withUntracked = [...slots, mkSlot({ key: keys[0] ?? 'relic', chosenPieceId: pick(CATALOG).id, tracked: false })]
    const agg2 = aggregateRequirements(withUntracked, snapshot, prices, emptyMeta)
    const sum = (a: typeof agg) => a.materials.reduce((s, m) => s + m.required, 0)
    if (sum(agg2) !== sum(agg)) { bad++; console.log(`  [FAIL] trial ${t}: untracked slot changed totals`) }

    // Allocation reconciliation: Σ per-slot allocated remaining == aggregate remaining.
    const alloc = allocateProgress(slots, snapshot, prices, DEFAULT_WEIGHTS, emptyMeta)
    const remById = new Map<number, number>()
    for (const s of slots) {
      for (const m of alloc[s.key]?.remainingMaterials ?? []) {
        remById.set(m.itemId, (remById.get(m.itemId) ?? 0) + m.remaining)
      }
    }
    for (const m of agg.materials) {
      if (m.remaining !== (remById.get(m.itemId) ?? 0)) { bad++; console.log(`  [FAIL] trial ${t}: aggregate remaining(${m.itemId}) ${m.remaining} != Σ allocated ${remById.get(m.itemId) ?? 0}`); break }
    }
  }
  check(`all invariants hold across ${TRIALS} random combos`, bad === 0, bad)
}

// --- 13. Recommendation rules (Compare ranking + finish-line pushes) ---------
console.log('\nRecommendation rules:')
{
  const sig = (timeGateDays: number, gold: number, overlap: number) => ({ timeGateDays, gold, overlap })
  const ranked = [sig(10, 0, 9), sig(3, 500, 1), sig(3, 100, 0), sig(3, 100, 5)].sort(compareCandidates)
  check('fewest gate-days wins', ranked[0].timeGateDays === 3 && ranked[3].timeGateDays === 10)
  check('gold breaks gate ties', ranked[0].gold === 100 && ranked[2].gold === 500)
  check('overlap breaks gold ties (more first)', ranked[0].overlap === 5 && ranked[1].overlap === 0)

  const now = new Date('2026-07-03T12:00:00Z')
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString().slice(0, 10)
  const prog = (over: Partial<import('../src/types').DerivedProgress>) =>
    ({ owned: false, completionScore: 0, finishableByGold: false, earliestFinishDate: null, ...over }) as import('../src/types').DerivedProgress
  check('owned piece is never a push', !isFinishLinePush(prog({ owned: true, finishableByGold: true }), now))
  check('all-buyable remainder is a push', isFinishLinePush(prog({ finishableByGold: true }), now))
  check('≥80% and ≤14d out is a push', isFinishLinePush(prog({ completionScore: 0.85, earliestFinishDate: inDays(10) }), now))
  check('<80% is not a push', !isFinishLinePush(prog({ completionScore: 0.7, earliestFinishDate: inDays(10) }), now))
  check('>14d out is not a push', !isFinishLinePush(prog({ completionScore: 0.95, earliestFinishDate: inDays(20) }), now))
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED ✅' : `${failures} CHECK(S) FAILED ❌`}`)
process.exit(failures === 0 ? 0 : 1)
