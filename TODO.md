# TODO & maintainer notes

Conventions for changing this codebase, plus the work that's still open. For *usage* and
architecture, see [README.md](README.md).

## Project structure & conventions

- **Where things live:**
  - `src/types/` — domain model and the source of truth for shapes (`LegendaryPiece`,
    `RecipeNode`, `DerivedProgress`, `LoadoutSlot`).
  - `src/data/recipes/` — curated trees: `weapons.ts`, `armor.ts`, `trinkets.ts`, `backs.ts`,
    shared sub-trees in `_builders.ts`; `index.ts` assembles `CATALOG`.
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
- **Gates (keep green):** `npx tsc -b --noEmit` exits 0 and `npm run check` prints
  "ALL CHECKS PASSED" are the real gates; `npm run build` should also pass (a `*.node`
  native-binding/arch error is an environment issue, not a code issue).

## Remaining work

All planned features are shipped (Phases 1–6). What's left is data accuracy and catalog reach.

- **Resolve the PvP `testimonyOfHeroics` currency id** in `src/data/items.ts` (the `CUR`
  TODO — currently a duplicate of the WvW Skirmish Claim Ticket id 26). Needed for accurate
  PvP legendary-armor costs; no current seed piece uses it.
- **Resolve remaining synthetic-by-name leaves to real ids** where a real, stockpile-able
  item exists (improves owned-math on sync). Find them with:
  ```bash
  grep -rno "ref(synthetic(), '[^']*'" src/data/recipes/
  ```
  Only switch ids you can verify on the wiki. Leave genuinely id-less intermediates
  (achievements, per-map heart-vendor gifts, precursor *journeys*) synthetic with a `notes:`.
