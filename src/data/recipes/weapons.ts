// ---------------------------------------------------------------------------
// Full legendary weapon catalog (Gen1–3 + standalones), wiki-verified.
//
// Every weapon is assembled from its TOP-LEVEL Mystic Forge components exactly
// as the GW2 Wiki lists them (see scripts/wiki-sync/snapshot/weapons.json) via
// `assembleLegendary`: shared gifts (Gift of Fortune / Gift of Mastery / Mystic
// Tribute / Draconic Tribute) expand into their real, costed leaf trees, and the
// per-weapon precursor + themed/mastery gifts are leaves carrying their real GW2
// item ids (resolved from each component's wiki infobox — so they price on the
// TP and match the armory). Because the root inputs mirror the wiki, the
// `npm run wiki:check` gate enforces these recipes stay correct; all ship
// verified:true. Aetheric Anchor (dual unlock) and Eternity (Sunrise + Twilight)
// are hand-modeled below.
// ---------------------------------------------------------------------------

import type { AcquisitionMode, LegendaryPiece, RecipeNode } from '../../types'
import { ITEM } from '../items'
import {
  ref,
  node,
  giftOfCondensedMight,
  giftOfCondensedMagic,
  assembleLegendary,
  type TopComponent,
} from './_builders'

interface WeaponSpec {
  id: number
  name: string
  type: string
  mode: AcquisitionMode
  gen: string
  wikiUrl: string
  components: TopComponent[]
}

// --- Aetheric Anchor — dual unlock, no precursor, heart-vendor gifts --------
// Wiki-verified, id 105497. A legendary CONTAINER that yields both Ancora Bellum
// (spear) and Ancora Pax (staff). Final forge combine:
//   Gift of the Survivors + Gift of the People + Gift of Insight + Gift of the Elders
// The four gifts are heart-vendor purchases (NOT forge recipes), except Gift of
// Insight which bundles the big time-gate: 100 Mystic Clovers + 55 Amalgamated
// Draconic Lodestones + 4 Gift of Condensed Might + 4 Gift of Condensed Magic.
function aethericAnchor(): LegendaryPiece {
  const id = 105497
  const spearUnlock = 106273 // Ancora Bellum (wiki armory id)
  const staffUnlock = 105653 // Ancora Pax (wiki armory id)
  const cMightX4 = giftOfCondensedMight()
  const cMagicX4 = giftOfCondensedMagic()
  const survivors = ref(ITEM.giftOfTheSurvivors, 'Gift of the Survivors', 1)
  const people = ref(ITEM.giftOfThePeople, 'Gift of the People', 1)
  const insight = ref(ITEM.giftOfInsight, 'Gift of Insight', 1)
  const elders = ref(ITEM.giftOfTheElders, 'Gift of the Elders', 1)
  const root = ref(id, 'Aetheric Anchor', 1)
  const nodes: RecipeNode[] = [
    node(root, [survivors, people, insight, elders], {
      source: 'mystic-forge',
      notes: 'No precursor; four Visions of Eternity gifts (mostly heart-vendor).',
    }),
    node(survivors, [], {
      source: 'vendor',
      notes: 'Heart vendor (Shipwreck Strand): map-completion gift + Aether-Rich Sap',
    }),
    node(people, [], {
      source: 'vendor',
      notes: 'Heart vendor (Starlit Weald): map-completion gift + Antiquated Ducats',
    }),
    // Gift of Insight carries the dominant time-gate (100 clovers).
    node(
      insight,
      [
        ref(ITEM.mysticClover, 'Mystic Clover', 100),
        ref(ITEM.amalgamatedDraconicLodestone, 'Amalgamated Draconic Lodestone', 55),
        { ...cMightX4.out, qty: 4 },
        { ...cMagicX4.out, qty: 4 },
      ],
      { source: 'vendor', notes: 'Bought from Lyhr; NOT a forge recipe (forge yields Draconic Tribute instead).' }
    ),
    node(elders, [], {
      source: 'vendor',
      notes: 'Heart vendor (Major Emund): Bloodstone Shard + Gift of Research + Gift of the Mists; story Act II clear',
    }),
    ...cMightX4.nodes,
    ...cMagicX4.nodes,
  ]
  return {
    id,
    name: 'Aetheric Anchor',
    slot: 'weapon',
    type: 'Spear + Staff (dual unlock)',
    acquisitionMode: 'open-world',
    unlocks: [spearUnlock, staffUnlock],
    blurb:
      'One craft, two armory unlocks (Ancora Bellum spear + Ancora Pax staff). No precursor — four Visions of Eternity gifts; the 100-clover gate lives in Gift of Insight.',
    recipe: {
      rootItemId: id,
      nodes,
      verified: true,
      wikiUrl: 'https://wiki.guildwars2.com/wiki/Aetheric_Anchor',
      version: 2,
    },
  }
}

