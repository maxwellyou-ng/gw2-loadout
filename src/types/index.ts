// ---------------------------------------------------------------------------
// Domain types for the GW2 Legendary Loadout Tracker.
// Mirrors the data model in the build brief (Section 5).
// ---------------------------------------------------------------------------

/** Equipment slots the armory tracks. Weapons are 1..8 (Aetheric Anchor fills 2). */
export type SlotKey =
  | 'helm'
  | 'shoulders'
  | 'chest'
  | 'gloves'
  | 'leggings'
  | 'boots'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'weapon4'
  | 'weapon5'
  | 'weapon6'
  | 'weapon7'
  | 'weapon8'
  | 'amulet'
  | 'ring1'
  | 'ring2'
  | 'accessory1'
  | 'accessory2'
  | 'back'
  | 'relic'
  | 'runes'
  | 'aquabreather'

/** Broad slot families used for grouping in the UI and for catalog filtering. */
export type SlotFamily = 'armor' | 'weapon' | 'trinket' | 'back' | 'misc'

export type AcquisitionMode =
  | 'PvE'
  | 'open-world'
  | 'Raid'
  | 'WvW'
  | 'PvP'
  | 'Fractal'
  | 'collection'
  | 'crafting'

export type TimeGateSeverity = 'low' | 'medium' | 'high'

/** How a single recipe node is produced. */
export type RecipeSource =
  | 'craft'
  | 'mystic-forge'
  | 'vendor'
  | 'reward-track'
  | 'achievement'
  | 'collection'

export interface ItemRef {
  itemId: number
  name: string
  qty: number
}

/**
 * Acquisition bucket for a material, derived from its recipe source + id
 * namespace. Drives the Materials tab's "by acquisition" grouping.
 */
export type MaterialCategory =
  | 'currency'
  | 'time-gated'
  | 'crafting'
  | 'gift'
  | 'reward-track'
  | 'achievement'
  | 'collection'
  | 'vendor'

/** Best-effort game mode a material is tied to (when derivable). */
export type GameMode = 'PvP' | 'WvW' | 'Raid' | 'Fractal' | 'Strike' | 'OpenWorld' | 'Story'

/**
 * How much to trust a rendered recipe node:
 *  - verified: its recipe matches the wiki (gate-enforced),
 *  - summarized: a terminal leaf standing in for a deeper journey (collection/achievement),
 *  - unverified: hand-entered / synthetic, not machine-checked — cross-check on the wiki.
 */
export type Provenance = 'verified' | 'summarized' | 'unverified'

/** A node in the renderable recipe tree (qty already scaled for this instance). */
export interface RecipeTreeNode {
  ref: ItemRef
  source: RecipeSource
  buyable: boolean
  timeGate: TimeGate
  discipline?: string
  notes?: string
  category: MaterialCategory
  gameMode?: GameMode
  provenance: Provenance
  owned: number
  remaining: number
  unitPrice?: number
  /** Empty ⇒ leaf (base material or summarized terminal). */
  children: RecipeTreeNode[]
}

export interface TimeGate {
  isGated: boolean
  /** Max obtainable per day (e.g. 1 Charged Quartz, ~5-6 Mystic Clovers via fractals). */
  dailyRate?: number
  severity?: TimeGateSeverity
}

/**
 * One node in a recipe tree. `output.itemId` is produced from `inputs`.
 * An input is an *intermediate* if some other node in the same tree produces
 * it; otherwise it is a *leaf* (base material counted directly against the API).
 */
export interface RecipeNode {
  output: ItemRef
  inputs: ItemRef[]
  source: RecipeSource
  /** Crafting discipline when source === 'craft' (e.g. 'Huntsman 500'). */
  discipline?: string
  /** Can this node be bought outright on the Trading Post to skip the grind? */
  buyable: boolean
  timeGate: TimeGate
  /** Optional human note (e.g. "purchased from the Fractal vendor"). */
  notes?: string
}

/**
 * A full crafting tree for one legendary piece. `rootItemId` is the output of
 * the top node (the legendary itself or its final Mystic Forge combine).
 *
 * `verified` + `wikiUrl` are deliberate accuracy-honesty fields: the brief
 * (Section 10) notes Mystic Forge recipes are hand-curated and must be wiki
 * cross-checked. Anything not yet confirmed against the wiki ships as
 * `verified: false` and the UI surfaces that.
 */
