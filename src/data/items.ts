// ---------------------------------------------------------------------------
// Item-id registry and id-namespace conventions.
//
// The merged InventorySnapshot is a single owned[itemId] = qty map. To keep
// items, wallet currencies, and unverified intermediates in one map without
// collisions we partition the id space:
//
//   0 ..        7_999_999   real GW2 item ids (api.guildwars2.com/v2/items)
//   8_000_000 + currencyId  wallet currencies (/v2/account/wallet)
//   9_000_000 + n           synthetic intermediates (gifts / precursors whose
//                           exact item id is not yet wiki-verified)
//
// The API client writes currencies at CURRENCY_BASE + id; recipe inputs that
// are currencies reference the same. Synthetic ids never match real inventory,
// so the engine always expands them into their leaf materials.
// ---------------------------------------------------------------------------

export const CURRENCY_BASE = 8_000_000
export const SYNTHETIC_BASE = 9_000_000

export const currency = (id: number) => CURRENCY_BASE + id
export const isCurrency = (itemId: number) =>
  itemId >= CURRENCY_BASE && itemId < SYNTHETIC_BASE
export const isSynthetic = (itemId: number) => itemId >= SYNTHETIC_BASE

let syntheticCounter = 0
/** Mint a stable-per-load synthetic id for an unverified intermediate. */
export const synthetic = () => SYNTHETIC_BASE + ++syntheticCounter

// --- Wallet currency ids (stable, from /v2/currencies) ---------------------
export const CUR = {
  coin: 1, // gold, in copper
  karma: 2,
  spiritShard: 23,
  laurel: 3,
  fractalRelic: 7,
  pristineFractalRelic: 24,
  wvwSkirmishClaimTicket: 26,
  badgeOfHonor: 15,
  magnetiteShard: 28, // raid
  testimonyOfHeroics: 26, // (placeholder grouping; WvW)
} as const

// --- Well-known real item ids (high confidence) ----------------------------
// These are the common legendary "commons" and carry the bulk of the cost /
// time-gate weight, so material-count accuracy here is what matters most.
export const ITEM = {
  ectoplasm: 19721, // Glob of Ectoplasm
  mysticCoin: 19976, // Mystic Coin
  mysticClover: 19675, // Mystic Clover
  quartzCrystal: 43773,
  chargedQuartzCrystal: 43772,
  obsidianShard: 19925,

  // --- Fine crafting materials, ALL tiers (wiki-verified 2026-06-17) --------
  // Every id below was read off the item's wiki infobox. NOTE: the T6
  // `viciousFang` was previously 24356 — that is actually *Large Fang*. The
  // real Vicious Fang is 24357. (Bug fixed here.)
  // Claw line
  claw: 24348,
  sharpClaw: 24349,
  largeClaw: 24350,
  viciousClaw: 24351,
  // Fang line
  fang: 24354,
  sharpFang: 24355,
  largeFang: 24356,
  viciousFang: 24357, // was wrongly 24356 (Large Fang)
  // Scale line
  scale: 24286,
  smoothScale: 24287,
  largeScale: 24288,
  armoredScale: 24289,
  // Bone line (note: ids are NOT contiguous — Large Bone is 24341)
  bone: 24344,
  heavyBone: 24345,
  largeBone: 24341,
  ancientBone: 24358,
  // Blood line
  vialOfBlood: 24292,
  vialOfThickBlood: 24293,
  vialOfPotentBlood: 24294,
  vialOfPowerfulBlood: 24295,
  // Venom line (note: Full 24281 < Potent 24282)
  venomSac: 24280,
  fullVenomSac: 24281,
  potentVenomSac: 24282,
  powerfulVenomSac: 24283,
  // Totem line (note: Engraved is 24363)
  totem: 24298,
  intricateTotem: 24299,
  elaborateTotem: 24300,
  engravedTotem: 24363,
  // Dust line
  pileOfRadiantDust: 24274,
  pileOfLuminousDust: 24275,
  pileOfIncandescentDust: 24276,
  pileOfCrystallineDust: 24277,

  // Time-gated daily ascended crafting mats (1/day each)
  lumpOfMithrillium: 46742,
  spoolOfThickElonianCord: 46740,
  globOfElderSpiritResidue: 46744,
  spoolOfSilkWeavingThread: 46739,

  // --- Wiki-verified Mystic Forge gifts / intermediates (real API ids) ------
  // Using real ids lets the engine match a pre-built gift sitting in the
  // player's bank/inventory instead of always treating it as an un-ownable
  // synthetic. (All verified via wiki.guildwars2.com, 2026-06-17.)
  giftOfFortune: 19626,
  giftOfMastery: 19674,
  mysticTribute: 71820,
  giftOfMight: 19672,
  giftOfMagic: 19673,
  giftOfCondensedMight: 70867,
  giftOfCondensedMagic: 76530,
  giftOfClaws: 70801,
  giftOfBattle: 19678,
  giftOfCraftsmanship: 77451,
  giftOfResearch: 97655,

  // --- Other real leaf materials referenced by recipe trees -----------------
  memoryOfBattle: 71581,
  provisionerToken: 88926,
  amalgamatedDraconicLodestone: 92687,
  amalgamatedRiftEssence: 100930,
  icyRunestone: 19676,
  mysticRunestone: 79418,
  certificateOfHonor: 83620,
  certificateOfHeroics: 84099,
  globOfCondensedSpiritEnergy: 83082,
  eldritchScroll: 20852,
  cubeOfStabilizedDarkEnergy: 73137,
  legendaryWarInsight: 83584,
  fractallineDust: 105336,
  giftOfWarProwess: 84168,
  giftOfWarDedication: 83259,
} as const

export interface GatedMaterialInfo {
  dailyRate: number
  severity: 'low' | 'medium' | 'high'
  label: string
}

/**
 * Daily-cap registry for known time-gated materials. dailyRate is a planning
 * assumption (realistic sustained pace, not theoretical max). Used by the
 * engine to weight completion score and to project earliest-finish dates.
 */
export const TIME_GATED: Record<number, GatedMaterialInfo> = {
  [ITEM.mysticClover]: { dailyRate: 6, severity: 'high', label: 'Mystic Clover' },
  [ITEM.chargedQuartzCrystal]: {
    dailyRate: 1,
    severity: 'medium',
    label: 'Charged Quartz Crystal',
  },
  [ITEM.lumpOfMithrillium]: {
    dailyRate: 1,
    severity: 'medium',
    label: 'Lump of Mithrillium',
  },
  [ITEM.spoolOfThickElonianCord]: {
    dailyRate: 1,
    severity: 'medium',
    label: 'Spool of Thick Elonian Cord',
  },
  [ITEM.globOfElderSpiritResidue]: {
    dailyRate: 1,
    severity: 'medium',
    label: 'Glob of Elder Spirit Residue',
  },
  [ITEM.spoolOfSilkWeavingThread]: {
    dailyRate: 1,
    severity: 'medium',
    label: 'Spool of Silk Weaving Thread',
  },
}

export const isTimeGated = (itemId: number) => itemId in TIME_GATED
