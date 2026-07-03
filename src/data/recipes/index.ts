// Aggregated legendary catalog. The schema holds any legendary; the curated
// slice (seed-loadout weapons + armor + full trinket/back catalog) is authored
// by hand, and the machine-owned `generated/` layer (wiki:fix drafts) is merged
// in on top — curated always wins a name/id collision so authored work is never
// clobbered.

import type { LegendaryPiece, RecipeNode } from '../../types'
import { WEAPONS } from './weapons'
import { ARMOR } from './armor'
import { TRINKETS } from './trinkets'
import { BACKS } from './backs'
import { GENERATED } from './generated'
import { buildGiftSubTree, hasGiftRecipe } from './_builders'

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Expand every leaf the data layer knows how to expand. Materials whose
 * ingredients are required on EVERY acquisition path (gift recipes, itemized
 * vendor costs, crafted intermediates like Cube of Stabilized Dark Energy or
 * Gift of Research) must never sit as opaque leaves — users need to see the
 * luck/matrices/currencies to save. Curated trees reference these by real id;
 * this pass splices in the generated sub-trees uniformly so hand-authored and
 * assembled pieces get identical expansions. Enforced by `npm run wiki:totals`.
 */
function expandKnownLeaves(piece: LegendaryPiece): LegendaryPiece {
  const producing = new Map(piece.recipe.nodes.map((n) => [n.output.itemId, n]))
  const referenced = new Map<number, string>() // itemId -> display name
  for (const n of piece.recipe.nodes) {
    for (const i of n.inputs) if (!referenced.has(i.itemId)) referenced.set(i.itemId, i.name)
  }

  const extra: RecipeNode[] = []
  const replacedEmpty = new Set<number>() // 0-input nodes superseded by an expansion
  const expandedCanon = new Set<string>()
  for (const [itemId, name] of referenced) {
    const existing = producing.get(itemId)
    if (existing && existing.inputs.length > 0) continue // already expanded
    if (!hasGiftRecipe(name)) continue // nothing known to expand
    const canon = norm(name)
    if (expandedCanon.has(canon)) continue
    expandedCanon.add(canon)

    const sub = buildGiftSubTree(name)
    // Keep the curated leaf's id as the sub-tree root so existing references
    // (and inventory matching) stay intact when the table minted another id.
    const nodes =
      sub.out.itemId === itemId
        ? sub.nodes
        : sub.nodes.map((n) =>
            n.output.itemId === sub.out.itemId ? { ...n, output: { ...n.output, itemId } } : n,
          )
    if (existing) replacedEmpty.add(itemId)
    extra.push(...nodes)
  }

  if (extra.length === 0) return piece
  // Drop superseded empty leaves and any duplicate outputs the sub-trees share
  // with nodes already in the piece (e.g. Thermocatalytic Reagent cost leaves).
  const kept = piece.recipe.nodes.filter(
    (n) => !(replacedEmpty.has(n.output.itemId) && n.inputs.length === 0),
  )
  const have = new Set(kept.map((n) => n.output.itemId))
  const added: RecipeNode[] = []
  for (const n of extra) {
    if (have.has(n.output.itemId)) continue
    have.add(n.output.itemId)
    added.push(n)
  }
  return { ...piece, recipe: { ...piece.recipe, nodes: [...kept, ...added] } }
}

const CURATED: LegendaryPiece[] = [...WEAPONS, ...ARMOR, ...TRINKETS, ...BACKS]

const curatedNames = new Set(CURATED.map((p) => norm(p.name)))
const curatedIds = new Set(CURATED.map((p) => p.id))

// Generated drafts only fill gaps: anything a curated file already covers (by
// name or id) takes precedence and the generated entry is dropped.
const generatedKept = GENERATED.filter(
  (p) => !curatedNames.has(norm(p.name)) && !curatedIds.has(p.id)
)

export const CATALOG: LegendaryPiece[] = [...CURATED, ...generatedKept].map(expandKnownLeaves)

export const CATALOG_BY_ID: Record<number, LegendaryPiece> = Object.fromEntries(
  CATALOG.map((p) => [p.id, p])
)

export const pieceByName = (name: string): LegendaryPiece | undefined =>
  CATALOG.find((p) => norm(p.name) === norm(name))

export { WEAPONS, ARMOR, TRINKETS, BACKS }