- **Confirm the Draconic Tribute real item id** (Gen3/EoD weapons) — currently synthetic.
- **(Optional, low payoff) Expand weapon themed-gift + precursor sub-trees** to full depth
  (Incinerator, Astralaria, Exordium, Pharus, Aurene's Fang/Scale, Aetheric Anchor). Bulk
  wiki transcription; precursors are TP-buyable and themed-gift collections don't map to
  countable inventory, so the payoff is low. Do one weapon at a time, running `tsc` +
  `npm run check` after each.
- **Catalog reach:** only the seed-loadout pieces plus the full trinket/back catalog are
  authored. Extending to the rest of the legendary catalog uses the same builder pattern —
  no schema change.

### Wiki reconciliation (`scripts/wiki-sync/`)

The drift between the catalog and the wiki is now measured and gated automatically — use it
to drive the work above instead of hand-auditing:

- `npm run wiki:report` is the authoritative "what's missing / wrong" list. It currently
  shows ~53 missing weapons/armor sets and the trinket/back recipe simplifications
  (`COMPONENT_MISSING/EXTRA`), all recorded in `scripts/wiki-sync/baseline.json`.
- To **close an item**: fix its recipe in `src/data/recipes/*` (use
  `npm run wiki:report -- --scaffold="<Item>"` for a starting stub), then delete its entries
  from `baseline.json` (or rerun `npm run wiki:check -- --update-baseline`). The gate then
  enforces that the item stays correct.
- **Resolve `SYNTHETIC_RESOLVABLE` warnings**: the wiki has real armory ids for every
  trinket/back the catalog currently mints synthetically (e.g. Aurora 81908, Conflux 93105).
  Swapping these in improves owned-on-sync matching and clears the warnings.
- Re-run `npm run wiki:fetch` after each game update; review the `snapshot/` diff and commit.
- **Deeper accuracy (future):** extend the reconciler to snapshot the shared-gift wiki pages
  (Gift of Fortune, Mystic/Draconic Tribute, Condensed Might/Magic) and compare flattened
  leaf quantities — that's where the historical clover/T6/ecto miscounts lived.

### Auto-fix: apply wiki fixes automatically (phases 1–2 SHIPPED)

Today the system is report-first (`wiki:report` + the `wiki:check` gate); fixes for the
remaining gap (component ids + deep trees) are still applied by hand. The goal is for
missing/incorrect items to be corrected automatically on discovery. Auto-writing turns every
parse error into shipped-wrong-data, so most of this work is about making generation accurate
and safe enough to trust — not the writing itself. Each phase is independently shippable.

**1. Machine-owned data layer — ✅ DONE (2026-06-19).**
- `src/data/recipes/generated/` holds `recipes.generated.json` (the fixer owns it) + a thin
  `index.ts` loader. `src/data/recipes/index.ts` merges `GENERATED` into `CATALOG` with
  curated-wins-on-collision (by name *and* id), so authored work is never clobbered. Auto-fix
  is "regenerate the file" — clean diff, idempotent.
- Generated synthetic ids are minted into a reserved sub-range (`GENERATED_SYNTHETIC_BASE`,
  9.5M–10M, see `src/data/items.ts`) so they can't collide with curated `synthetic()` ids,
  and shared gifts (e.g. "Gift of Fortune") hash to one id so the aggregate view de-dups them.

**2. `wiki:fix` command + validation-gated apply — ✅ DONE (2026-06-19).**
- `npm run wiki:fix` (a.k.a. `npm run wiki:report -- --apply`; `--dry-run` previews) in
  `scripts/wiki-sync/fix.ts`. Regenerates `generated/` for every MISSING wiki entry that is
  high-confidence + has a real API id + a non-empty top-level recipe + isn't an armor *set*.
  First apply created 48 drafts (catalog 24 → 72); 6 entries route to the manual lane
  (armor sets, low-confidence Ancora Bellum, no-id Selachimorpha) — i.e. phase 5's boundary.
- Every draft ships **`verified: false`** (only an `UNVERIFIED` advisory warning, never a
  blocking finding). Promote to `verified: true` only when confidence is `high`, *all*
  component ids resolved (phase 3), and a structural self-check passes (phase 4).
- After writing it runs `tsc -b`, `npm run check`, `npm run wiki:check` and **reverts all
  writes if any fail** (verified with a forced-failure test — leaves no half-written catalog).
- **Auto-prunes `baseline.json`**: drops the `acknowledgedMissing` entries the fix resolved.
- Output is a reviewable JSON diff (no silent-commit); the JSON file *is* the review surface.

**3. Component-level item-id resolution.** _(next — clears the `SYNTHETIC_RESOLVABLE` gap)_
- `parse-recipe.ts` currently reads only the legendary's own infobox `id`. Add a name→id
  resolver that fetches each component's wiki page infobox `id`, cached to a committed
  `scripts/wiki-sync/item-ids.json`, and feed resolved ids into the `ITEM` registry.
- Without this, generated recipes use `synthetic()` ids (correct structure, no inventory
  matching). With it, the `SYNTHETIC_RESOLVABLE` warnings clear and leaves match on sync.

**4. Recursive recipe expansion + node metadata.**
- The snapshot captures only top-level components; the engine needs full leaf trees (e.g.
  top-level "Gift of Fortune" → clovers/ecto/T6) for cost + time-gate math.
- Add a recursion driver that follows each component whose wiki page has a `{{Recipe}}`,
  builds the nested `RecipeNode` DAG, with: a stop condition (leaf = no recipe / known base
  material), cycle protection, and **mapping shared gifts to the existing builders**
  (`giftOfFortune()`, `mysticTribute()`, `giftOfCondensedMight()` in `_builders.ts`) so they
  aren't re-expanded inconsistently.
- Parse `RecipeNode` metadata: `source` (Mystic Forge / craft / vendor), `discipline`,
  `buyable`; reuse the `TIME_GATED` registry for `timeGate` once ids resolve. This is the
  largest extraction task and the one that enables auto-promotion to `verified: true`.

**5. Keep an explicit manual lane (scope boundary).**
- Never auto-write items with no clean `{{Recipe}}`: armor *sets*, achievement-reward
  trinkets (Prismatic Champion's Regalia), the dual-unlock container (Aetheric Anchor ↔
  Ancora Bellum/Pax), heart-vendor gifts. The fixer only applies `confidence: 'high'`,
  fully-resolved items; everything else routes to curated overrides + `aliases.ts`. Auto-fix
  is necessarily partial (~65 of 74 items).

Suggested order: **1 + 2** ✅ done (the missing-item gap now ships as `verified:false` drafts);
next **3** (real component ids → clears `SYNTHETIC_RESOLVABLE`, enables inventory matching),
then **4** (leaf-accurate trees + auto-promotion to `verified:true`).
