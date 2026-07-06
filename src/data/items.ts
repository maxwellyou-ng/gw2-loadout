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
//   9_500_000 + hash        machine-generated synthetic intermediates, minted by
//                           the wiki:fix auto-fixer (kept in their own sub-range
//                           so a generated draft can never collide with a curated
//                           synthetic id minted at load — see GENERATED_SYNTHETIC_BASE)
//
// The API client writes currencies at CURRENCY_BASE + id; recipe inputs that
// are currencies reference the same. Synthetic ids never match real inventory,
// so the engine always expands them into their leaf materials.
// ---------------------------------------------------------------------------

import type { GameMode, MaterialCategory, RecipeSource } from '../types'
import accountBoundTable from './recipes/generated/account-bound.generated.json'

export const CURRENCY_BASE = 8_000_000
export const SYNTHETIC_BASE = 9_000_000
/**
 * Start of the sub-range the wiki:fix auto-fixer mints generated synthetic ids
 * into. Curated `synthetic()` ids count up from SYNTHETIC_BASE (a few dozen of
 * them); generated ids are hashed into [GENERATED_SYNTHETIC_BASE, 10_000_000),
 * so the two never collide and `isSynthetic` still treats both as synthetic.
 */
export const GENERATED_SYNTHETIC_BASE = 9_500_000

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
  // HoT map currencies — spent at mastery vendors to buy the insight gifts
  // (Gift of the Itzel/Nuhoch/Exalted/Gliding). Tracked so they aren't spent
  // elsewhere before the gifts are bought. (/v2/currencies, 2026-06-20)
  airshipPart: 19,
  leyLineCrystal: 20,
  lumpOfAurillium: 22,
  laurel: 3,
  fractalRelic: 7,
  pristineFractalRelic: 24,
  wvwSkirmishClaimTicket: 26,
  badgeOfHonor: 15,
  magnetiteShard: 28, // raid
  // Wallet currencies that superseded inventory items. Recipes must reference
  // these, never the retired item ids, or the player's real balance is never
  // credited. (/v2/currencies, 2026-07-05)
  legendaryInsight: 70, // was item 77302 "Legendary Insight (consumable)", auto-converted 2023
  talesOfDungeonDelving: 69, // replaced the per-dungeon token items in the 2023 rework
  provisionerToken: 29, // was item 88926 "1 Provisioner Token" (legacy items remapped at sync; /v2/currencies, 2026-07-06)
  // Currencies referenced by the time-gate registry / generated recipes.
  // (/v2/currencies names verified 2026-07-06.)
  researchNote: 61, // EoD; tender for Hydrocatalytic Reagent (10 per 50 notes)
  pvpLeagueTicket: 30,
  ascendedShardsOfGlory: 33,
  testimonyOfJadeHeroics: 65,
  testimonyOfCastoranHeroics: 82,
  ancientCoin: 66,
  // Visions of Eternity map currencies
  staticCharge: 72,
  pinchOfStardust: 73,
  calcifiedGasp: 75,
  ursusOblige: 76,
  antiquatedDucat: 81,
  aetherRichSap: 83,
  // NOTE (2026-06-19): there is no "Testimony of Heroics" currency. The WvW
  // ability/heroics currency is Proof of Heroics (31); the expansion variants are
  // Testimony of Desert/Jade/Castoran Heroics (36/65/82). "Testimony of Heroics"
  // itself is an item (70985), not a currency. No modeled recipe references it,
  // so none is registered here; add the specific id above only when a piece needs it.
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

  // --- Legendary trinkets with real armory ids ------------------------------
  prismaticChampionsRegalia: 95380, // api id from wiki infobox (2026-06-18)

  // --- Legendary crafting intermediates (wiki-verified 2026-06-18) ----------
  bloodstoneShard: 20797,          // Trophy; bought from Miyani / Mystic Forge for 200 Spirit Shards
  giftOfWarProsperity: 82746,      // WvW armor gift; forged: Gift of Battle + 15 Clovers + 2 Condensed gifts
  giftOfJadeMastery: 96033,        // EoD Gen3 mastery gift; forged: Dragon Empire + Bloodstone Shard + Cantha + 100 Antique Summoning Stone
  giftOfMaguumaMastery: 73239,     // HoT Gen2 mastery gift; forged: Gift of Maguuma + Gift of Insights + Bloodstone Shard + 250 Crystalline Ingot
  giftOfExordium: 90893,           // Gen2 themed weapon gift (Exordium only); forged: Gift of the Mists + 100 Mystic Runestone + 100 Shard of Exitare + Gift of Metal
  giftOfExpertise: 100852,         // SotO; forged: 12 Rift Essence + Eldritch Scroll + 50 Obsidian Shard + Cube Dark Energy
  giftOfMagicalProsperity: 100512, // SotO Obsidian / Eikasia (head/shoulder/chest); forged: Craftsmanship + 9 Clovers + Condensed Magic + Research
  giftOfMightyProsperity: 100933,  // SotO Obsidian / Eikasia (boots/gloves/legs); forged: Craftsmanship + 9 Clovers + Condensed Might + Research

  // --- Legendary armor game-mode gifts (wiki-verified ids; 15-clover gate in
  // each Prosperity gift). Shared across all 6 pieces of a line. -------------
  giftOfProsperity: 78866,             // Raid (Envoy): Craftsmanship + 15 Clover + Condensed Might/Magic
  giftOfProwess: 78989,                // Raid: 25 Legendary Insight + Eldritch Scroll + 50 Obsidian + Cube
  giftOfDedication: 78936,             // Raid: 5 Chak Egg + 5 Auric Ingot + 5 Reclaimed Metal Plate + Gift of the Pact
  giftOfCompetitiveProsperity: 84174,  // PvP: Mist Core Fragment + 15 Clover + Condensed Might/Magic
  giftOfCompetitiveProwess: 82350,     // PvP: Record of League Victories + Eldritch Scroll + 50 Obsidian + Cube
  giftOfCompetitiveDedication: 84203,  // PvP: Record of League Participation + Star of Glory + Glob Spirit Energy + Jar of Distilled Glory

  // --- Recipe-leaf materials resolved to real ids (wiki infobox + /v2/items
  // cross-confirmed, 2026-06-19). Previously synthetic; real ids let the engine
  // match these sitting in a player's inventory and price the TP-buyable ones. --
  chakEgg: 72205,                  // Trophy (Raid Dedication)
  auricIngot: 73537,               // Crafting material (Raid Dedication)
  reclaimedMetalPlate: 74356,      // Trophy (Raid Dedication)
  giftOfThePact: 78793,            // Crafting material (Raid Dedication)
  recordOfLeagueParticipation: 82471, // Crafting material (PvP Dedication)
  starOfGlory: 83872,              // Crafting material (PvP Dedication)
  jarOfDistilledGlory: 82926,      // Crafting material (PvP Dedication)
  giftOfExploration: 19677,        // Trophy; Gen1 Gift of Mastery (world completion)
  draconicTribute: 96137,          // Trophy; Gen3/EoD shared tribute (Mystic Forge)
  giftOfTheAstralWard: 100466,     // Crafting material (SotO Obsidian armor)
  giftOfTheMistWarrior: 109686,    // Crafting material (Strife Unending trinket)
  // Aetheric Anchor (Visions of Eternity) heart-vendor gifts
  giftOfTheSurvivors: 106712,
  giftOfThePeople: 105804,
  giftOfTheElders: 106632,
  giftOfInsight: 105875,           // VoE vendor gift (Lyhr); carries the 100-clover gate
  fractallineSpark: 105196,        // Eikasia gloves (fractal vendor leaf)

  // --- Rate-limited leaf materials tracked in TIME_GATED (ids already used by
  // the recipe tables; names cross-checked against /v2/items, 2026-07-06) -----
  exoticEssenceOfLuck: 45178,
  ballOfDarkEnergy: 71994,
  crystallineOre: 46682,
  pileOfBloodstoneDust: 46731,
  dragoniteOre: 46733,
  empyrealFragment: 46735,
  // LS3 map materials (daily node caps per character)
  bloodRuby: 79280,
  petrifiedWood: 79469,
  freshWinterberry: 79899,
  jadeShard: 80332,
  fireOrchidBlossom: 81127,
  orrianPearl: 81706,
  // LS4 map materials
  kralkatiteOre: 86069,
  difluoriteCrystal: 86977,
  inscribedShard: 87645,
  lumpOfMistonium: 88955,
  brandedMass: 89537,
  mistbornMote: 90783,
  // HoT map materials (Gen2 precursor walls)
  leyLineSpark: 69392,
  pileOfAuricDust: 69432,
  bottleOfAirshipOil: 69434,
  // EoD / SotO / JW / VoE rate-limited leaves
  blessingOfTheJadeEmpress: 97829,
  pouchOfStardust: 99964,
  caseOfCapturedLightning: 100267,
  clotOfCongealedScreams: 100098,
  janthirSyntriRenownToken: 102881,
  lowlandShoreRenownToken: 102818,
  refinedHomesteadWood: 103049,
  refinedHomesteadMetal: 102205,
  refinedHomesteadFiber: 102306,
  curiousLowlandHoneycomb: 103038,
  curiousMursaatCurrency: 102494,
  curiousMursaatRemnants: 104829,
  curiousMursaatRuinShard: 104331,
  sunBeads: 19717,
  funeraryIncense: 86093,
  grandmasterMarkShard: 87557,
} as const

