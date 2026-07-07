// ---------------------------------------------------------------------------
// Recipe construction helpers + shared legendary sub-trees.
//
// Accuracy policy (see brief Section 10): the *leaf* materials that carry the
// real grind and time-gate weight — Mystic Clovers, Mystic Coins, Globs of
// Ectoplasm, T6 fine mats, Obsidian Shards, Charged Quartz — use real item ids
// and well-established quantities. Piece-specific precursors and themed gifts,
// whose exact item ids / sub-recipes vary per weapon and are easy to get
// subtly wrong, are modeled as synthetic intermediates (verified: false) so the
// engine still expands the costed parts while the UI flags them for wiki
// cross-check.
// ---------------------------------------------------------------------------

import type {
  AcquisitionMode,
  ItemRef,
  LegendaryPiece,
  RecipeNode,
  RecipeSource,
  SlotFamily,
  TimeGate,
} from '../../types'
import { CUR, ITEM, TIME_GATED, currency, synthetic } from '../items'
import giftTable from './generated/gifts.generated.json'
import craftedTable from './generated/crafted.generated.json'
import refinementTable from './generated/refinements.generated.json'
import vendorCostTable from './generated/vendor-costs.generated.json'

export const ref = (itemId: number, name: string, qty: number): ItemRef => ({
  itemId,
  name,
  qty,
})

const gateFor = (itemId: number): TimeGate => {
  const g = TIME_GATED[itemId]
  return g
    ? { isGated: true, dailyRate: g.dailyRate, severity: g.severity }
    : { isGated: false }
}

interface NodeOpts {
  source: RecipeSource
  buyable?: boolean
  discipline?: string
  notes?: string
  gate?: TimeGate
}

export const node = (output: ItemRef, inputs: ItemRef[], opts: NodeOpts): RecipeNode => ({
  output,
  inputs,
  source: opts.source,
  buyable: opts.buyable ?? false,
  discipline: opts.discipline,
  notes: opts.notes,
  timeGate: opts.gate ?? gateFor(output.itemId),
})

/** A reusable sub-tree: an intermediate output plus the nodes that build it. */
export interface SubTree {
  out: ItemRef // qty defaults to 1; caller can scale via `times`
  nodes: RecipeNode[]
}

export const times = (s: SubTree, qty: number): ItemRef => ({ ...s.out, qty })

// --- Tier-6 gift bundles (Gen1) -------------------------------------------

export function giftOfMight(): SubTree {
  const out = ref(ITEM.giftOfMight, 'Gift of Might', 1) // id 19672
  return {
    out,
    nodes: [
      node(
        out,
        [
          ref(ITEM.viciousFang, 'Vicious Fang', 250),
          ref(ITEM.armoredScale, 'Armored Scale', 250),
          ref(ITEM.viciousClaw, 'Vicious Claw', 250),
          ref(ITEM.ancientBone, 'Ancient Bone', 250),
        ],
        { source: 'mystic-forge', buyable: false }
      ),
    ],
  }
}

export function giftOfMagic(): SubTree {
  const out = ref(ITEM.giftOfMagic, 'Gift of Magic', 1) // id 19673
  return {
    out,
    nodes: [
      node(
        out,
        [
          ref(ITEM.vialOfPowerfulBlood, 'Vial of Powerful Blood', 250),
          ref(ITEM.powerfulVenomSac, 'Powerful Venom Sac', 250),
          ref(ITEM.elaborateTotem, 'Elaborate Totem', 250),
          ref(ITEM.pileOfCrystallineDust, 'Pile of Crystalline Dust', 250),
        ],
        { source: 'mystic-forge', buyable: false }
      ),
    ],
  }
}

/**
 * Gift of Fortune (Gen1): Gift of Might + Gift of Magic + 77 Mystic Clover +
 * 250 Glob of Ectoplasm. Clovers are the dominant time-gate.
 */
export function giftOfFortune(): SubTree {
  const might = giftOfMight()
  const magic = giftOfMagic()
  const out = ref(ITEM.giftOfFortune, 'Gift of Fortune', 1) // wiki-verified id 19626
  return {
    out,
    nodes: [
      node(
        out,
        [
          times(might, 1),
          times(magic, 1),
          ref(ITEM.mysticClover, 'Mystic Clover', 77),
          ref(ITEM.ectoplasm, 'Glob of Ectoplasm', 250),
        ],
        { source: 'mystic-forge', buyable: false }
      ),
      ...might.nodes,
      ...magic.nodes,
    ],
  }
}

