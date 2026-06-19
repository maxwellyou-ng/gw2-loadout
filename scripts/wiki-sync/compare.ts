// ---------------------------------------------------------------------------
// Pure component-list diff, shared by the reconciler (gate) and the snapshot
// step (which uses it to decide which intermediate recipes matched the wiki and
// may therefore be badged "verified" in the app). Comparing here in one place
// keeps top-level and intermediate verification using identical canon + math.
// ---------------------------------------------------------------------------

import { canonComponent } from './aliases'

export interface QtyMismatch {
  name: string
  wiki: number
  catalog: number
}

export interface ComponentDiff {
  /** Canonical names the wiki lists but the catalog recipe omits. */
  missing: { name: string; qty: number }[]
  /** Canonical names the catalog recipe has but the wiki doesn't list. */
  extra: { name: string; qty: number }[]
  /** Matched names whose quantities differ. */
  mismatched: QtyMismatch[]
}

/** Sum component quantities keyed by canonical component name. */
export function componentMap(comps: { name: string; qty: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of comps) {
    const k = canonComponent(c.name)
    m.set(k, (m.get(k) ?? 0) + c.qty)
  }
  return m
}

/** Diff a wiki ingredient list against a catalog recipe's direct inputs. */
export function diffComponents(
  wiki: { name: string; qty: number }[],
  catalog: { name: string; qty: number }[],
): ComponentDiff {
  const w = componentMap(wiki)
  const c = componentMap(catalog)
  const missing: { name: string; qty: number }[] = []
  const extra: { name: string; qty: number }[] = []
  const mismatched: QtyMismatch[] = []

  for (const [name, qty] of w) {
    if (!c.has(name)) missing.push({ name, qty })
    else if (c.get(name) !== qty) mismatched.push({ name, wiki: qty, catalog: c.get(name)! })
  }
  for (const [name, qty] of c) {
    if (!w.has(name)) extra.push({ name, qty })
  }
  return { missing, extra, mismatched }
}

/** True when the catalog recipe matches the wiki exactly (name + qty). */
export const isCleanDiff = (d: ComponentDiff): boolean =>
  d.missing.length === 0 && d.extra.length === 0 && d.mismatched.length === 0
