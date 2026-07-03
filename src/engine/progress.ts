// ---------------------------------------------------------------------------
// Per-piece progress engine (brief Sections 4-step-4 and 7).
//
//   computeProgress(piece, snapshot, prices, weights, syncMeta) -> DerivedProgress
//
// Flattens a recipe tree to its base materials, crediting owned intermediates
// along the way, then computes the weighted completion score, the earliest
// finish date (limited by daily-capped materials), and the buy-out split.
// ---------------------------------------------------------------------------

import type {
  CompletionWeights,
  DerivedProgress,
  InventorySnapshot,
  ItemRef,
  LegendaryPiece,
  PriceMap,
  Provenance,
  RecipeNode,
  RecipeSource,
  RecipeTreeNode,
  RemainingMaterial,
  SyncMeta,
  TimeGate,
  TimeGateDebt,
  TimeGateSeverity,
} from '../types'
import {
  gameModeFor,
  isCurrency,
  isSynthetic,
  isTimeGated,
  materialCategory,
  TIME_GATED,
} from '../data/items'

const SEVERITY_WEIGHT: Record<TimeGateSeverity, number> = { low: 1, medium: 2, high: 4 }

/** Account-bound leaves that can't be bought on the TP to skip the grind. */
function leafBuyable(itemId: number, fallbackNode?: RecipeNode): boolean {
  if (fallbackNode) return fallbackNode.buyable
  if (isCurrency(itemId)) return false // wallet currencies are account-bound
  if (isTimeGated(itemId)) return false // clovers, charged quartz, daily mats
  return true // T6 mats, ecto, mystic coins, etc. are TP-buyable
}

function leafGate(itemId: number, fallbackNode?: RecipeNode): TimeGate {
  if (isTimeGated(itemId)) {
    const g = TIME_GATED[itemId]
    return { isGated: true, dailyRate: g.dailyRate, severity: g.severity }
  }
  return fallbackNode?.timeGate ?? { isGated: false }
}

interface LeafAcc {
  itemId: number
  name: string
  required: number
  node?: RecipeNode // the terminal node, if this leaf is a node output with no inputs
}

/**
 * Expand a recipe tree into requirements.
 *
 * Base mode (default): fully flatten to leaf materials, crediting owned
 * intermediates along the way. Terminal nodes with no inputs (achievement
 * gifts, precursors, vendor items) are recorded as leaves.
 *
 * `stopAtIntermediates`: only the root combine is expanded; each *direct input*
 * of the final combine (gifts like Gift of Fortune, plus top-level base mats
 * like clovers/ecto) is recorded as a line item at full required qty. Owned
 * crediting is applied downstream in `toMaterial`, so it isn't double-counted.
 */
