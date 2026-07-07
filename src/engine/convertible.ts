// ---------------------------------------------------------------------------
// Closeness helpers (docs/UX-BEST-PRACTICES.md §3.2/§3.3): materials sit in raw
// or wallet form until the end, so "how close am I really?" must read the
// recipe tree, not just the leaf list. Because refinement expansion makes raw
// forms the leaves, everything here derives from the display tree that
// `buildRecipeTree` already produces — no engine math changes.
//
//   subtreeCovered(node) — nothing left to farm below this node; only
//                          conversion work (refine / forge / vendor) remains.
//   finishingSteps(root) — the concrete convert/buy checklist, in doing-order
//                          (deepest conversions first), for the refine-when-
//                          close disclosure.
// ---------------------------------------------------------------------------

import type { RecipeTreeNode } from '../types'

export interface FinishingStep {
  itemId: number
  name: string
  /** Units still to produce / buy. */
  qty: number
  action: 'buy' | 'craft' | 'forge' | 'vendor' | 'collect'
  discipline?: string
  /** Copper cost for buy steps, when priced. */
  goldCost?: number
  /** Tree depth — steps are emitted deepest-first (do these first). */
  depth: number
}

export interface FinishingPlan {
  steps: FinishingStep[]
  /** True when every remaining leaf is on hand — pure conversion left. */
  conversionOnly: boolean
  /** Copper total across buy steps (0 when conversionOnly). */
  buyGold: number
}

/**
 * A subtree is covered when its own stock satisfies it, or every child subtree
 * is covered — i.e. the raw forms are all on hand and only conversion remains.
 * `buyableCounts` additionally treats TP-buyable missing leaves as covered
 * (gold can close them today).
 */
export function subtreeCovered(node: RecipeTreeNode, buyableCounts = false): boolean {
  if (node.remaining <= 0) return true
  if (node.children.length === 0) return buyableCounts && node.buyable
  return node.children.every((c) => subtreeCovered(c, buyableCounts))
}

const ACTION_BY_SOURCE: Record<string, FinishingStep['action']> = {
  craft: 'craft',
  'mystic-forge': 'forge',
  vendor: 'vendor',
  'reward-track': 'collect',
  achievement: 'collect',
  collection: 'collect',
}

/**
 * The finishing checklist for a piece that is (nearly) all conversion:
 * every remaining node whose inputs are fully on hand (or buyable, with
 * `buyMissing`), deepest-first, plus the buy steps themselves. Returns null
 * when the piece is NOT closeable this way — i.e. something still needs
 * farming — so callers can keep the disclosure collapsed.
 */
export function finishingPlan(
  root: RecipeTreeNode,
  opts: { buyMissing?: boolean } = {},
): FinishingPlan | null {
  const buyMissing = opts.buyMissing ?? true
  // The root node is the legendary itself (remaining 1 until owned): closeable
  // when everything under it is covered.
  if (!root.children.length || !root.children.every((c) => subtreeCovered(c, buyMissing)))
    return null

  const steps = new Map<number, FinishingStep>()
  let buyGold = 0
  let sawBuy = false

  const add = (s: FinishingStep) => {
    const cur = steps.get(s.itemId)
    if (cur) {
      cur.qty += s.qty
      if (s.goldCost) cur.goldCost = (cur.goldCost ?? 0) + s.goldCost
      cur.depth = Math.max(cur.depth, s.depth)
    } else {
      steps.set(s.itemId, { ...s })
    }
  }

  const walk = (node: RecipeTreeNode, depth: number) => {
    if (node.remaining <= 0) return
    if (node.children.length === 0) {
      // Missing leaf: only reachable when buyMissing allowed it.
      const goldCost = node.unitPrice != null ? node.remaining * node.unitPrice : undefined
      if (goldCost) buyGold += goldCost
      sawBuy = true
      add({
        itemId: node.ref.itemId,
        name: node.ref.name,
        qty: node.remaining,
        action: 'buy',
        goldCost,
        depth,
      })
      return
    }
    for (const c of node.children) walk(c, depth + 1)
    add({
      itemId: node.ref.itemId,
      name: node.ref.name,
      qty: node.remaining,
      action: ACTION_BY_SOURCE[node.source] ?? 'craft',
      discipline: node.discipline,
      depth,
    })
  }

  // Walk the root's children (the root "step" is the final forge combine —
  // include it last as the capstone).
  for (const c of root.children) walk(c, 1)
  add({
    itemId: root.ref.itemId,
    name: root.ref.name,
    qty: root.remaining,
    action: ACTION_BY_SOURCE[root.source] ?? 'forge',
    depth: 0,
  })

  // Doing-order: buys first, then deepest conversions, capstone last.
  const ordered = [...steps.values()].sort(
    (a, b) =>
      Number(b.action === 'buy') - Number(a.action === 'buy') || b.depth - a.depth,
  )
  return { steps: ordered, conversionOnly: !sawBuy, buyGold }
}
