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

import type { ItemRef, RecipeNode, RecipeSource, TimeGate } from '../../types'
import { ITEM, TIME_GATED, synthetic } from '../items'

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
  const venom = condensedSubGift('Gift of Venom', [ITEM.powerfulVenomSac, 'Powerful Venom Sac'], [ITEM.fullVenomSac, 'Full Venom Sac'], [ITEM.potentVenomSac, 'Potent Venom Sac'], [ITEM.venomSac, 'Venom Sac'])
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
 * Tribute. (Amalgamated Draconic Lodestone id not yet verified -> synthetic.)
 */
export function draconicTribute(): SubTree {
  const cMight = giftOfCondensedMight()
  const cMagic = giftOfCondensedMagic()
  const out = ref(synthetic(), 'Draconic Tribute', 1)
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
 */
export function bloodstoneShard(spiritShardLeaf: ItemRef): SubTree {
  const out = ref(synthetic(), 'Bloodstone Shard', 1)
  return {
    out,
    nodes: [node(out, [spiritShardLeaf], { source: 'mystic-forge' })],
  }
}