function flatten(
  piece: LegendaryPiece,
  snapshot: InventorySnapshot,
  stopAtIntermediates = false,
  /** When provided, intermediate credits taken from the snapshot are recorded
   *  here (itemId -> qty). Crafting consumes: a credit is a claim on stock. */
  intermediateCredits?: Map<number, number>,
): Map<number, LeafAcc> {
  const nodeByOutput = new Map<number, RecipeNode>()
  for (const n of piece.recipe.nodes) nodeByOutput.set(n.output.itemId, n)

  const leaves = new Map<number, LeafAcc>()
  // Intermediate credits already taken during this walk. An owned gift is
  // consumed by the subtree it credits — a second occurrence of the same
  // intermediate in the tree must not be zeroed by the same stack.
  const taken = new Map<number, number>()
  const owned = (id: number) =>
    isSynthetic(id) ? 0 : Math.max(0, (snapshot[id] ?? 0) - (taken.get(id) ?? 0))

  const recordLeaf = (itemId: number, name: string, qty: number, node?: RecipeNode) => {
    const cur = leaves.get(itemId)
    if (cur) cur.required += qty
    else leaves.set(itemId, { itemId, name, required: qty, node })
  }

  const seen = new Set<number>()
  const expand = (itemId: number, name: string, qty: number, isRoot: boolean) => {
    if (qty <= 0) return
    const node = nodeByOutput.get(itemId)
    // Leaf: no producing node, or a terminal node with no inputs.
    if (!node || node.inputs.length === 0) {
      recordLeaf(itemId, name, qty, node)
      return
    }
    // Gift-level: record this intermediate as a line item instead of expanding
    // it (owned credit applied downstream, so record full qty here).
    if (stopAtIntermediates && !isRoot) {
      recordLeaf(itemId, name, qty, node)
      return
    }
    // Intermediate: credit owned stock (consuming it for this subtree), then
    // expand only the uncovered remainder.
    const credit = Math.min(qty, owned(itemId))
    if (credit > 0) taken.set(itemId, (taken.get(itemId) ?? 0) + credit)
    const need = qty - credit
    if (need <= 0) return
    if (seen.has(itemId)) return // guard against cyclic data
    seen.add(itemId)
    const per = node.output.qty || 1
    const crafts = Math.ceil(need / per)
    for (const input of node.inputs) {
      expand(input.itemId, input.name, crafts * input.qty, false)
    }
    seen.delete(itemId)
  }

  expand(piece.id, piece.name, 1, true)
  if (intermediateCredits) for (const [id, qty] of taken) intermediateCredits.set(id, qty)
  return leaves
}

/** Build a RemainingMaterial from a flattened leaf, crediting owned once. */
function toMaterial(
  leaf: LeafAcc,
  snapshot: InventorySnapshot,
  prices: PriceMap,
): RemainingMaterial {
  const have = isSynthetic(leaf.itemId) ? 0 : snapshot[leaf.itemId] ?? 0
  const remaining = Math.max(0, leaf.required - have)
  const buyable = leafBuyable(leaf.itemId, leaf.node)
  const gate = leafGate(leaf.itemId, leaf.node)
  const unitPrice = buyable ? prices[leaf.itemId] : undefined
  const source = leaf.node?.source
  return {
    itemId: leaf.itemId,
    name: leaf.name,
    required: leaf.required,
    owned: Math.min(have, leaf.required),
    remaining,
    buyable,
    timeGate: gate,
    unitPrice,
    source,
    category: materialCategory(leaf.itemId, source, leaf.name),
    gameMode: gameModeFor(leaf.itemId, source, leaf.name),
  }
}

/**
 * Gift-level requirements: the direct inputs of a piece's final combine
 * (gifts/intermediates + any top-level base mats), as RemainingMaterials.
 * Reuses the same recipe walk and leaf classification as `computeProgress`.
 */
export function intermediateRequirements(
  piece: LegendaryPiece,
  snapshot: InventorySnapshot,
  prices: PriceMap,
): RemainingMaterial[] {
  const leafMap = flatten(piece, snapshot, true)
  return [...leafMap.values()].map((leaf) => toMaterial(leaf, snapshot, prices))
}

function isOwned(piece: LegendaryPiece, meta?: SyncMeta): boolean {
  if (!meta) return false
  if (piece.unlocks.some((id) => meta.ownedArmoryIds.includes(id))) return true
  const norm = (s: string) => s.trim().toLowerCase()
  return meta.ownedArmoryNames.some((n) => norm(n) === norm(piece.name))
}

