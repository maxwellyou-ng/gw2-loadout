// ---------------------------------------------------------------------------
// A read-only, comparison-ready view over the live CATALOG. The reconciler
// compares against THIS — the project's actual recipe data — so there is no
// duplicated source of truth (same import the engine-check uses).
// ---------------------------------------------------------------------------

import { CATALOG } from '../../src/data/recipes'
import { isCurrency, isSynthetic, isTimeGated } from '../../src/data/items'
import type { LegendaryPiece, SlotFamily } from '../../src/types'
import type { Category } from './types'
import { canonComponent } from './aliases'

export interface CatalogComponent {
  itemId: number
  name: string
  qty: number
}

export interface CatalogPiece {
  id: number
  name: string
  category: Category
  verified: boolean
  /** True when the piece's own id is a synthetic placeholder (no real armory id). */
  syntheticId: boolean
  unlocks: number[]
  wikiUrl?: string
  /** Top-level recipe ingredients (inputs of the root combine node). */
  components: CatalogComponent[]
}

const FAMILY_TO_CATEGORY: Partial<Record<SlotFamily, Category>> = {
  weapon: 'weapons',
  armor: 'armor',
  trinket: 'trinkets',
  back: 'backs',
}

/** Top-level components = inputs of the node whose output is the root item. */
function topLevelComponents(piece: LegendaryPiece): CatalogComponent[] {
  const rootId = piece.recipe.rootItemId
  const root = piece.recipe.nodes.find((n) => n.output.itemId === rootId)
  if (!root) return []
  return root.inputs.map((i) => ({ itemId: i.itemId, name: i.name, qty: i.qty }))
}

/**
 * A distinct crafted intermediate the catalog deep-expands (a shared gift or
 * sub-gift). `name` is the authored output name; `inputs` are its DIRECT
 * ingredients (one tree level), which the gate diffs against the intermediate's
 * own wiki recipe.
 */
export interface CatalogIntermediate {
  name: string
  syntheticId: boolean
  inputs: CatalogComponent[]
}

/**
 * Every distinct intermediate node across the catalog: a node with inputs that
 * is not a piece root and whose output isn't a currency/time-gated leaf. Deduped
 * by canonical name (shared gifts recur across many pieces with identical
 * sub-recipes). Verifying each one level deep, with recursion across nodes,
 * covers the whole tree below the gate's existing top-level check.
 */
export function catalogIntermediates(): CatalogIntermediate[] {
  const byName = new Map<string, CatalogIntermediate>()
  for (const piece of CATALOG) {
    const rootId = piece.recipe.rootItemId
    for (const n of piece.recipe.nodes) {
      if (n.output.itemId === rootId) continue // piece root: already gated at top level
      if (n.inputs.length === 0) continue // terminal leaf, nothing to expand
      const oid = n.output.itemId
      if (isCurrency(oid) || isTimeGated(oid)) continue
      const key = canonComponent(n.output.name)
      if (byName.has(key)) continue
      byName.set(key, {
        name: n.output.name,
        syntheticId: isSynthetic(oid),
        inputs: n.inputs.map((i) => ({ itemId: i.itemId, name: i.name, qty: i.qty })),
      })
    }
  }
  return [...byName.values()]
}

export function catalogPieces(): CatalogPiece[] {
  const out: CatalogPiece[] = []
  for (const piece of CATALOG) {
    const category = FAMILY_TO_CATEGORY[piece.slot]
    if (!category) continue // skip 'misc'
    out.push({
      id: piece.id,
      name: piece.name,
      category,
      verified: piece.recipe.verified,
      syntheticId: isSynthetic(piece.id),
      unlocks: piece.unlocks,
      wikiUrl: piece.recipe.wikiUrl,
      components: topLevelComponents(piece),
    })
  }
  return out
}
