# Agent task: Phase 3+ feature build (high complexity)

**Intended runner:** an Opus-class agent (lower-effort/throughput setting is fine — the
work is well-specified here; the difficulty is breadth and wiring, not deep reasoning).

This is **app feature work**, not data. The recipe data spine and the per-piece engine
already exist and are wiki-verified. Your job is to build the planning/guidance layer on
top of them. Deliver in the phase order below; each phase is independently shippable.

## Orientation — what already exists

Read these before writing code:

- `README.md` — phases, completion-score formula, id-namespace.
- `src/types/index.ts` — domain model. Key shapes you'll consume:
  - `LegendaryPiece { id, name, slot, type, acquisitionMode, unlocks[], recipe, blurb }`
  - `DerivedProgress { completionScore, qtyProgress, goldProgress, timeProgress,
    hasGoldBasis, hasTimeBasis, remainingMaterials[], remainingPurchasable[],
    remainingNonPurchasable[], finishableByGold, buyOutGold, timeGateDebt[],
    earliestFinishDate }`
  - `RemainingMaterial`, `TimeGateDebt`.
- `src/data/loadout.ts` — `Loadout { name, slots: LoadoutSlot[] }`,
  `LoadoutSlot { key, label, family, status, tracked, priority, chosenPieceId,
  candidateIds[] }`, `SLOT_ORDER`, `buildSeedLoadout()`. **`priority` can be a number or
  the string `'defer'`.**
- `src/engine/progress.ts` — `computeProgress(piece, snapshot, prices, weights, meta)`.
  This is the single source of per-piece truth; build features by aggregating its output,
  do not recompute material math yourself.
- `src/state/store.tsx` — `AppProvider` / `useApp()`. Exposes `settings`, `loadout`,
  `sync`, `progressByPiece` (a `Record<pieceId, DerivedProgress>`), `setApiKey`,
  `setWeights`, `runSync`. **`loadout` is currently read-only** (no setter) — you'll add
  mutators. It already persists to localStorage via `STORAGE_KEYS.loadout`.
- `src/App.tsx` — routes (HashRouter). `src/components/Layout.tsx` — top nav `tabs[]`.
  Screens live in `src/screens/`. Add a screen = add a `<Route>` in `App.tsx` + a tab in
  `Layout.tsx` + a file in `screens/`.