/**
 * Mystic Tribute (Gen2 / Gen3): 2 Gift of Condensed Might + 2 Gift of
 * Condensed Magic + 77 Mystic Clover + 250 Mystic Coin.
 *
 * Wiki-verified composition (2026-06-17): each Condensed gift is itself a
 * Mystic Forge combine of four T6-line sub-gifts (Claws/Fangs/Scales/Bones for
 * Might; Blood/Venom/Totems/Dust for Magic). Each sub-gift refines
 * 100 (vicious-tier T6) + 250 (large-tier T5) + 50 (sharp-tier) + 50 (base).
 * The earlier model used 250 of each T6 — that over-counted the T6 line ~2.5x.
 * The T6 vicious-tier leaves carry the cost weight and use real item ids; the
 * lower-tier leaves use synthetic ids (names accurate; ids not yet verified).
 */
// All four tiers carry real, wiki-verified item ids (vicious-tier T6 100,
// large-tier T5 250, sharp-tier 50, base 50). Quantities cross-checked against
// the Gift of Claws / Gift of Scales wiki recipes.
function condensedSubGift(
  giftName: string,
  t6: [number, string],
  large: [number, string],
  sharp: [number, string],
  base: [number, string]
) {
  const out = ref(synthetic(), giftName, 1)
  return {
    out,
    node: node(
      out,
      [
        ref(t6[0], t6[1], 100),
        ref(large[0], large[1], 250),
        ref(sharp[0], sharp[1], 50),
        ref(base[0], base[1], 50),
      ],
      { source: 'craft', discipline: 'Artificer/Huntsman/Weaponsmith 400' }
    ),
  }
}

export function giftOfCondensedMight(): SubTree {
  const out = ref(ITEM.giftOfCondensedMight, 'Gift of Condensed Might', 1) // id 70867
  const claws = condensedSubGift('Gift of Claws', [ITEM.viciousClaw, 'Vicious Claw'], [ITEM.largeClaw, 'Large Claw'], [ITEM.sharpClaw, 'Sharp Claw'], [ITEM.claw, 'Claw'])
  const fangs = condensedSubGift('Gift of Fangs', [ITEM.viciousFang, 'Vicious Fang'], [ITEM.largeFang, 'Large Fang'], [ITEM.sharpFang, 'Sharp Fang'], [ITEM.fang, 'Fang'])
  const scales = condensedSubGift('Gift of Scales', [ITEM.armoredScale, 'Armored Scale'], [ITEM.largeScale, 'Large Scale'], [ITEM.smoothScale, 'Smooth Scale'], [ITEM.scale, 'Scale'])
  const bones = condensedSubGift('Gift of Bones', [ITEM.ancientBone, 'Ancient Bone'], [ITEM.largeBone, 'Large Bone'], [ITEM.heavyBone, 'Heavy Bone'], [ITEM.bone, 'Bone'])
  return {
    out,
    nodes: [
      node(out, [claws.out, fangs.out, scales.out, bones.out], { source: 'mystic-forge' }),
      claws.node,
      fangs.node,
      scales.node,
      bones.node,
    ],
  }
}

export function giftOfCondensedMagic(): SubTree {
  const out = ref(ITEM.giftOfCondensedMagic, 'Gift of Condensed Magic', 1) // id 76530
  const blood = condensedSubGift('Gift of Blood', [ITEM.vialOfPowerfulBlood, 'Vial of Powerful Blood'], [ITEM.vialOfPotentBlood, 'Vial of Potent Blood'], [ITEM.vialOfThickBlood, 'Vial of Thick Blood'], [ITEM.vialOfBlood, 'Vial of Blood'])
  // Venom tiers are out of alphabetical order (Full < Potent by rarity): the
  // large-tier (x250) is Potent, the sharp-tier (x50) is Full. Wiki-verified via
  // wiki:check intermediate gate (Gift of Venom). Earlier data had these swapped.
  const venom = condensedSubGift('Gift of Venom', [ITEM.powerfulVenomSac, 'Powerful Venom Sac'], [ITEM.potentVenomSac, 'Potent Venom Sac'], [ITEM.fullVenomSac, 'Full Venom Sac'], [ITEM.venomSac, 'Venom Sac'])
  const totems = condensedSubGift('Gift of Totems', [ITEM.elaborateTotem, 'Elaborate Totem'], [ITEM.intricateTotem, 'Intricate Totem'], [ITEM.engravedTotem, 'Engraved Totem'], [ITEM.totem, 'Totem'])
  const dust = condensedSubGift('Gift of Dust', [ITEM.pileOfCrystallineDust, 'Pile of Crystalline Dust'], [ITEM.pileOfIncandescentDust, 'Pile of Incandescent Dust'], [ITEM.pileOfRadiantDust, 'Pile of Radiant Dust'], [ITEM.pileOfLuminousDust, 'Pile of Luminous Dust'])
  return {
    out,
    nodes: [
      node(out, [blood.out, venom.out, totems.out, dust.out], { source: 'mystic-forge' }),
      blood.node,
      venom.node,
      totems.node,
      dust.node,
    ],
  }
}