export interface GatedMaterialInfo {
  dailyRate: number
  severity: 'low' | 'medium' | 'high'
  label: string
}

/**
 * Rate-limit registry for materials that are impractical to purchase or
 * flash-farm — everything here is account-bound (or a wallet currency) AND
 * accumulates at a bounded pace, so it deserves a lane on the Forecast screen.
 * dailyRate is a planning ASSUMPTION (realistic sustained pace, not
 * theoretical max; fractional = weekly cadence ÷ 7) — each entry cites its
 * basis, and the Forecast screen exposes per-material pace sliders to
 * override any of them. Used by the engine to weight completion score and to
 * project earliest-finish dates.
 *
 * Severity tiers:
 *   high   — strict caps or heavy grinds that usually bind the finish date
 *   medium — hard daily/weekly caps worth running on repeat
 *   low    — farmable but not overnight (only binds when genuinely scarce)
 *
 * The wiki:totals gate (Check 4) fails when a non-buyable leaf needed in bulk
 * is neither registered here nor allowlisted in fast-acquire.json, so new
 * recipes can't silently miss a gate.
 */
export const TIME_GATED: Record<number, GatedMaterialInfo> = {
  // --- high ------------------------------------------------------------------
  // ~6/day sustained: 2/day Ley-Energy Matter Converter exchange + fractal
  // dailies + WvW/PvP reward-track trickle, averaged. Forge gambling can burst
  // higher but is luck, not pace. wiki.guildwars2.com/wiki/Mystic_Clover.
  [ITEM.mysticClover]: { dailyRate: 6, severity: 'high', label: 'Mystic Clover' },
  // Hard cap: each provisioner vendor sells once/day/account; a practical
  // daily loop covers ~10 of them. wiki.guildwars2.com/wiki/Provisioner_Token.
  [currency(CUR.provisionerToken)]: { dailyRate: 10, severity: 'high', label: 'Provisioner Token' },
  // Weekly raid-encounter lockouts; ~20/week for an active raider → ~3/day.
  // wiki.guildwars2.com/wiki/Legendary_Insight.
  [currency(CUR.legendaryInsight)]: { dailyRate: 3, severity: 'high', label: 'Legendary Insight' },
  // No hard cap, but the craft-and-salvage loop is a real grind (Obsidian armor
  // needs up to 5,000 per piece via Hydrocatalytic Reagents). Gold-convertible,
  // so bump the slider if you're willing to burn gold on salvage fodder.
  // wiki.guildwars2.com/wiki/Research_Note.
  [currency(CUR.researchNote)]: { dailyRate: 250, severity: 'high', label: 'Research Note' },

  // --- medium: hard daily/weekly caps ----------------------------------------
  // Hard cap: charging 25 quartz at a place of power is once/day/account.
  // wiki.guildwars2.com/wiki/Charged_Quartz_Crystal.
  [ITEM.chargedQuartzCrystal]: { dailyRate: 1, severity: 'medium', label: 'Charged Quartz Crystal' },
  // The four ascended-refinement materials below are each a once/day/account
  // craft. wiki.guildwars2.com/wiki/Lump_of_Mithrillium (and siblings).
  [ITEM.lumpOfMithrillium]: { dailyRate: 1, severity: 'medium', label: 'Lump of Mithrillium' },
  [ITEM.spoolOfThickElonianCord]: { dailyRate: 1, severity: 'medium', label: 'Spool of Thick Elonian Cord' },
  [ITEM.globOfElderSpiritResidue]: { dailyRate: 1, severity: 'medium', label: 'Glob of Elder Spirit Residue' },
  [ITEM.spoolOfSilkWeavingThread]: { dailyRate: 1, severity: 'medium', label: 'Spool of Silk Weaving Thread' },
  // One WvW reward track ≈ 6-8h of play → ~1 per 2 days sustained (stockpiled
  // potions can burst). wiki.guildwars2.com/wiki/Gift_of_Battle.
  [ITEM.giftOfBattle]: { dailyRate: 0.5, severity: 'medium', label: 'Gift of Battle' },
  // Post-80 XP levels + Tomes of Knowledge; ~8/day of active play.
  [currency(CUR.spiritShard)]: { dailyRate: 8, severity: 'medium', label: 'Spirit Shard' },
  // Weekly raid clears (~100/week active) → ~15/day.
  [currency(CUR.magnetiteShard)]: { dailyRate: 15, severity: 'medium', label: 'Magnetite Shard' },
  // PvP league reward-track repeats, only while a season runs → ~1/day averaged.
  [currency(CUR.pvpLeagueTicket)]: { dailyRate: 1, severity: 'medium', label: 'PvP League Ticket' },
  // PvP league weekly cadence (~50/week in season) → ~7/day.
  [currency(CUR.ascendedShardsOfGlory)]: { dailyRate: 7, severity: 'medium', label: 'Ascended Shards of Glory' },
  // WvW level-ups / skirmish chests while playing EoD-linked WvW.
  [currency(CUR.testimonyOfJadeHeroics)]: { dailyRate: 10, severity: 'medium', label: 'Testimony of Jade Heroics' },
  [currency(CUR.testimonyOfCastoranHeroics)]: { dailyRate: 10, severity: 'medium', label: 'Testimony of Castoran Heroics' },
  // Vendor-sold for Imperial Favor (EoD meta cadence) → ~2/day sustained.
  [ITEM.blessingOfTheJadeEmpress]: { dailyRate: 2, severity: 'medium', label: 'Blessing of the Jade Empress' },
  // LS3 map materials: daily node caps per character; multi-char loop ~25/day.
  // wiki.guildwars2.com/wiki/Blood_Ruby (and siblings).
  [ITEM.bloodRuby]: { dailyRate: 25, severity: 'medium', label: 'Blood Ruby' },
  [ITEM.petrifiedWood]: { dailyRate: 25, severity: 'medium', label: 'Petrified Wood' },
  [ITEM.freshWinterberry]: { dailyRate: 25, severity: 'medium', label: 'Fresh Winterberry' },
  [ITEM.jadeShard]: { dailyRate: 25, severity: 'medium', label: 'Jade Shard' },
  [ITEM.fireOrchidBlossom]: { dailyRate: 25, severity: 'medium', label: 'Fire Orchid Blossom' },
  [ITEM.orrianPearl]: { dailyRate: 25, severity: 'medium', label: 'Orrian Pearl' },
  // LS4 map materials: daily map caps / bounded farms, same shape as LS3.
  [ITEM.kralkatiteOre]: { dailyRate: 25, severity: 'medium', label: 'Kralkatite Ore' },
  [ITEM.difluoriteCrystal]: { dailyRate: 25, severity: 'medium', label: 'Difluorite Crystal' },
  [ITEM.inscribedShard]: { dailyRate: 25, severity: 'medium', label: 'Inscribed Shard' },
  [ITEM.lumpOfMistonium]: { dailyRate: 25, severity: 'medium', label: 'Lump of Mistonium' },
  [ITEM.brandedMass]: { dailyRate: 25, severity: 'medium', label: 'Branded Mass' },
  [ITEM.mistbornMote]: { dailyRate: 25, severity: 'medium', label: 'Mistborn Mote' },
  // Homestead refinement: fed by daily homestead node harvests.
  // wiki.guildwars2.com/wiki/Refined_Homestead_Wood (and siblings).
  [ITEM.refinedHomesteadWood]: { dailyRate: 15, severity: 'medium', label: 'Refined Homestead Wood' },
  [ITEM.refinedHomesteadMetal]: { dailyRate: 15, severity: 'medium', label: 'Refined Homestead Metal' },
  [ITEM.refinedHomesteadFiber]: { dailyRate: 15, severity: 'medium', label: 'Refined Homestead Fiber' },
  // Renown-heart vendor tokens: hearts reset daily, ~5 hearts/map.
  [ITEM.janthirSyntriRenownToken]: { dailyRate: 5, severity: 'medium', label: 'Janthir Syntri Renown Token' },
  [ITEM.lowlandShoreRenownToken]: { dailyRate: 5, severity: 'medium', label: 'Lowland Shore Renown Token' },
  // SotO rift-hunt conversions (motivation-limited) → ~3/day each.
  [ITEM.pouchOfStardust]: { dailyRate: 3, severity: 'medium', label: 'Pouch of Stardust' },
  [ITEM.caseOfCapturedLightning]: { dailyRate: 3, severity: 'medium', label: 'Case of Captured Lightning' },
  [ITEM.clotOfCongealedScreams]: { dailyRate: 3, severity: 'medium', label: 'Clot of Congealed Screams' },
  // Istan renown-heart vendor purchase — daily heart gate. wiki: Sun Bead.
  [ITEM.sunBeads]: { dailyRate: 25, severity: 'medium', label: 'Sun Beads' },

  // --- low: farmable, just not overnight --------------------------------------
  // Karma vendors (temples) / fractals; the real gate is karma income.
  [ITEM.obsidianShard]: { dailyRate: 50, severity: 'low', label: 'Obsidian Shard' },
  // Salvage-volume driven; 250 Exotic = 5,000 Fine essences.
  [ITEM.exoticEssenceOfLuck]: { dailyRate: 15, severity: 'low', label: 'Exotic Essence of Luck' },
  // One per ascended weapon/armor salvage (Ascended Salvage Tool).
  [ITEM.ballOfDarkEnergy]: { dailyRate: 1, severity: 'low', label: 'Ball of Dark Energy' },
  // Dragon's Stand meta + noxious pods, ~40/run.
  [ITEM.crystallineOre]: { dailyRate: 40, severity: 'low', label: 'Crystalline Ore' },
  // The three eater-food mats accumulate passively from champ bags / world
  // bosses / fractals — plentiful for veterans, slow for fresh accounts.
  [ITEM.pileOfBloodstoneDust]: { dailyRate: 100, severity: 'low', label: 'Pile of Bloodstone Dust' },
  [ITEM.dragoniteOre]: { dailyRate: 100, severity: 'low', label: 'Dragonite Ore' },
  [ITEM.empyrealFragment]: { dailyRate: 100, severity: 'low', label: 'Empyreal Fragment' },
  // Fractal dailies, ~40/day for a daily-page runner.
  [currency(CUR.fractalRelic)]: { dailyRate: 40, severity: 'low', label: 'Fractal Relic' },
  // Earned everywhere; ~30k/day of active play. Registered so a fresh account
  // sees the 900k-karma wall instead of a silent "grind-only" bucket.
  [currency(CUR.karma)]: { dailyRate: 30000, severity: 'low', label: 'Karma' },
  // WvW passive income while chasing Gift of Battle / heroics.
  [currency(CUR.badgeOfHonor)]: { dailyRate: 100, severity: 'low', label: 'Badge of Honor' },
  // HoT map currencies: meta chains + chest farms, ~150/day per map.
  [currency(CUR.airshipPart)]: { dailyRate: 150, severity: 'low', label: 'Airship Part' },
  [currency(CUR.leyLineCrystal)]: { dailyRate: 150, severity: 'low', label: 'Ley Line Crystal' },
  [currency(CUR.lumpOfAurillium)]: { dailyRate: 150, severity: 'low', label: 'Lump of Aurillium' },
  // HoT map items (Gen2 precursor walls), bought/farmed alongside the above.
  [ITEM.leyLineSpark]: { dailyRate: 50, severity: 'low', label: 'Ley Line Spark' },
  [ITEM.pileOfAuricDust]: { dailyRate: 50, severity: 'low', label: 'Pile of Auric Dust' },
  [ITEM.bottleOfAirshipOil]: { dailyRate: 50, severity: 'low', label: 'Bottle of Airship Oil' },
  // EoD chest/achievement drip.
  [currency(CUR.ancientCoin)]: { dailyRate: 25, severity: 'low', label: 'Ancient Coin' },
  // Dungeon runs, ~150/day of focused delving.
  [currency(CUR.talesOfDungeonDelving)]: { dailyRate: 150, severity: 'low', label: 'Tales of Dungeon Delving' },
  // SotO rifts; drops alongside essences.
  [ITEM.amalgamatedRiftEssence]: { dailyRate: 5, severity: 'low', label: 'Amalgamated Rift Essence' },
  // PoF trade contracts / Elegy vendor.
  [ITEM.funeraryIncense]: { dailyRate: 25, severity: 'low', label: 'Funerary Incense' },
  // Visions of Eternity map currencies (event/heart income).
  [currency(CUR.staticCharge)]: { dailyRate: 50, severity: 'low', label: 'Static Charge' },
  [currency(CUR.pinchOfStardust)]: { dailyRate: 50, severity: 'low', label: 'Pinch of Stardust' },
  [currency(CUR.calcifiedGasp)]: { dailyRate: 50, severity: 'low', label: 'Calcified Gasp' },
  [currency(CUR.antiquatedDucat)]: { dailyRate: 50, severity: 'low', label: 'Antiquated Ducat' },
  [currency(CUR.aetherRichSap)]: { dailyRate: 50, severity: 'low', label: 'Aether-Rich Sap' },
  // Janthir events/hearts reward 2-8 a pop (wiki) — high volume, high need (9,750).
  [currency(CUR.ursusOblige)]: { dailyRate: 400, severity: 'low', label: 'Ursus Oblige' },
  // JW/VoE curio drip.
  [ITEM.curiousLowlandHoneycomb]: { dailyRate: 10, severity: 'low', label: 'Curious Lowland Honeycomb' },
  [ITEM.curiousMursaatCurrency]: { dailyRate: 10, severity: 'low', label: 'Curious Mursaat Currency' },
  [ITEM.curiousMursaatRemnants]: { dailyRate: 10, severity: 'low', label: 'Curious Mursaat Remnants' },
  [ITEM.curiousMursaatRuinShard]: { dailyRate: 10, severity: 'low', label: 'Curious Mursaat Ruin Shard' },
  // Skirmish reward-track finals + WvW objective events (wiki) → ~2/day.
  [ITEM.grandmasterMarkShard]: { dailyRate: 2, severity: 'low', label: 'Grandmaster Mark Shard' },
}

