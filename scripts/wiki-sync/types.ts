// ---------------------------------------------------------------------------
// Shared types for the wiki reconciliation system.
//
// The pipeline is: fetch (wikitext) -> parse -> SNAPSHOT (committed JSON, the
// canonical "what the wiki says") -> reconcile against the live CATALOG ->
// Finding[] -> report / gate. Snapshot and Finding are the load-bearing shapes.
// ---------------------------------------------------------------------------

export type Category = 'weapons' | 'armor' | 'trinkets' | 'backs'

export const CATEGORIES: Category[] = ['weapons', 'armor', 'trinkets', 'backs']

/** The four canonical wiki list pages, one per category. */
export const LIST_PAGES: Record<Category, string> = {
  weapons: 'Legendary weapon',
  armor: 'Legendary armor',
  trinkets: 'Legendary trinket',
  backs: 'Legendary back item',
}

/** A single top-level recipe ingredient as the wiki lists it. */
export interface WikiComponent {
  name: string
  qty: number
  /** Best-effort classification from the wiki (mystic-forge / precursor / gift…). */
  source?: string
}

export type Confidence = 'high' | 'low'
export type EntrySource = 'auto' | 'curated'

/**
 * One canonical legendary record, sourced from the wiki. Committed to
 * snapshot/<category>.json. `components` is the parsed top-level recipe; empty
 * with confidence:'low' when the recipe could not be parsed confidently.
 */
export interface SnapshotEntry {
  name: string
  apiId: number | null
  slot: Category
  type: string | null
  generation: string | null
  wikiUrl: string
  confidence: Confidence
  /** 'auto' entries are rewritten by wiki:fetch; 'curated' are preserved. */
  source: EntrySource
  /** Hash of the source wikitext; lets fetch warn when a curated page changed. */
  wikitextHash: string | null
  components: WikiComponent[]
  /** Free-text reason a low-confidence entry could not be parsed. */
  parseNote?: string
}

export interface SnapshotFile {
  category: Category
  generatedAt: string
  sourcePages: string[]
  entries: SnapshotEntry[]
}

// --- Reconciliation --------------------------------------------------------

export type FindingType =
  | 'MISSING_ITEM' // wiki lists it, catalog has no entry
  | 'EXTRA_ITEM' // catalog has an entry the wiki doesn't list
  | 'ID_MISMATCH' // catalog id/unlocks != wiki infobox apiId
  | 'COMPONENT_MISSING' // wiki component absent from catalog top-level recipe
  | 'COMPONENT_EXTRA' // catalog top-level component the wiki doesn't list
  | 'QTY_MISMATCH' // a matched component's quantity differs
  | 'SYNTHETIC_RESOLVABLE' // catalog uses a synthetic id the wiki now resolves
  | 'UNVERIFIED' // catalog entry is verified:false
  | 'LOW_CONFIDENCE' // wiki entry could not be parsed confidently

export type Severity = 'error' | 'warn' | 'info'

export interface Finding {
  type: FindingType
  severity: Severity
  category: Category
  /** Canonical item name (catalog name when matched, else wiki name). */
  item: string
  message: string
  /** Stable key for baseline acknowledgement: `${type}:${detail ?? ''}`. */
  detail?: string
  wiki?: unknown
  catalog?: unknown
}

/** The default severity for each finding type. */
export const DEFAULT_SEVERITY: Record<FindingType, Severity> = {
  MISSING_ITEM: 'error',
  EXTRA_ITEM: 'error',
  ID_MISMATCH: 'error',
  COMPONENT_MISSING: 'error',
  COMPONENT_EXTRA: 'error',
  QTY_MISMATCH: 'error',
  SYNTHETIC_RESOLVABLE: 'warn',
  UNVERIFIED: 'warn',
  LOW_CONFIDENCE: 'info',
}

/**
 * Acknowledged current state. The gate fails only on error-severity findings
 * whose key is NOT acknowledged here, so day-one drift is recorded (reviewable
 * in git) and only NEW divergence breaks the build.
 */
export interface Baseline {
  /** Wiki item names accepted as not-yet-authored in the catalog. */
  acknowledgedMissing: string[]
  /** Accepted findings, keyed `${item} :: ${type}:${detail}`. */
  acknowledgedFindings: string[]
  note?: string
}

/** Stable acknowledgement key for a finding. */
export const findingKey = (f: Finding): string =>
  `${f.item} :: ${f.type}:${f.detail ?? ''}`
