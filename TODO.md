# TODO & maintainer notes

Conventions for changing this codebase, plus the work that's still open. For *usage* and
architecture, see [README.md](README.md).

## Current state (2026-06-20)

- **Catalog reach: done.** `CATALOG` holds **94 entries** (weapons 55, armor 26, trinkets 9,
  backs 4), covering all ~74 wiki legendaries plus weapon variants. `npm run wiki:check` is
  green (0 blocking, empty baseline).
- **Verification: effectively complete.** **92 of 94 entries are `verified: true`** and the
  wiki gate enforces each against its wiki snapshot (0 `UNVERIFIED`, 0 `SYNTHETIC_RESOLVABLE`).
  The 2 remaining `verified: false` are the genuinely-unverifiable special cases the gate
  reports as info, not gaps — **Selachimorpha** (collection aquabreather, no `{{recipe}}`) and
  **Strife Unending** (vendor-sold, no craftable recipe). They are correctly left unverified;
  promoting them would be dishonest. See "Known structural limits" below.
- **Generated layer is empty.** All 94 pieces live in the curated files; `generated/
  recipes.generated.json` is currently `[]`. The `wiki:fix` pipeline exists but no drafts are
  committed through it right now — the catalog is fully curated and already verified.

## Project structure & conventions

- **Where things live:**
  - `src/types/` — domain model and the source of truth for shapes (`LegendaryPiece`,
    `RecipeNode`, `DerivedProgress`, `LoadoutSlot`).
  - `src/data/recipes/` — curated trees: `weapons.ts`, `armor.ts`, `trinkets.ts`, `backs.ts`,
    shared sub-trees in `_builders.ts`; `index.ts` assembles `CATALOG` (curated + the
    machine-owned `generated/` layer, curated wins collisions by name *and* id).
  - `src/data/items.ts` — the `ITEM` id registry + the id-namespace helpers.
  - `src/engine/` — `computeProgress` (per-piece truth) and `loadout-progress.ts`
    (aggregation + selectors).
  - `src/screens/`, `src/components/`, `src/state/store.tsx`.
- **Adding a screen** = add a `<Route>` in `src/App.tsx` + a tab in
  `src/components/Layout.tsx` + a file in `src/screens/`.
- **Engine discipline:** all per-piece material math goes through `computeProgress`;
  whole-loadout totals go through the `src/engine/loadout-progress.ts` helpers
  (`aggregateRequirements`, `aggregateIntermediates`, `trackedSlots`, …). Don't re-implement
  recipe flattening. **Untracked slots are excluded from every total, everywhere.**
- **Recipe-builder pattern:** use `ref()` and `node()` (and the shared sub-trees) from
  `_builders.ts`. A node with no producing node, or with empty `inputs`, is a *leaf* (counted
  directly against inventory). To expand a synthetic placeholder, give it real `inputs`
  (ideally a real `output` id).
- **Data-edit ground rules:**
  - Never invent item ids — read them off the GW2 Wiki "API #####" infobox.
  - Respect the id-namespace: real `< 8_000_000`; wallet currencies `8_000_000 + id` via
    `currency()`; synthetic intermediates `9_000_000 + n` via `synthetic()`.
  - Add real ids to the `ITEM` registry rather than inlining magic numbers; reference as
    `ref(ITEM.foo, 'Foo', qty)`.
  - `verified: true` means the modelled tree was wiki cross-checked. A summarized synthetic
    sub-tree is allowed as long as the top combine + leaf quantities are confirmed.
- **Gates (keep green):** `npx tsc -b --noEmit` exits 0, `npm run check` prints
  "ALL CHECKS PASSED", `npm run wiki:check` passes (per-combine drift), and
  `npm run wiki:totals` passes (full-tree totals vs wiki + golden snapshot; after an
  intentional recipe/engine change re-bless with `npm run wiki:totals -- --update` and review
  the JSON diff). `npm run build` should also pass (a `*.node` native-binding/arch error is an
  environment issue, not a code issue). CI runs all of these on every push.
- **Consumption discipline:** crafting consumes materials. Whole-loadout `remaining` comes
  from the priority-order allocation walk (`allocateProgress`); multi-piece views read
  `allocatedBySlot` from the store, Compare stays isolation-based on purpose. Don't credit one
  owned stack (or banked gift) to two pieces.

## Remaining work — priority order

> The original #1 (promote drafts → `verified: true`) and #2 (component item-id resolution)
> are **done** — see the changelog. What's left is optional depth work, both gated behind
> live wiki fetches.

