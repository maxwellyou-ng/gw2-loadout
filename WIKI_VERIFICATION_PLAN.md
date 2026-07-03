# Cowork manual pass — what's left after the automated work

**Audience:** a Claude Cowork (Sonnet) session in `gw2-loadout/`.

Claude Code has finished the automatable work (summary below). What remains needs **human eyes on
rendered wiki pages** — QA of auto-extracted data and a few judgement calls the wiki can't be parsed
for. The list is small.

---

## What Claude Code already did (context — don't redo)

- **Verified the craftable gifts.** `npm run wiki:fetch` now matches **141 / 143** intermediate gift
  recipes to the wiki → `src/data/verified-intermediates.ts`. (Was 28.)
- **Vendor gifts now expand to their cost.** New extractor `npm run wiki:vendor-costs`
  (`scripts/wiki-sync/gen-vendor-costs.ts`) reads each vendor gift's **rendered** Acquisition table and
  emits `src/data/recipes/generated/vendor-costs.generated.json` (41 gifts). Wired into
  `buildGiftSubTree`, so e.g. Gift of Gliding → 300 Airship Part + 300 Ley Line Crystal + 300 Lump of
  Aurillium, Gift of the Itzel → 500 Airship Part + 1 Gold — all tracked wallet currencies.
- **Resolved real item ids** for ~190 material-leaf inputs (gift table) + 43 vendor item-tenders, from
  each item's wiki infobox, so they track against inventory.
- **Fixed acquisition classification** (`classifyAcq`): vendor requires `{{Sold by}}`; everything else
  with no recipe is a whole-reward leaf. Gift of Battle pinned to reward.
- **Provenance fix** (`src/engine/progress.ts`): a synthetic terminal **leaf** is now `summarized`
  (a known stand-in), not `unverified`. `unverified` is reserved for craftable intermediates not yet
  matched to the wiki.

**Result:** of ~5,270 tree nodes, **84.9% verified, 12.2% summarized, 2.9% unverified.** The
`unverified` (yellow) tags now reduce to **8 distinct nodes** from **3 root causes** (below).
`npm run wiki:check`, `npm run check`, `npx tsc -b`, and `npm run build` are all green.

---

## The remaining yellow (8 nodes, 3 roots) — your main job

Resolving the 3 parents also clears their cascading children (the other 5).