// --- Eternity — Sunrise + Twilight forged together --------------------------
function eternity(): LegendaryPiece {
  return assembleLegendary({
    id: 30689,
    name: 'Eternity',
    slot: 'weapon',
    type: 'Greatsword',
    acquisitionMode: 'crafting',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Eternity',
    blurb: 'Forge two finished legendaries: Sunrise + Twilight (+ dust + Philosopher’s Stones).',
    components: [
      { name: 'Sunrise', qty: 1, itemId: 30703, buyable: false, notes: 'Requires a complete Sunrise' },
      { name: 'Twilight', qty: 1, itemId: 30704, buyable: false, notes: 'Requires a complete Twilight' },
      { name: 'Pile of Crystalline Dust', qty: 5, itemId: 24277, buyable: true, source: 'vendor' },
      { name: "Philosopher's Stone", qty: 10, itemId: 20796, buyable: true, source: 'vendor' },
    ],
  })
}

// --- Generated from the wiki snapshot (scripts/wiki-sync/gen-weapon-data.mjs).
// Shared gifts are listed WITHOUT an id so the factory expands their leaf trees.
const WEAPON_DATA: WeaponSpec[] = [
  { id: 30684, name: 'Frostfang', type: 'Axe', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Frostfang',
    components: [
      { name: 'Tooth of Frostfang', qty: 1, itemId: 29166 },
      { name: 'Gift of Frostfang', qty: 1, itemId: 19625 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30687, name: 'Incinerator', type: 'Dagger', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Incinerator',
    components: [
      { name: 'Spark (weapon)', qty: 1, itemId: 29167 },
      { name: 'Gift of Incinerator', qty: 1, itemId: 19645 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30692, name: 'The Moot', type: 'Mace', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Moot',
    components: [
      { name: 'The Energizer', qty: 1, itemId: 29173 },
      { name: 'Gift of The Moot', qty: 1, itemId: 19650 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30693, name: 'Quip', type: 'Pistol', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Quip',
    components: [
      { name: 'Chaos Gun', qty: 1, itemId: 29174 },
      { name: 'Gift of Quip', qty: 1, itemId: 19651 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30695, name: 'Meteorlogicus', type: 'Scepter', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Meteorlogicus',
    components: [
      { name: 'Storm', qty: 1, itemId: 29176 },
      { name: 'Gift of Meteorlogicus', qty: 1, itemId: 19652 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30699, name: 'Bolt', type: 'Sword', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Bolt',
    components: [
      { name: 'Zap', qty: 1, itemId: 29181 },
      { name: 'Gift of Bolt', qty: 1, itemId: 19655 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30688, name: 'The Minstrel', type: 'Focus', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Minstrel',
    components: [
      { name: 'The Bard', qty: 1, itemId: 29168 },
      { name: 'Gift of The Minstrel', qty: 1, itemId: 19646 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30696, name: 'The Flameseeker Prophecies', type: 'Shield', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Flameseeker_Prophecies',
    components: [
      { name: 'The Chosen', qty: 1, itemId: 29177 },
      { name: 'Gift of The Flameseeker Prophecies', qty: 1, itemId: 19653 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30700, name: 'Rodgort', type: 'Torch', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Rodgort',
    components: [
      { name: 'Rodgort\'s Flame', qty: 1, itemId: 29182 },
      { name: 'Gift of Rodgort', qty: 1, itemId: 19656 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30702, name: 'Howler', type: 'Warhorn', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Howler',
    components: [
      { name: 'Howl', qty: 1, itemId: 29184 },
      { name: 'Gift of Howler', qty: 1, itemId: 19662 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30703, name: 'Sunrise', type: 'Greatsword', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Sunrise',
    components: [
      { name: 'Dawn', qty: 1, itemId: 29169 },
      { name: 'Gift of Sunrise', qty: 1, itemId: 19647 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30704, name: 'Twilight', type: 'Greatsword', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Twilight',
    components: [
      { name: 'Dusk', qty: 1, itemId: 29185 },
      { name: 'Gift of Twilight', qty: 1, itemId: 19648 },
      { name: 'Gift of Mastery', qty: 1 },
      { name: 'Gift of Fortune', qty: 1 },
    ] },
  { id: 30690, name: 'The Juggernaut', type: 'Hammer', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Juggernaut',
    components: [
      { name: 'The Colossus', qty: 1, itemId: 29170 },
      { name: 'Gift of The Juggernaut', qty: 1, itemId: 19649 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30685, name: 'Kudzu', type: 'Longbow', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Kudzu',
    components: [
      { name: 'Leaf of Kudzu', qty: 1, itemId: 29172 },
      { name: 'Gift of Kudzu', qty: 1, itemId: 19644 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30694, name: 'The Predator', type: 'Rifle', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Predator',
    components: [
      { name: 'The Hunter', qty: 1, itemId: 29175 },
      { name: 'Gift of The Predator', qty: 1, itemId: 19661 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30686, name: 'The Dreamer', type: 'Short bow', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Dreamer',
    components: [
      { name: 'The Lover', qty: 1, itemId: 29178 },
      { name: 'Gift of The Dreamer', qty: 1, itemId: 19660 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30698, name: 'The Bifrost', type: 'Staff', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Bifrost',
    components: [
      { name: 'The Legend', qty: 1, itemId: 29180 },
      { name: 'Gift of The Bifrost', qty: 1, itemId: 19654 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30697, name: 'Frenzy', type: 'Harpoon gun', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Frenzy',
    components: [
      { name: 'Rage (weapon)', qty: 1, itemId: 29179 },
      { name: 'Gift of Frenzy', qty: 1, itemId: 19659 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30691, name: 'Kamohoali\'i Kotaki', type: 'Spear', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Kamohoali\'i_Kotaki',
    components: [
      { name: 'Carcharias', qty: 1, itemId: 29171 },
      { name: 'Gift of Kamohoali\'i Kotaki', qty: 1, itemId: 19657 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 30701, name: 'Kraitkin', type: 'Trident', mode: 'crafting', gen: 'Generation 1',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Kraitkin',
    components: [
      { name: 'Venom (weapon)', qty: 1, itemId: 29183 },
      { name: 'Gift of Kraitkin', qty: 1, itemId: 19658 },
      { name: 'Gift of Fortune', qty: 1 },
      { name: 'Gift of Mastery', qty: 1 },
    ] },
  { id: 76158, name: 'Astralaria', type: 'Axe', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Astralaria',
    components: [
      { name: 'The Mechanism', qty: 1, itemId: 71426 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Astralaria', qty: 1, itemId: 71972 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 87109, name: 'Claw of the Khan-Ur', type: 'Dagger', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Claw_of_the_Khan-Ur',
    components: [
      { name: 'Claw of Resolution', qty: 1, itemId: 87037 },
      { name: 'Gift of the Four Legions', qty: 1, itemId: 87115 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 79562, name: 'Eureka', type: 'Mace', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Eureka',
    components: [
      { name: 'Endeavor', qty: 1, itemId: 79570 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Eureka', qty: 1, itemId: 79419 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 72713, name: 'HOPE', type: 'Pistol', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/HOPE',
    components: [
      { name: 'Prototype', qty: 1, itemId: 76399 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of HOPE', qty: 1, itemId: 77086 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 88576, name: 'Xiuquatl', type: 'Scepter', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Xiuquatl',
    components: [
      { name: 'Tlehco', qty: 1, itemId: 88851 },
      { name: 'Gift of Xiuquatl', qty: 1, itemId: 88500 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 81957, name: 'The Shining Blade', type: 'Sword', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Shining_Blade',
    components: [
      { name: 'Save the Queen', qty: 1, itemId: 81812 },
      { name: 'Gift of the Blade', qty: 1, itemId: 82003 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 86098, name: 'The Binding of Ipos', type: 'Focus', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_Binding_of_Ipos',
    components: [
      { name: 'Ars Goetia', qty: 1, itemId: 86097 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Ipos', qty: 1, itemId: 85744 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 79802, name: 'Shooshadoo', type: 'Shield', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Shooshadoo',
    components: [
      { name: 'Friendship', qty: 1, itemId: 79836 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Shooshadoo', qty: 1, itemId: 79839 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 81206, name: 'Flames of War', type: 'Torch', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Flames_of_War',
    components: [
      { name: 'Liturgy', qty: 1, itemId: 81022 },
      { name: 'Gift of Balthazar', qty: 1, itemId: 81144 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 87687, name: 'Verdarach', type: 'Warhorn', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Verdarach',
    components: [
      { name: 'Call of the Void', qty: 1, itemId: 87764 },
      { name: 'Gift of Verdarach', qty: 1, itemId: 88060 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 90551, name: 'Exordium', type: 'Greatsword', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Exordium',
    components: [
      { name: 'Exitare', qty: 1, itemId: 90883 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Exordium', qty: 1, itemId: 90893 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 81839, name: 'Sharur', type: 'Hammer', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Sharur',
    components: [
      { name: 'Might of Arah', qty: 1, itemId: 81634 },
      { name: 'Gift of Arah', qty: 1, itemId: 81684 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 89854, name: 'Pharus', type: 'Longbow', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Pharus',
    components: [
      { name: 'Spero', qty: 1, itemId: 89886 },
      { name: 'Gift of Pharus', qty: 1, itemId: 89445 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 80488, name: 'The HMS Divinity', type: 'Rifle', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/The_HMS_Divinity',
    components: [
      { name: 'Man o\' War', qty: 1, itemId: 80135 },
      { name: 'Gift of Divinity', qty: 1, itemId: 80650 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 78556, name: 'Chuka and Champawat', type: 'Short bow', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Chuka_and_Champawat',
    components: [
      { name: 'Tigris', qty: 1, itemId: 78425 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Chuka and Champawat', qty: 1, itemId: 78627 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 71383, name: 'Nevermore', type: 'Staff', mode: 'crafting', gen: 'Generation 2',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Nevermore',
    components: [
      { name: 'The Raven Staff', qty: 1, itemId: 74068 },
      { name: 'Mystic Tribute', qty: 1 },
      { name: 'Gift of Nevermore', qty: 1, itemId: 74300 },
      { name: 'Gift of Maguuma Mastery', qty: 1, itemId: 73239 },
    ] },
  { id: 96937, name: 'Aurene\'s Rending', type: 'Axe', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Rending',
    components: [
      { name: 'Gift of Aurene\'s Rending', qty: 1, itemId: 97804 },
      { name: 'Dragon\'s Rending', qty: 1, itemId: 97449 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 96203, name: 'Aurene\'s Claw', type: 'Dagger', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Claw',
    components: [
      { name: 'Gift of Aurene\'s Claw', qty: 1, itemId: 97066 },
      { name: 'Dragon\'s Claw (weapon)', qty: 1, itemId: 95967 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 95612, name: 'Aurene\'s Tail', type: 'Mace', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Tail',
    components: [
      { name: 'Gift of Aurene\'s Tail', qty: 1, itemId: 95846 },
      { name: 'Dragon\'s Tail', qty: 1, itemId: 96827 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 95808, name: 'Aurene\'s Argument', type: 'Pistol', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Argument',
    components: [
      { name: 'Gift of Aurene\'s Argument', qty: 1, itemId: 96493 },
      { name: 'Dragon\'s Argument', qty: 1, itemId: 96915 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 96221, name: 'Aurene\'s Wisdom', type: 'Scepter', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Wisdom',
    components: [
      { name: 'Gift of Aurene\'s Wisdom', qty: 1, itemId: 97552 },
      { name: 'Dragon\'s Wisdom', qty: 1, itemId: 96193 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 95675, name: 'Aurene\'s Fang', type: 'Sword', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Fang',
    components: [
      { name: 'Gift of Aurene\'s Fang', qty: 1, itemId: 96790 },
      { name: 'Dragon\'s Fang', qty: 1, itemId: 95994 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 97165, name: 'Aurene\'s Gaze', type: 'Focus', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Gaze',
    components: [
      { name: 'Gift of Aurene\'s Gaze', qty: 1, itemId: 97088 },
      { name: 'Dragon\'s Gaze', qty: 1, itemId: 96303 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 96028, name: 'Aurene\'s Scale', type: 'Shield', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Scale',
    components: [
      { name: 'Gift of Aurene\'s Scale', qty: 1, itemId: 96073 },
      { name: 'Dragon\'s Scale', qty: 1, itemId: 97691 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 97099, name: 'Aurene\'s Breath', type: 'Torch', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Breath',
    components: [
      { name: 'Gift of Aurene\'s Breath', qty: 1, itemId: 95922 },
      { name: 'Dragon\'s Breath', qty: 1, itemId: 96925 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 97783, name: 'Aurene\'s Voice', type: 'Warhorn', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Voice',
    components: [
      { name: 'Gift of Aurene\'s Horn', qty: 1, itemId: 96354 },
      { name: 'Dragon\'s Voice', qty: 1, itemId: 97513 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 96356, name: 'Aurene\'s Bite', type: 'Greatsword', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Bite',
    components: [
      { name: 'Gift of Aurene\'s Bite', qty: 1, itemId: 97027 },
      { name: 'Dragon\'s Bite', qty: 1, itemId: 96357 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 95684, name: 'Aurene\'s Weight', type: 'Hammer', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Weight',
    components: [
      { name: 'Gift of Aurene\'s Weight', qty: 1, itemId: 96161 },
      { name: 'Dragon\'s Weight', qty: 1, itemId: 95920 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 97590, name: 'Aurene\'s Flight', type: 'Longbow', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Flight',
    components: [
      { name: 'Gift of Aurene\'s Flight', qty: 1, itemId: 95777 },
      { name: 'Dragon\'s Flight', qty: 1, itemId: 95834 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 97377, name: 'Aurene\'s Persuasion', type: 'Rifle', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Persuasion',
    components: [
      { name: 'Gift of Aurene\'s Persuasion', qty: 1, itemId: 97412 },
      { name: 'Dragon\'s Persuasion', qty: 1, itemId: 97267 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 97077, name: 'Aurene\'s Wing', type: 'Short Bow', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Wing',
    components: [
      { name: 'Gift of Aurene\'s Wing', qty: 1, itemId: 96015 },
      { name: 'Dragon\'s Wing', qty: 1, itemId: 96330 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 96652, name: 'Aurene\'s Insight', type: 'Staff', mode: 'crafting', gen: 'Generation 3',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Aurene\'s_Insight',
    components: [
      { name: 'Gift of Aurene\'s Insight', qty: 1, itemId: 97281 },
      { name: 'Dragon\'s Insight', qty: 1, itemId: 95814 },
      { name: 'Gift of Jade Mastery', qty: 1, itemId: 96033 },
      { name: 'Draconic Tribute', qty: 1 },
    ] },
  { id: 103815, name: 'Klobjarne Geirr', type: 'Spear', mode: 'open-world', gen: 'Janthir Wilds',
    wikiUrl: 'https://wiki.guildwars2.com/wiki/Klobjarne_Geirr',
    components: [
      { name: 'Gift of Janthir Wilds', qty: 1, itemId: 102514 },
      { name: 'Gift of the Homesteader', qty: 1, itemId: 102376 },
      { name: 'Gift of Klobjarne Geirr', qty: 1, itemId: 102901 },
      { name: 'Nyr Hrammr', qty: 1, itemId: 103973 },
    ] },
]

export const WEAPONS: LegendaryPiece[] = [
  aethericAnchor(),
  eternity(),
  ...WEAPON_DATA.map((w) =>
    assembleLegendary({
      id: w.id,
      name: w.name,
      slot: 'weapon',
      type: w.type,
      acquisitionMode: w.mode,
      wikiUrl: w.wikiUrl,
      blurb: `${w.gen} ${w.type.toLowerCase()}.`,
      components: w.components,
    })
  ),
]