### 1. Auto-fix Phase 4 — recursive recipe expansion  *(driver shipped 2026-06-20; see changelog)*

The recursion driver now exists (`expand-recipe.ts` + `npm run wiki:expand`). Building it
settled the open design question: **a full-depth leaf flatten is NOT a meaningful artifact**,
because past the catalog's modeling granularity the wiki's Mystic-Forge *promotion* recipes
(ingot→ore, dust→dust, Obsidian Shard→Obsidian Shard) are self-referential and compound into
nonsense quantities — `npm run wiki:expand -- "Gift of Fortune" --deep` shows the cycle/
max-depth guards firing on exactly these. The catalog's leaf granularity is therefore the
correct stopping point, which is why the existing one-level-per-intermediate gate already gives
full recursive coverage (`catalog-view.ts:59`). So **auto-promotion is moot** — 92/94 are
already `verified: true` and gate-enforced. What `wiki:expand --check` adds is a recursive
**gap finder**: it confirmed every wiki component across all four families resolves to a
catalog-modeled name. Remaining (optional): parse `RecipeNode` metadata (`source`/`discipline`/
`buyable`) into generated drafts when the `generated/` layer is next populated.

### 2. (Low payoff, optional) Expand weapon themed-gift + precursor sub-trees

Incinerator, Astralaria, Exordium, Pharus, Aurene's Fang/Scale, Aetheric Anchor — full-depth
wiki transcription. Precursors are TP-buyable and themed-gift collections don't map to
countable inventory, so the payoff is low. Do one weapon at a time, running `tsc` +
`npm run check` after each.

## Wiki reconciliation toolchain (`scripts/wiki-sync/`)

Drift between catalog and wiki is measured and gated automatically — use it to drive the work
above instead of hand-auditing. Read-only except `wiki:fetch`/`wiki:fix`:

- `npm run wiki:report` — authoritative drift + low-confidence list.
- `npm run wiki:check` — the build gate (also runs inside `npm run build`).
- `npm run wiki:fix` (a.k.a. `wiki:report -- --apply`; `--dry-run` previews) — regenerates the
  `generated/` draft layer in `scripts/wiki-sync/fix.ts`. Writes only MISSING entries that are
  high-confidence + have a real API id + a non-empty top-level recipe + aren't armor *sets*.
  Every draft ships `verified: false`. After writing it runs `tsc -b`, `npm run check`,
  `npm run wiki:check` and **reverts all writes if any fail**; auto-prunes resolved
  `baseline.json` entries. Output is a reviewable JSON diff.
- `npm run wiki:expand -- "<Item>"` — Phase 4 recursive expander (read-only, NOT a gate).
  Walks the wiki recipe DAG from the cache, stopping at the catalog's vocabulary by default
  (cycle- and depth-guarded). `--check` lists wiki components the catalog doesn't model (gap /
  alias finder); `--deep` ignores the catalog stop set for free structural exploration (totals
  past base materials are not cost-accurate — see #1); `--no-cache` re-downloads.
- `npm run wiki:test` — parser + expander regression tests (guards the `{{recipe list}}`
  false-match fix, vendor-leaf classification, and the expander's stop/cycle/builder/depth
  guards). Fully offline (inline fixtures).
- `npm run wiki:audit` — canon-layer trust audit: fails if two genuinely different items
  (different ids) collapse to one canonical name, or on no-op aliases.
- `npm run wiki:links` — network link check: every wiki link the app renders resolves.
- To **close an item**: fix its recipe in `src/data/recipes/*` (use
  `npm run wiki:report -- --scaffold="<Item>"` for a starting stub), then delete its entries
  from `baseline.json` (or rerun `npm run wiki:check -- --update-baseline`).

Known structural limits (the honest manual lane — these never auto-write):

- **Armor recipes are not machine-verifiable**: legendary armor wiki pages express crafting as
  prose "Material list"/"Components" tables, not `{{recipe}}` templates, and pieces have no
  individual pages (linked to the set page via `ARMOR_LINK_OVERRIDES`). Sets are verified by
  enumeration + id; their shared gifts ARE verified as intermediates.
- **Vendor leaves** (Bloodstone Shard, Eldritch Scroll, Gift of Craftsmanship/Insight, …) have
  no `{{recipe}}` — classified `VENDOR_LEAF` (a correct terminal leaf), not "unverified".
- **Genuinely special items** stay `LOW_CONFIDENCE`: Aetheric Anchor (dual-unlock),
  Selachimorpha (collection aquabreather), Prismatic Champion's Regalia (achievement reward).

## Done (changelog)

- ✅ **Dependability pass (2026-07-03):** consumption-correct accounting (per-piece
  `consumed`, `allocateProgress` priority-order allocation, allocation-derived aggregate
  `remaining`, owned pieces excluded from totals; Klobjarne Geirr + Endless Summer condensed
  gifts were terminal leaves — fixed); `npm run wiki:totals` gate (full-tree wiki cross-check +
  engine reference multiply + committed golden-totals snapshot); catalog-wide invariant checks
  + recommendation-rule fixtures in `npm run check`; error boundary, "prices unavailable"
  honesty, storage-failure banner, sync-warning badge; searchable `PiecePicker` + first-run
  onboarding; GitHub Actions CI running all offline gates.
- ✅ **Auto-fix Phase 4 — recursive recipe expander (2026-06-20):** `expand-recipe.ts` (pure,
  injected fetcher) + `npm run wiki:expand`. Follows every component whose wiki page has a
  `{{recipe}}`, building the nested DAG with stop conditions, cycle protection, builder mapping,
  and a depth cap; offline regression test bundled into `wiki:test`. Empirically established
  that the catalog's leaf granularity is the correct stop boundary (deeper = self-referential
  Mystic-Forge promotion recipes), so the one-level-per-intermediate gate already gives full
  recursive coverage and auto-promotion is moot. `--check` (recursive gap finder) confirmed
  every wiki component across all four families resolves to a catalog-modeled name.