export interface RecipeTree {
  rootItemId: number
  nodes: RecipeNode[]
  verified: boolean
  wikiUrl?: string
  /** Schema/data version so cached trees can be invalidated on update. */
  version: number
}

export interface LegendaryPiece {
  /** Legendary armory id / item id. */
  id: number
  name: string
  slot: SlotFamily
  /** Specific weapon/armor type label, e.g. 'Greatsword', 'Heavy Helm'. */
  type: string
  icon?: string
  acquisitionMode: AcquisitionMode
  /**
   * Generation / release label for catalog faceting (e.g. 'Generation 1',
   * 'Generation 3', 'Janthir Wilds'). Weapons carry it from the wiki data;
   * armor/trinkets/backs facet by acquisitionMode instead when absent.
   */
  gen?: string
  /**
   * Armory item ids unlocked by completing this project. Usually one; the
   * Aetheric Anchor unlocks two (spear + staff).
   */
  unlocks: number[]
  recipe: RecipeTree
  /** Short blurb shown in the catalog. */
  blurb?: string
}

// --- Live account state ----------------------------------------------------

/** Merged owned quantities across all account sources. owned[itemId] = qty. */
export type InventorySnapshot = Record<number, number>

/** Live Trading Post unit prices (in copper) keyed by itemId. */
export type PriceMap = Record<number, number>

export interface SyncMeta {
  lastSynced: string | null // ISO timestamp
  characters: string[]
  /** Armory item ids the account has already unlocked. */
  ownedArmoryIds: number[]
  /** Normalized item names for owned armory ids (name-based ownership fallback). */
  ownedArmoryNames: string[]
  /** Raw achievement progress keyed by achievement id, when fetched. */
  achievements: Record<number, { current: number; max: number; done: boolean }>
}

// --- Derived per-piece progress -------------------------------------------

export interface RemainingMaterial {
  itemId: number
  name: string
  required: number
  owned: number
  remaining: number
  buyable: boolean
  timeGate: TimeGate
  /** Unit TP price in copper, when known and buyable. */
  unitPrice?: number
  /** Recipe source of the leaf's terminal node, when it had one. */
  source?: RecipeSource
  /** Acquisition bucket (for grouping/filtering). */
  category: MaterialCategory
  /** Game mode tie, when derivable. */
  gameMode?: GameMode
}

export interface TimeGateDebt {
  itemId: number
  name: string
  remaining: number
  dailyRate: number
  severity: TimeGateSeverity
  days: number
}

export interface DerivedProgress {
  pieceId: number
  owned: boolean // unlocked already (armory)
  completionScore: number // 0..1, time-weighted
  qtyProgress: number
  goldProgress: number
  timeProgress: number
  /** Whether each dimension had a measurable basis (else it's excluded/«n/a»). */
  hasGoldBasis: boolean
  hasTimeBasis: boolean
  remainingMaterials: RemainingMaterial[]
  remainingPurchasable: RemainingMaterial[]
  remainingNonPurchasable: RemainingMaterial[]
  finishableByGold: boolean
  /** Total copper to buy out the purchasable remainder. */
  buyOutGold: number
  timeGateDebt: TimeGateDebt[]
  /** ISO date string for the soonest possible finish, or null if not gated. */
  earliestFinishDate: string | null
  /**
   * Inventory this piece's craft would consume, keyed by itemId: owned leaf
   * materials credited (min(have, required)) plus owned intermediates credited
   * during flattening. Crafting consumes materials, so the allocation walk
   * (engine/loadout-progress `allocateProgress`) deducts this from the snapshot
   * before computing the next piece — one stack never satisfies two pieces.
   */
  consumed: Record<number, number>
}

// --- Settings / weights ----------------------------------------------------

export interface CompletionWeights {
  time: number
  gold: number
  qty: number
}

export interface Settings {
  apiKey: string
  weights: CompletionWeights
}

export const DEFAULT_WEIGHTS: CompletionWeights = { time: 0.6, gold: 0.3, qty: 0.1 }