export const isTimeGated = (itemId: number) => itemId in TIME_GATED

// --- Account-bound manifest (authoritative /v2/items flags) ------------------

/** Item ids flagged AccountBound/SoulbindOnAcquire on the GW2 API — these can
 *  never be bought on the Trading Post, whatever a recipe node claims.
 *  Generated by `npm run wiki:account-bound`; rerun after catalog changes. */
const ACCOUNT_BOUND: ReadonlySet<number> = new Set(
  Object.keys(accountBoundTable as Record<string, string>).map(Number),
)

export const isAccountBound = (itemId: number): boolean => ACCOUNT_BOUND.has(itemId)

/**
 * Save-your-materials guidance for leaves that players routinely consume or
 * sell before realizing a legendary needs them. Rendered in the recipe tree
 * and as a tooltip on the Materials list.
 */
export const ITEM_NOTES: Record<number, string> = {
  // Exotic Essence of Luck — Gift of Research needs 250 per gift.
  45178:
    'Account-bound. Stop consuming Essences of Luck into wallet luck while saving — ' +
    '250 Exotic = 5,000 Fine essences (combine up-tier at an artificer or the forge).',
  // The three "eater-food" ascended materials (Vision Crystal refinements).
  46731: "Don't feed Bloodstone Dust to Mawdrey II while saving — Vision Crystals need it.",
  46733: "Don't feed Dragonite Ore to your eater while saving — Vision Crystals need it.",
  46735: "Don't feed Empyreal Fragments to your eater while saving — Vision Crystals need it.",
  // Ball of Dark Energy — salvage, don't sell/consume ascended gear carelessly.
  71994:
    'Account-bound; salvage ascended equipment with an Ascended Salvage Tool ' +
    '(guaranteed from weapons/armor) — one per Cube of Stabilized Dark Energy.',
}