- ✅ **Verification complete (2026-06-20):** **92/94 catalog entries are `verified: true`** and
  pass `npm run wiki:check` against the wiki snapshot (0 `UNVERIFIED`, 0 `SYNTHETIC_RESOLVABLE`).
  The 2 left `verified: false` are the correct special cases — Selachimorpha (collection
  aquabreather) and Strife Unending (vendor leaf) — which have no parseable `{{recipe}}` and
  are intentionally not promoted.
- ✅ **Auto-fix Phase 3 — component item-id resolution:** synthetic-by-name leaves resolved to
  real wiki ids; the only remaining `synthetic()` leaf is `Incursive Investigation
  (achievement)`, which is genuinely id-less. Re-check with
  `grep -rno "ref(synthetic(), '[^']*'" src/data/recipes/`.
- ✅ **All planned features shipped (Phases 1–6):** Dashboard, Loadout, Materials, Compare,
  Forecast, History, weighting sliders, build codes.
- ✅ **Full catalog reach:** "add all legendaries" brought `CATALOG` to 94 entries; the wiki
  gate reports 0 missing / empty baseline.
- ✅ **`testimonyOfHeroics`** — resolved as a misconception: there is no such currency. The WvW
  heroics currency is Proof of Heroics (31); "Testimony of Desert/Jade/Castoran Heroics"
  (36/65/82) are the variants; "Testimony of Heroics" is an *item* (70985). No modeled recipe
  uses it (note in `src/data/items.ts`).
- ✅ **Synthetic-by-name leaves resolved to real ids** (wiki infobox + `/v2/items`): Auric Ingot,
  Chak Egg, Reclaimed Metal Plate, Star of Glory, Jar of Distilled Glory, Record of League
  Participation, Gift of Exploration, the Aetheric Anchor heart-gifts, Gift of the Astral Ward,
  Gift of the Mist Warrior, Gift of Insight, Fractalline Spark. Only
  `Incursive Investigation (achievement)` stays synthetic (genuinely id-less). Re-check with
  `grep -rno "ref(synthetic(), '[^']*'" src/data/recipes/`.
- ✅ **Draconic Tribute** real id confirmed: **96137** (in `_builders.ts`).
- ✅ **Auto-fix Phase 1 — machine-owned data layer:** `src/data/recipes/generated/` (json +
  thin loader); `index.ts` merges `GENERATED` under curated, curated-wins by name *and* id.
  Generated synthetic ids use a reserved sub-range (`GENERATED_SYNTHETIC_BASE`, 9.5M–10M).
- ✅ **Auto-fix Phase 2 — `wiki:fix` command + validation-gated apply:** writes `verified:false`
  drafts only, reverts on any gate failure, auto-prunes `baseline.json`, reviewable JSON diff.
- ✅ **Deeper intermediate accuracy:** the reconciler snapshots every distinct catalog
  intermediate's wiki page (`catalogIntermediates()` + Phase C in `snapshot.ts`) and diffs each
  by name — this is where historical clover/T6/ecto miscounts lived (e.g. the Gift of Venom
  swap).