### 1. Bloodstone Shard & Fractalline Spark — vendor items, no parseable `{{recipe}}`
Their cost is rendered prose/vendor, not a machine-readable recipe, so they stay yellow. The modelled
costs are **Bloodstone Shard = 200 Spirit Shards** (Mystic Forge / Miyani) and **Fractalline Spark**
(fractal vendor). 
- **Do:** open each wiki page, confirm the exact cost the catalog models is correct.
- **Then mark verified** via a small manual-override lane (these can't auto-verify):
  - Create `scripts/wiki-sync/manual-verified.ts` → `export const MANUAL_VERIFIED = ['Bloodstone Shard', 'Fractalline Spark']` (each with a `// confirmed <date> vs <wiki URL>` comment).
  - In `scripts/wiki-sync/snapshot.ts → writeManifest`, union `MANUAL_VERIFIED` into `verifiedNames` before writing.
  - Re-run `npm run wiki:fetch`; confirm both (and their children Spirit Shard / Fractalline Dust) go green.
- Only use this lane for recipes you've personally confirmed and that genuinely have no `{{recipe}}`.

### 2. Strife Unending — `verified:false` trinket (`src/data/recipes/trinkets.ts:~178`)
Its 45-clover count is **inferred**, not wiki-confirmed. Open the wiki, confirm the real recipe +
quantity, correct the data, set `verified: true`. Clears its Mystic Clover + gift children.

### 3. Selachimorpha — `verified:false` aquabreather (`src/data/recipes/armor.ts:~340`)
Currently an empty collection leaf. Check the wiki for a craftable recipe: if one exists, model it and
set `verified:true`; if it's purely collection-gated, leave it and document why in the blurb.

---

## QA passes (verify the auto-extracted data against the rendered wiki)

The extractors are good but not infallible — spot-check on the rendered pages
(`https://wiki.guildwars2.com/wiki/<Gift>`, the **Acquisition → Cost** column):

1. **Coin denominations & multi-currency order** in `vendor-costs.generated.json`. Most at-risk:
   - **Gift of the Hylek** (parsed "200 Gold + 250 Karma" — verify the gold amount isn't a
     silver/copper mis-scale),
   - **Gift of Ascension** (Fractal Relic + silver/copper coin),
   - **Gift of Persistence / Gift of the Ursus** (multi-currency — confirm each amount maps to the
     right currency, in order).
   Fix wrong values directly in `vendor-costs.generated.json` (or improve `parseVendorCost` in
   `gen-vendor-costs.ts`, then re-run `npm run wiki:vendor-costs`).
2. **Reward vs vendor classification.** Skim the 14 `reward` and 41 `vendor` gifts in
   `gifts.generated.json`; confirm each `reward` is truly received whole (no cost) and each `vendor`
   truly costs something. If any is mislabelled, add it to `REWARD_OVERRIDE` in `gen-gifts.ts` (for
   reward-track/story items carrying a historical `{{Sold by}}`) and re-run `npm run wiki:gifts`.
3. **Item-tender ids.** 1 unresolved: **Tale of Dungeon Delving** (id stays null → synthetic leaf).
   Find its id on the wiki and add it (overlay or `ITEM`). Spot-check that a few auto-resolved tenders
   (e.g. Blood Ruby, Petrified Wood, Antique Summoning Stone) point at the right items.

---

## Expected leaves (no action — confirming these are correct)

These render as `summary` (grey) by design and should **not** be made expandable:
- **Raw materials** — ores, logs, planks, dusts, T6 fine mats, ingots, lodestones, Crystalline Ingot, etc.
- **Whole-reward gifts** — map completion (Gift of Exploration), story/achievement/collection (Gift of
  the Fleet, Tarir, the Chak, Dragon's End, Seitung Province, …), reward track (Gift of Battle).
- **Armor-set ascended bases** (18: Ardent Glorious / Triumphant Hero's / Refined Envoy pieces) — these
  expose **no per-piece API id**, so they're synthetic stand-ins rendered as `summary`. Leave as-is
  unless ArenaNet ever exposes per-piece ids.

---

## Optional — flip the UI to "assume verified"

Once you're happy with the residual, make green the silent default so only exceptions show:
- In `src/components/RecipeTree.tsx`, stop rendering the **✓ wiki** badge for `verified` nodes; keep
  **⚠ unverified** and **summary**.
- Optional legend: "Unbadged = wiki-verified · ⚠ = needs verification · summary = vendor/reward/raw leaf."

---

## Definition of done

- [ ] Bloodstone Shard & Fractalline Spark confirmed + manual-verified lane added → green.
- [ ] Strife Unending & Selachimorpha resolved or documented.
- [ ] Vendor-cost QA pass done (coins, multi-currency, classifications).
- [ ] Tale of Dungeon Delving id resolved.
- [ ] `npm run wiki:check`, `npm run check`, `npx tsc -b`, `npm run build` all green.
- [ ] (Optional) UI flip applied.

## Commands & files

```bash
npm run wiki:gifts          # regenerate gift table (recipe + acq + leaf ids)
npm run wiki:vendor-costs   # extract vendor costs from rendered HTML
npm run wiki:fetch          # re-verify intermediates → verified-intermediates.ts
npm run wiki:report         # drift report          npm run wiki:check  # gate (keep green)
npm run wiki:expand -- "X"  # inspect one item's wiki recipe tree
npx tsc -b && npm run check && npm run build
```

| File | Role |
|---|---|
| `scripts/wiki-sync/gen-gifts.ts` | gift table + `classifyAcq` (`REWARD_OVERRIDE`) + leaf-id resolution. |
| `scripts/wiki-sync/gen-vendor-costs.ts` | vendor-cost extractor (`parseVendorCost`). |
| `src/data/recipes/generated/gifts.generated.json` | gift recipe + acq table. |
| `src/data/recipes/generated/vendor-costs.generated.json` | vendor purchase costs (QA target). |
| `src/data/recipes/_builders.ts` | `buildGiftSubTree` (merges costs), `hasGiftRecipe`. |
| `scripts/wiki-sync/snapshot.ts` | `wiki:fetch`; `writeManifest` (add `MANUAL_VERIFIED` union). |
| `scripts/wiki-sync/catalog-view.ts` | `catalogIntermediates()` (skips vendor-source nodes). |
| `src/engine/progress.ts` | provenance logic. |
| `src/data/recipes/{trinkets,armor}.ts` | Strife Unending / Selachimorpha. |
| `src/components/RecipeTree.tsx` | badges (optional UI flip). |
