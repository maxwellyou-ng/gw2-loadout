// ---------------------------------------------------------------------------
// The reconciler: a PURE, deterministic diff of the committed wiki snapshot
// against the live CATALOG. No network, no file writes beyond reading. Produces
// a structured Finding[]; the report and gate are thin renderers over this.
// ---------------------------------------------------------------------------

import {
  CATEGORIES,
  DEFAULT_SEVERITY,
  type Category,
  type Finding,
  type FindingType,
  type SnapshotEntry,
} from './types'
import { ARMOR_SET_MEMBERS, canonComponent, canonPiece } from './aliases'
import { catalogPieces, type CatalogPiece } from './catalog-view'
import { readSnapshot } from './store'

function finding(
  type: FindingType,
  category: Category,
  item: string,
  message: string,
  extra: { detail?: string; wiki?: unknown; catalog?: unknown } = {},
): Finding {
  return { type, severity: DEFAULT_SEVERITY[type], category, item, message, ...extra }
}

/** Sum component quantities keyed by canonical component name. */
function componentMap(comps: { name: string; qty: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of comps) {
    const k = canonComponent(c.name)
    m.set(k, (m.get(k) ?? 0) + c.qty)
  }
  return m
}

function compareComponents(
  category: Category,
  itemName: string,
  wiki: SnapshotEntry,
  cat: CatalogPiece,
): Finding[] {
  const out: Finding[] = []
  const wikiMap = componentMap(wiki.components)
  const catMap = componentMap(cat.components)

  for (const [name, qty] of wikiMap) {
    if (!catMap.has(name)) {
      out.push(
        finding('COMPONENT_MISSING', category, itemName, `wiki lists "${name}" (x${qty}) but the catalog recipe omits it`, {
          detail: name,
          wiki: { name, qty },
        }),
      )
    } else if (catMap.get(name) !== qty) {
      out.push(
        finding('QTY_MISMATCH', category, itemName, `"${name}": wiki ${qty} vs catalog ${catMap.get(name)}`, {
          detail: name,
          wiki: qty,
          catalog: catMap.get(name),
        }),
      )
    }
  }
  for (const [name, qty] of catMap) {
    if (!wikiMap.has(name)) {
      out.push(
        finding('COMPONENT_EXTRA', category, itemName, `catalog recipe has "${name}" (x${qty}) which the wiki recipe doesn't list`, {
          detail: name,
          catalog: { name, qty },
        }),
      )
    }
  }
  return out
}

/** Names this wiki entry should match in the catalog (expands armor sets). */
function candidateCatalogNames(wiki: SnapshotEntry): string[] {
  const canon = canonPiece(wiki.name)
  return ARMOR_SET_MEMBERS[canon] ?? [canon]
}

export interface ReconcileResult {
  findings: Finding[]
  stats: {
    wikiCount: number
    catalogCount: number
    highConfidence: number
  }
}

/** Compare every category's snapshot against the catalog. */
export function reconcile(): ReconcileResult {
  const findings: Finding[] = []
  const cat = catalogPieces()
  const catByName = new Map<string, CatalogPiece>()
  for (const p of cat) catByName.set(canonPiece(p.name), p)
  const matchedCatalogIds = new Set<number>()

  let wikiCount = 0
  let highConfidence = 0

  for (const category of CATEGORIES) {
    const snap = readSnapshot(category)
    if (!snap) {
      findings.push(
        finding('LOW_CONFIDENCE', category, `(${category})`, `no snapshot file — run npm run wiki:fetch`),
      )
      continue
    }
    for (const wiki of snap.entries) {
      wikiCount++
      if (wiki.confidence === 'high') highConfidence++

      const names = candidateCatalogNames(wiki)
      const matches = names.map((n) => catByName.get(n)).filter((p): p is CatalogPiece => !!p)

      if (matches.length === 0) {
        findings.push(
          finding('MISSING_ITEM', category, wiki.name, `wiki lists "${wiki.name}" but the catalog has no entry`, {
            wiki: { apiId: wiki.apiId, type: wiki.type, generation: wiki.generation },
          }),
        )
        continue
      }

      for (const m of matches) matchedCatalogIds.add(m.id)
      const primary = matches[0]
      const isSet = names.length > 1

      // --- id reconciliation -------------------------------------------------
      if (wiki.apiId != null) {
        const idKnown = primary.id === wiki.apiId || primary.unlocks.includes(wiki.apiId)
        if (primary.syntheticId) {
          findings.push(
            finding('SYNTHETIC_RESOLVABLE', category, primary.name, `catalog uses a synthetic id; wiki has real API id ${wiki.apiId}`, {
              detail: String(wiki.apiId),
              wiki: wiki.apiId,
              catalog: primary.id,
            }),
          )
        } else if (!idKnown && !isSet) {
          findings.push(
            finding('ID_MISMATCH', category, primary.name, `catalog id ${primary.id} ≠ wiki API id ${wiki.apiId}`, {
              detail: String(wiki.apiId),
              wiki: wiki.apiId,
              catalog: primary.id,
            }),
          )
        }
      }

      // --- recipe reconciliation --------------------------------------------
      if (isSet) continue // sets: enumeration + id only; per-piece recipes compared via members' own pages
      if (wiki.confidence === 'low') {
        findings.push(
          finding('LOW_CONFIDENCE', category, primary.name, `wiki recipe not parsed (${wiki.parseNote ?? 'unknown'}); recipe not compared`, {
            detail: wiki.parseNote,
          }),
        )
        continue
      }
      if (!primary.verified) {
        findings.push(
          finding('UNVERIFIED', category, primary.name, `catalog entry is verified:false; recipe not held to the wiki contract yet`),
        )
        continue
      }
      findings.push(...compareComponents(category, primary.name, wiki, primary))
    }
  }

  // --- catalog entries the wiki never matched -> EXTRA_ITEM ------------------
  for (const p of cat) {
    if (!matchedCatalogIds.has(p.id)) {
      findings.push(
        finding('EXTRA_ITEM', p.category, p.name, `catalog has "${p.name}" but no wiki legendary matched it (renamed/removed, or a name alias is needed)`),
      )
    }
  }

  return {
    findings,
    stats: { wikiCount, catalogCount: cat.length, highConfidence },
  }
}