export function mysticTribute(): SubTree {
  const cMight = giftOfCondensedMight()
  const cMagic = giftOfCondensedMagic()
  const out = ref(ITEM.mysticTribute, 'Mystic Tribute', 1) // wiki-verified id 71820
  return {
    out,
    nodes: [
      node(
        out,
        [
          times(cMight, 2),
          times(cMagic, 2),
          ref(ITEM.mysticClover, 'Mystic Clover', 77),
          ref(ITEM.mysticCoin, 'Mystic Coin', 250),
        ],
        { source: 'mystic-forge', buyable: false }
      ),
      ...cMight.nodes,
      ...cMagic.nodes,
    ],
  }
}

/**
 * Draconic Tribute (Gen3 / End of Dragons Aurene weapons): 1 Gift of Condensed
 * Might + 1 Gift of Condensed Magic + 38 Mystic Clover + 5 Amalgamated Draconic
 * Lodestone. Wiki-verified (2026-06-17) — Gen3 weapons use this, NOT a Mystic
 * Tribute. Draconic Tribute carries its real API id (96137, wiki + /v2/items
 * cross-confirmed 2026-06-19) so a pre-built one matches inventory on sync.
 */
export function draconicTribute(): SubTree {
  const cMight = giftOfCondensedMight()
  const cMagic = giftOfCondensedMagic()
  const out = ref(ITEM.draconicTribute, 'Draconic Tribute', 1)
  return {
    out,
    nodes: [
      node(
        out,
        [
          times(cMight, 1),
          times(cMagic, 1),
          ref(ITEM.mysticClover, 'Mystic Clover', 38),
          ref(ITEM.amalgamatedDraconicLodestone, 'Amalgamated Draconic Lodestone', 5),
        ],
        { source: 'mystic-forge', buyable: false }
      ),
      ...cMight.nodes,
      ...cMagic.nodes,
    ],
  }
}

/**
 * Bloodstone Shard — 200 Spirit Shards at the Mystic Forge. Spirit Shards are
 * a wallet currency (handled as a currency-namespaced leaf in piece files).
 * Real api id 20797, wiki-verified 2026-06-18.
 */
export function bloodstoneShard(spiritShardLeaf: ItemRef): SubTree {
  const out = ref(ITEM.bloodstoneShard, 'Bloodstone Shard', 1)
  return {
    out,
    nodes: [node(out, [spiritShardLeaf], { source: 'mystic-forge' })],
  }
}

/**
 * Gift of Mastery (Gen1): Bloodstone Shard + 250 Obsidian Shard + 1 Gift of
 * Exploration (map completion) + 1 Gift of Battle (WvW reward track).
 * Wiki-verified id 19674. The recipe takes exactly 1 Gift of Exploration.
 */
export function giftOfMastery(): SubTree {
  const blood = bloodstoneShard(ref(currency(CUR.spiritShard), 'Spirit Shard', 200))
  const exploration = ref(ITEM.giftOfExploration, 'Gift of Exploration', 1)
  const battle = ref(ITEM.giftOfBattle, 'Gift of Battle', 1) // id 19678
  const out = ref(ITEM.giftOfMastery, 'Gift of Mastery', 1)
  return {
    out,
    nodes: [
      node(
        out,
        [times(blood, 1), ref(ITEM.obsidianShard, 'Obsidian Shard', 250), exploration, battle],
        { source: 'mystic-forge' }
      ),
      ...blood.nodes,
      node(exploration, [], { source: 'achievement', notes: 'Awarded for 100% world completion' }),
      node(battle, [], { source: 'reward-track', notes: 'WvW reward track completion' }),
    ],
  }
}

