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

### Auto-fix: apply wiki fixes automatically (not yet built)

Today the system is report-first (`wiki:report` + the `wiki:check` gate); fixes are applied
by hand. The goal here is for missing/incorrect items to be corrected automatically on
discovery. Auto-writing turns every parse error into shipped-wrong-data, so most of this
work is about making generation accurate and safe enough to trust — not the writing itself.
Build in the phases below; each is independently shippable.

**1. Machine-owned data layer (architectural prerequisite).**
- Add `src/data/recipes/generated/` (TS, or JSON + a thin loader) merged into `CATALOG` in
  `src/data/recipes/index.ts`. The fixer owns `generated/`; humans own the existing curated
  files. A piece lives in exactly one place, so auto-fix becomes "regenerate the folder"
  (clean diff, idempotent) instead of surgical edits into curated code.
- Migrate or shadow rule: if a curated entry and a generated entry collide by name, curated
  wins (and the generated one is skipped + noted), so human work is never clobbered.

**2. `wiki:fix` command + validation-gated apply (safety machinery).**
- New `npm run wiki:fix` (a.k.a. `wiki:report -- --apply`) that regenerates `generated/` for
  items that are MISSING or have unacknowledged drift.
- Land every generated recipe as **`verified: false`** by default. Promote to
  `verified: true` only when: confidence is `high`, *all* component ids resolved (phase 4),
  and a structural self-check passes.
- After writing, run `tsc -b`, `npm run check`, and `npm run wiki:check`; **revert all writes
  if any fail** (never leave a half-written catalog).
- **Auto-prune `baseline.json`**: drop acknowledgements the fix resolved. The
  `staleAcknowledgements` logic in `scripts/wiki-sync/gate.ts` already detects these.
- Output a reviewable diff / PR — "automatic on discovery" should still leave a human a diff
  to glance at; do not silent-commit to main.
- This phase alone (with synthetic component ids) closes the ~53 missing-item gap as
  reviewable `verified:false` drafts. The existing `scaffold()` in
  `scripts/wiki-sync/report.ts` is the starting point for the emitter.

**3. Component-level item-id resolution.**
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

Suggested order: **1 + 2** first (high payoff, ~closes the missing-item gap as drafts), then
**3** (real ids), then **4** (leaf-accurate trees + auto-verify).
