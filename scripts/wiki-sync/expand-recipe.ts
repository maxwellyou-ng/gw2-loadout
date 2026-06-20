// ---------------------------------------------------------------------------
// Auto-fix Phase 4 — the recursive recipe expander.
//
// The snapshot (Phase B/C) captures TOP-LEVEL components and verifies each
// distinct catalog intermediate one level deep. This driver follows every
// component whose wiki page has its own `{{recipe}}` and builds the full nested
// DAG, so a maintainer can see — and machine-diff — the complete leaf tree a
// legendary expands to (the basis for cost + time-gate math).
//
// It is PURE: the page fetcher is injected, so the same engine drives both the
// live/cached wiki (see expand.ts) and the offline fixture test. Three safety
// properties the TODO calls for:
//   • stop condition — a node is a leaf when its page has no parseable recipe,
//     or its (canonical) name is a known base material / builder-owned gift;
//   • cycle protection — a recipe that (transitively) references itself stops at
//     the repeat instead of looping forever;
//   • builder mapping — names the catalog already models via a shared builder
//     (Gift of Fortune, Mystic Tribute, …) stop with `builder-owned`, so they
//     are not re-expanded inconsistently with the curated tree.
// ---------------------------------------------------------------------------

import { parseItemPage } from './parse-recipe'
import { canonComponent } from './aliases'

export type StopReason =
  | 'leaf-no-recipe' // wiki page has no parseable {{recipe}} — a true terminal (vendor/base/achievement)
  | 'base-material' // canonical name is in the known terminal base-material set
  | 'builder-owned' // catalog models this via a shared builder; defer to the curated sub-tree
  | 'cycle' // an ancestor on this path has the same canonical name (recipe cycle guard)
  | 'max-depth' // hard recursion cap reached (defence in depth beyond the cycle guard)
  | 'missing-page' // the page fetcher returned null (page does not exist / fetch failed)

export interface WikiTreeNode {
  name: string
  /** Quantity of this node per single unit of its parent (1 for the root). */
  qty: number
  apiId: number | null
  /** Empty ⇒ this node is a leaf; `stop` says why expansion ended here. */
  children: WikiTreeNode[]
  /** Why expansion stopped. `null` ⇒ an internal node that was expanded. */
  stop: StopReason | null
}

export interface ExpandOptions {
  /** Return the page's wikitext, or null when the page is missing / unfetchable. */
  fetchPage: (name: string) => Promise<string | null>
  /** Canonical names the catalog owns via a shared builder — stop, mark `builder-owned`. */
  builderOwned?: ReadonlySet<string>
  /** Canonical names that are known terminal base materials — stop, mark `base-material`. */
  baseMaterials?: ReadonlySet<string>
  /** Hard recursion cap. Default 10 (legendary trees are ~4–5 deep). */
  maxDepth?: number
}

/**
 * Expand `rootName` into its full nested wiki recipe tree. Each child's page is
 * fetched and parsed; a high-confidence `{{recipe}}` recurses, anything else is
 * a leaf. The root is returned with `qty: 1`.
 */
export async function expandWikiRecipe(rootName: string, opts: ExpandOptions): Promise<WikiTreeNode> {
  const maxDepth = opts.maxDepth ?? 10
  const builderOwned = opts.builderOwned ?? new Set<string>()
  const baseMaterials = opts.baseMaterials ?? new Set<string>()

  const leaf = (name: string, qty: number, stop: StopReason, apiId: number | null = null): WikiTreeNode => ({
    name,
    qty,
    apiId,
    children: [],
    stop,
  })

  async function visit(
    name: string,
    qty: number,
    path: ReadonlySet<string>,
    depth: number,
  ): Promise<WikiTreeNode> {
    const canon = canonComponent(name)

    // Stop conditions that need no fetch keep the crawl bounded. The root
    // (depth 0) is always expanded — you asked to expand *it* — so the base /
    // builder stops only apply to its descendants.
    if (depth > 0) {
      if (baseMaterials.has(canon)) return leaf(name, qty, 'base-material')
      if (builderOwned.has(canon)) return leaf(name, qty, 'builder-owned')
    }
    if (path.has(canon)) return leaf(name, qty, 'cycle')
    if (depth >= maxDepth) return leaf(name, qty, 'max-depth')

    const wikitext = await opts.fetchPage(name)
    if (wikitext == null) return leaf(name, qty, 'missing-page')

    const parsed = parseItemPage(wikitext)
    if (parsed.confidence !== 'high' || parsed.components.length === 0) {
      // No craftable recipe ⇒ terminal leaf (vendor / base material / achievement).
      return leaf(name, qty, 'leaf-no-recipe', parsed.apiId)
    }

    const nextPath = new Set(path)
    nextPath.add(canon)
    const children: WikiTreeNode[] = []
    for (const c of parsed.components) {
      children.push(await visit(c.name, c.qty, nextPath, depth + 1))
    }
    return { name, qty, apiId: parsed.apiId, children, stop: null }
  }

  return visit(rootName, 1, new Set<string>(), 0)
}

/**
 * Flatten a tree to its leaf multiset — canonical leaf name → total quantity,
 * with quantities multiplied down each branch. This is the wiki's view of the
 * raw materials a legendary consumes, diffable against the catalog's leaves.
 */
export function flattenLeaves(root: WikiTreeNode): Map<string, number> {
  const out = new Map<string, number>()
  const walk = (node: WikiTreeNode, parentMult: number): void => {
    const total = node.qty * parentMult
    if (node.children.length === 0) {
      const k = canonComponent(node.name)
      out.set(k, (out.get(k) ?? 0) + total)
      return
    }
    for (const child of node.children) walk(child, total)
  }
  walk(root, 1)
  return out
}

/** Count the nodes in a tree (for "fetched N pages" style reporting). */
export function countNodes(root: WikiTreeNode): number {
  return 1 + root.children.reduce((sum, c) => sum + countNodes(c), 0)
}