// --- Wiki-generated gift recipes ------------------------------------------
//
// Themed weapon gifts (Gift of Sunrise, Gift of Astralaria, …) and their shared
// sub-gifts (Gift of the Mists, Gift of Metal, …) each have their own Mystic
// Forge recipe, but were previously modelled as opaque leaves. `npm run
// wiki:gifts` walks each one's wiki recipe DAG into the table below; this
// builder reconstructs the nested sub-tree at load. Gift nodes carry the wiki's
// real ids (so a pre-crafted gift in inventory matches); non-gift materials are
// terminal leaves at the catalog's granularity. Everything here is verified:false
// (not in VERIFIED_INTERMEDIATES → flagged yellow) until the gift wiki pages are
// snapshotted.
//
// Each entry records `acq` (how it's acquired). Vendor gifts ({{Sold by}}) carry
// their purchase cost in a separate overlay (vendor-costs.generated.json, from
// `npm run wiki:vendor-costs`) — the currencies/items you exchange for the gift,
// so they expand as tracked leaves and aren't spent before the gift is bought.
// Only raw materials and whole-reward gifts (map/story/achievement/reward-track)
// stay as terminal leaves.

type GiftAcq = 'recipe' | 'vendor' | 'reward'
interface RawGiftEntry {
  name: string
  id: number | null
  acq?: GiftAcq
  /** An input is either an item (`id`) or a wallet currency (`currency`) — e.g.
   * Gift of Compassion takes 150 Legendary Insight, a currency since 2023. */
  inputs: { name: string; qty: number; id?: number | null; currency?: number }[]
}
interface RawCost {
  name: string
  qty: number
  currency?: number
  id?: number | null
}
const GIFTS = giftTable as Record<string, RawGiftEntry>
const VENDOR_COSTS = vendorCostTable as Record<string, RawCost[]>

/** Crafted-intermediate recipes (`npm run wiki:crafted`) — NON-gift items whose
 * ingredients are required on every acquisition path (craft-only items and pure
 * currency conversions: Cube of Stabilized Dark Energy, Vision Crystal + its
 * refinements, Mystic Essences, Poems, Certificates, …). Inputs carry either a
 * real item `id` or a wallet `currency` id. */
interface RawCraftedEntry {
  name: string
  id: number | null
  inputs: { name: string; qty: number; id?: number | null; currency?: number }[]
}
// Deterministic refinements (`npm run wiki:refinements` — ingots/planks/bolts/
// leather from /v2/recipes) merge into the same crafted-expansion path, so a
// bulk requirement like 250 Mithril Ingot exposes its ore tier in the tree and
// owned ingots credit against the ore still needed (engine intermediate credit).
const CRAFTED = { ...craftedTable, ...refinementTable } as Record<string, RawCraftedEntry>

