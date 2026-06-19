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
