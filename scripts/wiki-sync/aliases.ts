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
  // The wiki enumerates the spear "Ancora Bellum"; the catalog models the craft
  // under its container name "Aetheric Anchor" (which unlocks Ancora Bellum +
  // Ancora Pax via its `unlocks`). Map the wiki name onto the catalog entry.
  'ancora bellum': 'aetheric anchor',
  // Wiki lists Obsidian as a set; catalog authors individual pieces. The set
  // name is mapped per-piece in the reconciler via SET_MEMBERS below.
}

/**
 * Component-name aliases: wiki ingredient name -> catalog ingredient name,
 * for shared gifts/precursors whose names differ between sources.
 */
export const COMPONENT_ALIASES: Record<string, string> = {
  // e.g. wiki "Mystic Tribute" === catalog "Mystic Tribute" (identity, no entry needed)
  // Wiki recipe pages pluralize some ingredients the catalog names in the singular.
  'mystic clovers': 'mystic clover',
  'obsidian shards': 'obsidian shard',
  'mystic coins': 'mystic coin',
  'globs of ectoplasm': 'glob of ectoplasm',
  'spirit shards': 'spirit shard',
  'piles of bloodstone dust': 'pile of bloodstone dust',
  'icy runestones': 'icy runestone',
  'sun beads': 'sun bead',
  // Wiki disambiguates the raid currency as "(consumable)"; the catalog doesn't.
  'legendary insight (consumable)': 'legendary insight',
  // Wiki recipe shorthand vs the item's full API name.
  'dark matter': 'glob of dark matter',
  // The API item that grants one token is literally named "1 Provisioner Token".
  '1 provisioner token': 'provisioner token',
  // Data uses the singular; /v2/currencies names currency 33 in the plural.
  'ascended shard of glory': 'ascended shards of glory',
}

/**
 * Inventory items the game RETIRED in favor of wallet currencies. Recipes must
 * reference the currency — the retired item id can't be owned, so the player's
 * real balance would never be credited (Coalescence's 150 LI bug, 2026-07-05).
 * Keyed by canonical component name (post-`canonComponent`); generators route
 * any matching ingredient to a `currency` input with the currency's real name.
 */
export const SUPERSEDED_BY_CURRENCY: Record<string, { currency: number; name: string }> = {
  // Item 77302 "Legendary Insight (consumable)" → wallet currency 70 (2023 conversion).
  'legendary insight': { currency: 70, name: 'Legendary Insight' },
  // The wiki vendor tables use the singular item-style name; the wallet
  // currency (69) that replaced the per-dungeon tokens is plural.
  'tale of dungeon delving': { currency: 69, name: 'Tales of Dungeon Delving' },
  'tales of dungeon delving': { currency: 69, name: 'Tales of Dungeon Delving' },
}

/**
 * Wiki "armor set" names that the catalog represents as individual pieces.
 * Used so a single wiki set entry can satisfy multiple catalog pieces without
 * being reported as EXTRA_ITEM, and so missing set coverage is visible.
 */
export const ARMOR_SET_MEMBERS: Record<string, string[]> = {
  'obsidian armor': ['obsidian helm', 'obsidian shoulders', 'obsidian chest', 'obsidian gloves', 'obsidian leggings', 'obsidian boots'],
  "triumphant hero's armor": ["triumphant hero's helm", "triumphant hero's shoulders", "triumphant hero's chest", "triumphant hero's gloves", "triumphant hero's leggings", "triumphant hero's boots"],
  'perfected envoy armor': ['perfected envoy helm', 'perfected envoy shoulders', 'perfected envoy chest', 'perfected envoy gloves', 'perfected envoy leggings', 'perfected envoy boots'],
  'ardent glorious armor': ['ardent glorious helm', 'ardent glorious shoulders', 'ardent glorious chest', 'ardent glorious gloves', 'ardent glorious leggings', 'ardent glorious boots'],
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
