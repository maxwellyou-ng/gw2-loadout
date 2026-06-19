// ---------------------------------------------------------------------------
// A read-only, comparison-ready view over the live CATALOG. The reconciler
// compares against THIS — the project's actual recipe data — so there is no
// duplicated source of truth (same import the engine-check uses).
// ---------------------------------------------------------------------------

import { CATALOG } from '../../src/data/recipes'
import { isSynthetic } from '../../src/data/items'
import type { LegendaryPiece, SlotFamily } from '../../src/types'
import type { Category } from './types'

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
