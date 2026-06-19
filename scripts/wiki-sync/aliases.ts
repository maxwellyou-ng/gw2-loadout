// ---------------------------------------------------------------------------
// Name normalization + wiki↔catalog aliases.
//
// The reconciler compares by normalized name. Most names match after generic
// normalization (lowercase, strip disambiguation suffixes, normalize
// apostrophes). The maps below cover the cases where the wiki's name and the
// project's name genuinely differ, so a true match isn't reported as drift.
// ---------------------------------------------------------------------------

/** Parenthetical suffixes that are disambiguation noise, not part of the name. */
const STRIP_SUFFIXES = [
  'precursor',
  'weapon',
  'skin',
  'achievement',
  'base',
  'item',
  'gloves',
  'helm',
  'boots',
  'shoulders',
  'chest',
  'leggings',
]

/** Canonicalize a name for comparison. */
export function normalizeName(raw: string): string {
  let s = raw.trim().toLowerCase()
  s = s.replace(/[’`´]/g, "'") // unify apostrophes
  s = s.replace(/&nbsp;/g, ' ')
  // Strip a trailing "(…)" disambiguator when it's known noise.
  s = s.replace(/\s*\(([^)]+)\)\s*$/, (full, inner: string) =>
    STRIP_SUFFIXES.includes(inner.trim().toLowerCase()) ? '' : full,
  )
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Wiki item name -> catalog piece name, for legendaries whose project name
 * differs from the wiki title. Applied (after normalization) before matching.
 * Extend this as the catalog and wiki diverge.
 */
export const PIECE_ALIASES: Record<string, string> = {
  // Catalog models the dual-unlock container under its own name already.
  // 'aetheric anchor' -> 'aetheric anchor' (identity)
  // Wiki lists Obsidian as a set; catalog authors individual pieces. The set
  // name is mapped per-piece in the reconciler via SET_MEMBERS below.
}

/**
 * Component-name aliases: wiki ingredient name -> catalog ingredient name,
 * for shared gifts/precursors whose names differ between sources.
 */
export const COMPONENT_ALIASES: Record<string, string> = {
  'gift of maguuma mastery': 'gift of maguuma mastery',
  // e.g. wiki "Mystic Tribute" === catalog "Mystic Tribute" (identity, no entry needed)
}

/**
 * Wiki "armor set" names that the catalog represents as individual pieces.
 * Used so a single wiki set entry can satisfy multiple catalog pieces without
 * being reported as EXTRA_ITEM, and so missing set coverage is visible.
 */
export const ARMOR_SET_MEMBERS: Record<string, string[]> = {
  'obsidian armor': ['obsidian helm', 'obsidian boots'],
}

/** Apply piece alias after normalization. */
export function canonPiece(raw: string): string {
  const n = normalizeName(raw)
  return PIECE_ALIASES[n] ?? n
}

/** Apply component alias after normalization. */
export function canonComponent(raw: string): string {
  const n = normalizeName(raw)
  return COMPONENT_ALIASES[n] ?? n
}