export function computeProgress(
  piece: LegendaryPiece,
  snapshot: InventorySnapshot,
  prices: PriceMap,
  weights: CompletionWeights,
  meta?: SyncMeta,
): DerivedProgress {
  const owned = isOwned(piece, meta)

  const intermediateCredits = new Map<number, number>()
  const leafMap = flatten(piece, snapshot, false, intermediateCredits)
  const materials: RemainingMaterial[] = []

  let qtyNeeded = 0
  let qtyOwned = 0
  let goldTotal = 0
  let goldOwned = 0
  let gatedTotalW = 0
  let gatedRemainW = 0

  for (const leaf of leafMap.values()) {
    const m = toMaterial(leaf, snapshot, prices)
    materials.push(m)

    qtyNeeded += m.required
    qtyOwned += m.owned

    if (m.buyable && m.unitPrice != null) {
      goldTotal += m.required * m.unitPrice
      goldOwned += m.owned * m.unitPrice
    }

    if (m.timeGate.isGated && m.timeGate.severity) {
      const w = SEVERITY_WEIGHT[m.timeGate.severity]
      gatedTotalW += w * m.required
      gatedRemainW += w * m.remaining
    }
  }

  const qtyProgress = qtyNeeded > 0 ? qtyOwned / qtyNeeded : 1
  // Gold/time only register when there's a measurable basis: gold needs TP
  // prices for buyable mats, time needs gated mats. A dimension with no basis
  // (e.g. prices not synced yet) is excluded from the weighted average rather
  // than counted as 100% — otherwise an unsynced account looks falsely complete.
  const goldProgress = goldTotal > 0 ? goldOwned / goldTotal : 1
  const timeProgress = gatedTotalW > 0 ? 1 - gatedRemainW / gatedTotalW : 1

  const dims: [number, number][] = [[weights.qty, qtyProgress]]
  if (gatedTotalW > 0) dims.push([weights.time, timeProgress])
  if (goldTotal > 0) dims.push([weights.gold, goldProgress])
  const wSum = dims.reduce((s, [w]) => s + w, 0) || 1
  const completionScore = owned
    ? 1
    : dims.reduce((s, [w, p]) => s + w * p, 0) / wSum

  const remainingMaterials = materials
    .filter((m) => m.remaining > 0)
    .sort((a, b) => Number(b.timeGate.isGated) - Number(a.timeGate.isGated))
  const remainingPurchasable = remainingMaterials.filter((m) => m.buyable)
  const remainingNonPurchasable = remainingMaterials.filter((m) => !m.buyable)

  const buyOutGold = remainingPurchasable.reduce(
    (sum, m) => sum + (m.unitPrice != null ? m.remaining * m.unitPrice : 0),
    0,
  )

  const timeGateDebt: TimeGateDebt[] = remainingMaterials
    .filter((m) => m.timeGate.isGated && (m.timeGate.dailyRate ?? 0) > 0)
    .map((m) => {
      const dailyRate = m.timeGate.dailyRate!
      return {
        itemId: m.itemId,
        name: m.name,
        remaining: m.remaining,
        dailyRate,
        severity: m.timeGate.severity ?? 'low',
        days: Math.ceil(m.remaining / dailyRate),
      }
    })
    .sort((a, b) => b.days - a.days)

  const maxDays = timeGateDebt.reduce((mx, d) => Math.max(mx, d.days), 0)
  const earliestFinishDate =
    owned || maxDays <= 0 ? null : addDaysISO(new Date(), maxDays)

  // What crafting this piece would consume from the snapshot: credited leaf
  // stock plus credited intermediates. An already-unlocked piece consumes
  // nothing — it will never be crafted.
  const consumed: Record<number, number> = {}
  if (!owned) {
    for (const m of materials) if (m.owned > 0) consumed[m.itemId] = m.owned
    for (const [id, qty] of intermediateCredits) {
      consumed[id] = (consumed[id] ?? 0) + qty
    }
  }

  return {
    pieceId: piece.id,
    owned,
    completionScore,
    qtyProgress,
    goldProgress,
    timeProgress,
    hasGoldBasis: goldTotal > 0,
    hasTimeBasis: gatedTotalW > 0,
    remainingMaterials,
    remainingPurchasable,
    remainingNonPurchasable,
    finishableByGold: !owned && remainingNonPurchasable.length === 0 && remainingMaterials.length > 0,
    buyOutGold,
    timeGateDebt,
    earliestFinishDate,
    consumed,
  }
}