// --- Material classification (grouping + game-mode tags) --------------------

/**
 * Acquisition bucket for a material, from its id namespace + recipe source.
 * Currencies and time-gated dailies are recognized by id; everything else maps
 * from the producing node's source, with gift names falling back to 'gift'.
 */
export function materialCategory(
  itemId: number,
  source?: RecipeSource,
  name?: string,
): MaterialCategory {
  // Deliberate precedence: a gated wallet currency (Spirit Shard, Legendary
  // Insight, …) stays in the 'currency' acquisition bucket — the gate-centric
  // view is the phase grouping / Forecast, driven by timeGate.isGated, which
  // is category-independent.
  if (isCurrency(itemId)) return 'currency'
  if (isTimeGated(itemId)) return 'time-gated'
  switch (source) {
    case 'reward-track':
      return 'reward-track'
    case 'achievement':
      return 'achievement'
    case 'collection':
      return 'collection'
    case 'vendor':
      return 'vendor'
  }
  if (name && /^gift of\b/i.test(name)) return 'gift'
  return 'crafting'
}

/** Best-effort game-mode tag from currency id or ingredient name. Undefined when unknown. */
export function gameModeFor(
  itemId: number,
  _source?: RecipeSource,
  name?: string,
): GameMode | undefined {
  if (isCurrency(itemId)) {
    const cur = itemId - CURRENCY_BASE
    if (cur === CUR.badgeOfHonor || cur === CUR.wvwSkirmishClaimTicket) return 'WvW'
    if (cur === CUR.magnetiteShard) return 'Raid'
    if (cur === CUR.fractalRelic || cur === CUR.pristineFractalRelic) return 'Fractal'
  }
  const n = (name ?? '').toLowerCase()
  if (/gift of battle|memory of battle|war (prosperity|prowess|dedication)|skirmish|badge of honor|proof of heroics|testimony of \w+ heroics/.test(n))
    return 'WvW'
  if (/league|mist core|star of glory|competitive|distilled glory|ascension to glory/.test(n)) return 'PvP'
  if (/legendary insight|legendary divination|chak egg|magnetite|gift of prowess|gift of dedication/.test(n)) return 'Raid'
  if (/fractal/.test(n)) return 'Fractal'
  return undefined
}