const giftCanon = (s: string) => s.trim().toLowerCase().replace(/['`´]/g, "'")

/** How a non-crafted gift is acquired → the leaf's source + an explanatory note. */
const ACQ_LEAF: Record<GiftAcq, { source: RecipeSource; notes: string }> = {
  recipe: { source: 'mystic-forge', notes: '' },
  vendor: { source: 'vendor', notes: 'Vendor purchase — exchanged for map currency / items' },
  reward: { source: 'collection', notes: 'Achievement / collection reward — no materials spent' },
}

/** Per-gift note overrides — alternate current vendors the single-cost model
 * can't express. Keyed by canonical gift name. */
const GIFT_NOTES: Record<string, string> = {
  'gift of ascension':
    'BUY-4373 (Mistlock Observatory): 500 Fractal Relics + 25s 20c. ' +
    "Also sold for 25 Fractal Relics by the Fractal Reliquary and the Wizard's Gobbler.",
}

/** Sub-components the catalog deep-expands via a dedicated builder, not the
 * table (the table stops at them as terminal leaves). Without a delegate a
 * shared gift the curated layer models would terminate here as a bare leaf —
 * under-counting its whole material sub-tree (caught by `npm run wiki:totals`). */
const giftDelegates: Record<string, () => SubTree> = {
  'bloodstone shard': () => bloodstoneShard(ref(currency(CUR.spiritShard), 'Spirit Shard', 200)),
  'gift of condensed might': giftOfCondensedMight,
  'gift of condensed magic': giftOfCondensedMagic,
}

/** True when expanding this name adds structure — a gift recipe, a documented
 * vendor cost, a crafted-intermediate recipe, or a delegated builder. Pure
 * vendor/reward leaf gifts return false so `assembleLegendary` keeps its curated
 * top-level leaf handling; they still get acquisition-labelled when reached
 * during recursion. */
export const hasGiftRecipe = (name: string): boolean => {
  const c = giftCanon(name)
  if (c in giftDelegates) return true
  if ((VENDOR_COSTS[c]?.length ?? 0) > 0) return true
  if ((CRAFTED[c]?.inputs.length ?? 0) > 0) return true
  const e = GIFTS[c]
  return !!e && e.inputs.length > 0
}

/**
 * Reconstruct a gift's nested sub-tree from the wiki-generated table. Gift nodes
 * recurse; non-gift materials and un-modelled gifts terminate as leaves. A
 * per-build `built` set dedupes shared sub-gifts and a `seen` path guards cycles;
 * ids fall back to synthetic when the wiki infobox gave none.
 */
export function buildGiftSubTree(rootName: string): SubTree {
  const nodes: RecipeNode[] = []
  const idByCanon = new Map<string, number>()
  const built = new Set<string>()

  const idFor = (name: string, id: number | null): number => {
    if (id != null && id > 0) return id
    const c = giftCanon(name)
    if (!idByCanon.has(c)) idByCanon.set(c, synthetic())
    return idByCanon.get(c)!
  }

  const visit = (name: string, id: number | null, seen: ReadonlySet<string>): ItemRef => {
    const canon = giftCanon(name)

    const delegate = giftDelegates[canon]
    if (delegate && !seen.has(canon)) {
      const sub = delegate()
      if (!built.has(canon)) {
        built.add(canon)
        nodes.push(...sub.nodes)
      }
      return sub.out
    }

    const entry = GIFTS[canon]
    const vendorCost = VENDOR_COSTS[canon]
    const crafted = entry?.inputs.length ? undefined : CRAFTED[canon]
    const out = ref(idFor(name, entry?.id ?? crafted?.id ?? id), name, 1)
    if ((!entry && !vendorCost && !crafted) || seen.has(canon)) {
      // Terminal: a non-gift material leaf, an un-modelled gift, or a cycle stop.
      // Give gift leaves a friendly collection source; materials stay plain leaves.
      if (/^gift of /.test(canon) && !built.has(canon)) {
        built.add(canon)
        nodes.push(node(out, [], { source: 'collection', notes: 'Acquired in-game' }))
      }
      return out
    }

    if (!built.has(canon)) {
      built.add(canon)
      const nextSeen = new Set(seen)
      nextSeen.add(canon)
      // Currency inputs become tracked wallet leaves (like Spirit Shards in the
      // curated builders); item inputs recurse.
      const inputs = (entry?.inputs ?? []).map((inp) =>
        inp.currency != null
          ? ref(currency(inp.currency), inp.name, inp.qty)
          : { ...visit(inp.name, inp.id ?? null, nextSeen), qty: inp.qty },
      )
      // Crafted-intermediate recipe (Cube of Stabilized Dark Energy, Vision
      // Crystal, Certificates, …): item ingredients recurse like gift inputs;
      // wallet-currency ingredients become tracked currency leaves directly.
      for (const c of crafted?.inputs ?? []) {
        if (c.currency != null) {
          const cref = ref(currency(c.currency), c.name, c.qty)
          inputs.push(cref)
          const ck = 'cost:' + giftCanon(c.name)
          if (!built.has(ck)) {
            built.add(ck)
            nodes.push(node(cref, [], { source: 'vendor', notes: 'Currency conversion cost' }))
          }
        } else {
          inputs.push({ ...visit(c.name, c.id ?? null, nextSeen), qty: c.qty })
        }
      }
      // The currencies / items this gift is bought with — tracked so they aren't
      // spent before the gift is acquired. An item tender the tables can expand
      // (e.g. Gift of the Elders is bought WITH a Gift of Research) recurses like
      // any other input, so its own materials are surfaced too.
      for (const c of vendorCost ?? []) {
        if (c.currency == null && hasGiftRecipe(c.name)) {
          inputs.push({ ...visit(c.name, c.id ?? null, nextSeen), qty: c.qty })
          continue
        }
        const cref =
          c.currency != null ? ref(currency(c.currency), c.name, c.qty) : ref(c.id ?? synthetic(), c.name, c.qty)
        inputs.push(cref)
        const ck = 'cost:' + giftCanon(c.name)
        if (!built.has(ck)) {
          built.add(ck)
          nodes.push(node(cref, [], { source: 'vendor', notes: 'Vendor purchase cost' }))
        }
      }
      // A craftable gift forges its inputs; a vendor gift expands to its purchase
      // cost; a crafted intermediate crafts its ingredients; a reward gift with
      // neither is a tracked leaf labelled how it's earned.
      const acq: GiftAcq = entry?.acq ?? (vendorCost ? 'vendor' : crafted ? 'recipe' : 'reward')
      const leaf = ACQ_LEAF[acq]
      const source: RecipeSource =
        inputs.length > 0 ? (acq === 'vendor' ? 'vendor' : crafted ? 'craft' : 'mystic-forge') : leaf.source
      nodes.push(node(out, inputs, { source, notes: GIFT_NOTES[canon] ?? (leaf.notes || undefined) }))
    }
    return out
  }

  const out = visit(rootName, GIFTS[giftCanon(rootName)]?.id ?? null, new Set())
  return { out, nodes }
}

// ---------------------------------------------------------------------------
// Generic legendary assembler.
//
// Builds a full piece from its wiki TOP-LEVEL components. Components whose name
// matches a known shared gift are expanded into their real leaf tree; every
// other component (precursor, themed gift, map-mastery gift, base material) is a
// leaf with its real wiki id when known. Because the root inputs are exactly the
// wiki's components, the wiki:check gate enforces the recipe stays correct, so
// pieces built this way ship verified:true.
// ---------------------------------------------------------------------------

/** Shared gifts the engine expands into real, costed leaf trees. */
const SHARED_GIFTS: Record<string, () => SubTree> = {
  'gift of fortune': giftOfFortune,
  'gift of mastery': giftOfMastery,
  'mystic tribute': mysticTribute,
  'draconic tribute': draconicTribute,
}

export interface TopComponent {
  name: string
  qty: number
  /** Real GW2 item id (from the wiki infobox). Omit to mint a synthetic id. */
  itemId?: number
  /** Override the leaf's buyable flag (defaults: precursors true, gifts false). */
  buyable?: boolean
  source?: RecipeSource
  notes?: string
  /**
   * Optional sub-recipe. When present the component expands into this costed
   * tree instead of being a summarized leaf — used for themed weapon gifts
   * (e.g. Gift of Exordium) whose recipe is specific to one weapon, so it can't
   * live in the name-keyed SHARED_GIFTS map.
   */
  expand?: () => SubTree
}

export function assembleLegendary(opts: {
  id: number
  name: string
  slot: SlotFamily
  type: string
  acquisitionMode: AcquisitionMode
  wikiUrl: string
  blurb?: string
  gen?: string
  unlocks?: number[]
  components: TopComponent[]
  verified?: boolean
}): LegendaryPiece {
  const rootInputs: ItemRef[] = []
  const childNodes: RecipeNode[] = []
  for (const c of opts.components) {
    const shared = SHARED_GIFTS[c.name.trim().toLowerCase()]
    if (shared) {
      const sub = shared()
      rootInputs.push(times(sub, c.qty))
      childNodes.push(...sub.nodes)
      continue
    }
    if (c.expand) {
      const sub = c.expand()
      rootInputs.push(times(sub, c.qty))
      childNodes.push(...sub.nodes)
      continue
    }
    // Themed weapon gifts + their sub-gifts: expand from the wiki-generated table.
    if (hasGiftRecipe(c.name)) {
      const sub = buildGiftSubTree(c.name)
      rootInputs.push(times(sub, c.qty))
      childNodes.push(...sub.nodes)
      continue
    }
    const leaf = ref(c.itemId ?? synthetic(), c.name, c.qty)
    rootInputs.push(leaf)
    const isGift = /^gift of\b/i.test(c.name)
    childNodes.push(
      node(leaf, [], {
        source: c.source ?? (isGift ? 'collection' : 'mystic-forge'),
        buyable: c.buyable ?? !isGift,
        notes:
          c.notes ??
          (isGift
            ? 'Collection / achievement gift — internal sub-tree summarized'
            : 'Precursor — buyable on TP or via the collection journey'),
      })
    )
  }
  const root = ref(opts.id, opts.name, 1)
  const nodes: RecipeNode[] = [node(root, rootInputs, { source: 'mystic-forge' }), ...childNodes]
  return {
    id: opts.id,
    name: opts.name,
    slot: opts.slot,
    type: opts.type,
    acquisitionMode: opts.acquisitionMode,
    gen: opts.gen,
    unlocks: opts.unlocks ?? [opts.id],
    blurb: opts.blurb,
    recipe: {
      rootItemId: opts.id,
      nodes,
      verified: opts.verified ?? true,
      wikiUrl: opts.wikiUrl,
      version: 2,
    },
  }
}