function addDaysISO(from: Date, days: number): string {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Reconstruct the nested recipe tree for display (PieceDetail). Walks the flat
 * `recipe.nodes` from the root, scaling quantities down through each combine, and
 * stamps every node with owned/remaining/price, its acquisition category + game
 * mode, and a provenance flag so the UI never shows unverified data as authoritative.
 *
 * `verified` is the wiki-matched intermediate manifest (src/data/verified-intermediates):
 * an intermediate node is `verified` only when the piece is verified AND either it's
 * the root or its output name is in that set. Base leaves inherit their container's
 * trust; terminal collection/achievement leaves are `summarized` (a stand-in for a
 * deeper journey); synthetic or unmatched intermediates are `unverified`.
 */
export function buildRecipeTree(
  piece: LegendaryPiece,
  snapshot: InventorySnapshot,
  prices: PriceMap,
  verified: ReadonlySet<string>,
): RecipeTreeNode {
  const nodeByOutput = new Map<number, RecipeNode>()
  for (const n of piece.recipe.nodes) nodeByOutput.set(n.output.itemId, n)
  const pieceVerified = piece.recipe.verified

  const build = (
    item: ItemRef,
    isRoot: boolean,
    parentVerified: boolean,
    seen: Set<number>,
  ): RecipeTreeNode => {
    const node = nodeByOutput.get(item.itemId)
    const hasChildren = !!node && node.inputs.length > 0 && !seen.has(item.itemId)
    const source: RecipeSource = node?.source ?? 'mystic-forge'
    const buyable = node ? node.buyable : leafBuyable(item.itemId)
    const timeGate = node?.timeGate ?? leafGate(item.itemId)
    const have = isSynthetic(item.itemId) ? 0 : snapshot[item.itemId] ?? 0
    const remaining = Math.max(0, item.qty - have)
    const unitPrice = buyable && !isSynthetic(item.itemId) ? prices[item.itemId] : undefined

    // Does this combine's ingredient list match the wiki?
    const recipeVerified = hasChildren && pieceVerified && (isRoot || verified.has(item.name))

    let children: RecipeTreeNode[] = []
    if (hasChildren) {
      const next = new Set(seen)
      next.add(item.itemId)
      const per = node!.output.qty || 1
      const crafts = Math.ceil(item.qty / per)
      children = node!.inputs.map((inp) =>
        build({ ...inp, qty: inp.qty * crafts }, false, recipeVerified, next),
      )
    }

    let provenance: Provenance
    if (hasChildren) {
      // A vendor purchase isn't a craftable {{recipe}} (the wiki renders its cost
      // via a DB query, not machine-readable params), so it can never be wiki-
      // "verified" — but its modelled cost is the known vendor price, not an
      // unverified guess. Treat it as a summarized stand-in, like a vendor leaf.
      provenance = recipeVerified ? 'verified' : source === 'vendor' ? 'summarized' : 'unverified'
    } else if (
      node &&
      (source === 'achievement' || source === 'collection' || source === 'reward-track' || source === 'vendor')
    ) {
      provenance = 'summarized'
    } else if (isSynthetic(item.itemId)) {
      // A terminal LEAF with a synthetic id is a modelled stand-in for a real item
      // we couldn't resolve to an API id (e.g. armor-set ascended bases, which
      // expose no per-piece id) — a known representation, not an unverified recipe.
      // 'unverified' is reserved for craftable intermediates not matched to the wiki.
      provenance = 'summarized'
    } else {
      provenance = parentVerified ? 'verified' : 'unverified'
    }

    return {
      ref: { ...item },
      source,
      buyable,
      timeGate,
      discipline: node?.discipline,
      notes: node?.notes,
      category: materialCategory(item.itemId, source, item.name),
      gameMode: gameModeFor(item.itemId, source, item.name),
      provenance,
      owned: Math.min(have, item.qty),
      remaining,
      unitPrice,
      children,
    }
  }

  return build({ itemId: piece.id, name: piece.name, qty: 1 }, true, pieceVerified, new Set())
}