- `src/lib/format.ts` — gold/relative-time formatters (reuse, don't reinvent).

## Cross-cutting groundwork (do first, before the phases)

1. **Loadout is read-only in the store.** Add mutators to `AppProvider` and the
   `AppState` interface, all persisting through the existing `saveJSON(STORAGE_KEYS.loadout, …)`
   effect (lift `loadout` to `useState` with a setter):
   - `setSlotPiece(key, pieceId | null)`
   - `setSlotStatus(key, SlotStatus)`
   - `setSlotTracked(key, boolean)`
   - `setSlotPriority(key, number | 'defer')`
   - `setSlotCandidates(key, pieceId[])`
   Keep these pure and immutable; recompute nothing here (progress is derived in the
   existing `useMemo`).
2. **Helper selectors** (new file `src/engine/loadout-progress.ts`): given `loadout` +
   `progressByPiece`, expose `trackedSlots()`, `pieceForSlot(slot)`, and
   `progressForSlot(slot)`. Everything below builds on these so untracked slots
   (`slot.tracked === false`) are consistently excluded from totals.
3. Add unit-style assertions to `scripts/engine-check.ts` as you go (it's the project's
   test harness; `npm run check` runs it). Keep it green.

---

## Phase 3 — Daily dashboard + time-gate engine (the centerpiece, build first)

The brief's headline feature: answer "what's the best thing to do today?" Two signals,
honoring `priority` order and the `'defer'` flag.

New screen `screens/Dashboard.tsx`, route `/dashboard`, make it the default tab.

1. **Time-gate hygiene list.** Across tracked pieces, collect every `timeGateDebt[]` entry
   on a critical path. Surface daily-capped mats the user should act on today (Mystic
   Clovers, charged quartz, daily ascended mats). The data is already in
   `DerivedProgress.timeGateDebt` (`{ name, remaining, dailyRate, severity, days }`).
   Rank by severity then `days`. Copy: "craft your daily Mithrillium", "buy clovers", etc.
   (There's no per-day "collected today" state yet — add a lightweight localStorage
   `lastCollected[itemId] = ISODate` map and a "mark done today" toggle, or defer that
   refinement and just show the standing list. Document whichever you choose.)
2. **Finish-line pushes.** Pieces with `completionScore` high AND a short
   `earliestFinishDate` (no long time-gate wall) get a "push to finish" callout. Use
   `finishableByGold` to flag "Finish now for ≈X gold" (format `buyOutGold`).
3. **Loadout completion ring + nearest finishes + total time-gate debt** summary cards.
   Total debt = max/sum of tracked pieces' `timeGateDebt` per shared mat (de-duplicate —
   clovers feed many pieces; don't double-count, take the aggregate requirement). See
   Phase 4.2 for the aggregation primitive; you may build it here first.
4. Respect `priority` (lower number = higher) and push `'defer'` slots (e.g. the backpack)
   to the bottom.

**Acceptance:** `/dashboard` renders with the seed loadout and an empty sync (everything
shows as "not started" gracefully) and with a populated sync. No crashes when
`progressByPiece` is empty. `tsc` + `npm run check` green.

## Phase 4 — Comparison + aggregation + buy-out

1. **Flexible-slot compare** (`screens/Compare.tsx`, route `/compare/:slotKey`). For a
   slot's `candidateIds`, render a side-by-side table: remaining **time-gate days**
   (`max(timeGateDebt.days)`), remaining **gold** (`buyOutGold`), required **game mode**
   (`piece.acquisitionMode`), and **material overlap** with current inventory. Sort by
   time-gate days, tie-break by gold then overlap. Recommend the lowest-effort candidate.
2. **Whole-loadout material aggregation** (`screens/Materials.tsx`, route `/materials`).
   Roll all *tracked* pieces into one master requirement list keyed by itemId: sum
   `required`, subtract owned **once**, split gated vs. buyable, show total buy-out cost.
   This is the de-dup primitive Phase 3.3 needs — implement it as a reusable function in
   `engine/loadout-progress.ts` (e.g. `aggregateRequirements(trackedSlots, snapshot,
   prices)`).
3. **Buy-out timing rule** (brief 6.5): while a piece has any non-purchasable work left,
   show buy-out as *informational*; the moment `remainingNonPurchasable` is empty
   (`finishableByGold === true`), promote to a recommended "Finish now for ≈X gold". Wire
   this into both the piece detail screen and the dashboard.

**Acceptance:** compare table sorts correctly; aggregation never double-counts a shared mat
(add an engine-check assertion: clovers required across two clover-using pieces aggregate to
the sum, owned subtracted once). `tsc` + `npm run check` green.

## Phase 5 — Portability + hosting

1. **Build code** (`src/lib/buildcode.ts`): encode **only goals** (per-slot
   `chosenPieceId`, `status`, `tracked`, `priority`, `candidateIds`) into a compact,
   URL-safe, **versioned** string. Never include the API key. Provide `encode(loadout)` /
   `decode(str): Loadout` with a version prefix so old codes keep working. Add
   import/export UI in Settings.
2. **Hosting**: `vite.config.ts` already sets `base` for GitHub Pages; `npm run deploy`
   publishes `dist/` to `gh-pages`. For a custom domain add a `CNAME` file. Document the
   one-time DNS step in `README.md`.

**Acceptance:** round-trip `decode(encode(x))` deep-equals `x` (add an engine-check
assertion); a build code never contains the api key.

## Phase 6 — Polish (nice-to-have)

Time-gate forecaster (project whole-loadout finish date from pace + adjustable
assumptions), snapshot history (chart momentum per piece per sync), weighting sliders in
Settings (`setWeights` already exists — just needs UI), visual refinement.

---

## Definition of done

- Each phase: `npx tsc -b --noEmit` exits 0, `npm run check` prints "ALL CHECKS PASSED",
  and the new screen renders for both an empty and a populated sync without crashing.
- Untracked slots are excluded from every total, everywhere.
- All per-piece material math goes through `computeProgress` / the aggregation helper —
  no duplicated recipe-flattening logic.
- `npm run build` succeeds. (If it fails *only* with a `*.node` native-binding/arch error,
  that's a sandbox environment issue, not your code — `tsc -b` and `npm run check` are the
  real gates.)
- Don't touch the recipe data files except to read them; data accuracy is handled
  separately in `AGENT-TASKS-data-cleanup.md`.
