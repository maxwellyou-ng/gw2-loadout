# GW2 Legendary Loadout Tracker

A pure client-side SPA (React + Vite + Tailwind v4) that plans and tracks progress
toward a Guild Wars 2 legendary loadout. Connect a read-only GW2 API key, sync, and
see per-piece completion, time-gate debt, earliest finish dates, and buy-out estimates.

The catalog covers the **full legendary set** — all ~74 wiki legendaries (94 catalog
entries, counting weapon variants) — built on a curated recipe dataset cross-checked
against the GW2 Wiki and guarded by an automated drift gate. See
[Data accuracy](#data-accuracy--wiki-reconciliation) for the verification status.

## Core idea

Every tracked piece carries two deliberately-different numbers:

- **Completion score** — a time-weighted measure of how *close* you are (slow, daily-capped
  materials count for far more than cheap bulk).
- **Earliest finish date** — the soonest you could *actually* equip it, limited by
  daily-capped materials.

A piece can be 95% complete by quantity yet weeks out because it still needs Mystic Clovers
you can only earn a few a day. Surfacing both — and the gap between them — is the whole
point: start slow grinds early, spend active sessions finishing near-done pieces. The
Dashboard and Forecast are built around this.

## Features

Every whole-loadout total routes through `engine/loadout-progress.ts`, so untracked slots are
excluded everywhere and the accounting is **consumption-correct**: crafting consumes materials,
so `required` sums across pieces (77 + 18 clovers ⇒ 95) while your owned stock — including
pre-built gifts in the bank — is allocated to pieces in priority order and never credited to
two pieces at once. Multi-piece views (Dashboard, Loadout, History) show these allocated
numbers; Compare deliberately measures candidates in isolation, since they're alternatives.

- **Dashboard** (`/dashboard`, default) — the daily "what to do": a time-gate hygiene list
  of daily-capped mats to collect today (with a "collected today" toggle —
  `gw2lt:dailyLog[itemId] = ISODate`, advisory only, never alters computed counts),
  finish-line pushes for nearly-done pieces, and summary cards (completion ring, nearest
  finishes, total time-gate debt). Honors `priority`; `'defer'` slots sink to the bottom.
- **Loadout** (`/loadout`) — editable grid. Each slot has two orthogonal toggles: **Tracked**
  (counts toward Materials + dashboard totals, or hidden) and **Flexible** (you're weighing
  candidates — surfaces the Compare link). There's no `status` enum: "done" is derived from
  ownership, and an unchosen slot renders blank. **Weapons** are compact and editable — up to
  8, each removable, with an "Add weapon" picker; empty weapon slots collapse.
- **Materials** (`/materials`) — whole-loadout aggregation: every tracked piece rolled into
  one master list keyed by itemId, required summed across pieces, owned subtracted **once**,
  split gated / grind / buyable, with a total buy-out cost. A **Base materials ↔ Gifts &
  intermediates** view switch (`aggregateRequirements` vs `aggregateIntermediates`) toggles
  granularity: the gift view stops at the final-combine inputs, so once a gift is crafted and
  synced its base mats drop out. Material names link to their GW2 wiki page (`lib/format.ts`
  `wikiUrl`; synthetic intermediates have no link).
- **Compare** (`/compare/:slotKey`) — side-by-side flexible-slot candidates ranked by
  remaining time-gate days, then gold, then material overlap; recommends the lowest-effort
  option and lets you pick the winner.
- **Forecast** (`/forecast`) — time-gate forecaster: a what-if over the de-duplicated
  whole-loadout time-gate debt. Adjust the assumed daily pace per gated material (sliders) and
  the projected finish date moves; the binding (slowest) material is highlighted. Pace
  overrides persist in `gw2lt:paceOverrides` (advisory; never alters computed counts).
- **History** (`/history`) — snapshot momentum. The store logs one record per new sync
  (`gw2lt:history`: `{ ts, overall, byPiece }`); charts overall completion across syncs
  (inline SVG) and shows a per-piece Δ-since-last-sync table.
- **Piece detail** (`/piece/:id`) + **Settings** — the recipe tree for a single piece, and
  the API key and build-code import-export.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + wiki:check + production build (base: /gw2-loadout/)
npm run check      # engine sanity checks incl. consumption + invariants (no API key needed)
npm run wiki:check # gate: catalog must match the committed wiki snapshot (per combine)
npm run wiki:totals # gate: full-tree totals match the wiki + the committed golden snapshot
```

## Architecture

```
src/
  types/        Domain model (LegendaryPiece, RecipeNode, DerivedProgress, …)
  data/
    items.ts                  Item-id registry + id-namespace conventions + time-gate table
    recipes/                  Curated trees: weapons, armor, trinkets, backs (+ _builders)
      generated/              Machine-owned wiki:fix draft layer (merged under curated)
    loadout.ts                Slot model + the seed loadout
    verified-intermediates.ts Auto-generated set of wiki-verified intermediate gifts
  api/gw2.ts    Authenticated client; merges every account source into a snapshot
  engine/       mergeInventory + computeProgress (weighted score, gates, buy-out)
                + loadout-progress.ts (whole-loadout aggregation + selectors)
  state/        localStorage-persisted store + derived-progress selector
  components/   Layout/nav + shared UI + recipe tree
  screens/      Dashboard · Loadout · Materials · Compare · Forecast · History
                · Piece detail · Settings
```

## How it works

### GW2 API

The client (`src/api/gw2.ts`) uses one read-only key with scopes
`account, inventories, wallet, unlocks, characters, progression`, and merges these endpoints
into a single `owned[itemId]` snapshot:

| Endpoint | Supplies |
|---|---|
| `/v2/account/materials` | Material vault (clovers, ecto, T6, Mystic Coins, …) |
| `/v2/account/wallet` | Currencies (gold, spirit shards, map/WvW/Fractal currencies) |
| `/v2/account/bank`, `/v2/account/inventory` | Bank + shared slots (finished gifts, stray stacks) |
| `/v2/characters/:id/inventory` + `/equipment` | Per-character bags and equipped items |
| `/v2/account/legendaryarmory` | Already-unlocked legendaries → auto-mark "Done" |
| `/v2/account/achievements` | Collection/achievement progress for gated pieces |
| `/v2/commerce/prices` | Live TP prices for buy-out estimates |

Rate limit ~600 req/min; a sync is a handful of cacheable calls, refreshed on demand. Each
endpoint is fetched tolerantly — a failure is collected as a warning rather than aborting the
sync.

### Completion score

`completionScore = Σ(weight·dimProgress) / Σweight` over the dimensions that have a
measurable basis (time = gated mats present; gold = TP prices loaded; quantity = always).
Defaults weight **time 0.6 ≫ gold 0.3 ≫ quantity 0.1**. A dimension
with no basis (e.g. prices not synced yet) is **excluded**, not counted as 100% — so an
unsynced account never looks falsely complete.

### Id-namespace convention

The merged `owned[itemId]` snapshot keeps items, currencies, and synthetic intermediates
collision-free:

| Range | Meaning |
|---|---|
| `0 … 7_999_999` | Real GW2 item ids |
| `8_000_000 + currencyId` | Wallet currencies (`/v2/account/wallet`) |
| `9_000_000 + n` | Synthetic intermediates (account-bound gifts / precursors consumed in the forge; not inventory-matchable) |
| `9_500_000 … 10_000_000` | Generated synthetic ids minted by `wiki:fix` (reserved sub-range) |

### localStorage keys

All state is browser-local (`src/state/storage.ts`):

| Key | Holds |
|---|---|
| `gw2lt:settings` | API key + completion weights |
| `gw2lt:sync` | Last merged snapshot, prices, sync meta |
| `gw2lt:loadout` | Your slots/goals |
| `gw2lt:dailyLog` | Dashboard "collected today" marks |
| `gw2lt:paceOverrides` | Forecast per-material pace overrides |
| `gw2lt:history` | Snapshot-history records (one per sync) |

### Build codes

`lib/buildcode.ts` `encode`/`decode` a compact, URL-safe, versioned (`gw2-v2.…`) string of
**goals only** (chosen pieces, tracked, flexible, priority, candidates). Never includes the
API key — sharing one is safe. Import/export lives in Settings. Legacy `gw2-v1.` codes (which
carried a `status` index) still decode; their status maps forward to the `flexible` flag.
Round-trip is lossless for the goal fields (label/family rehydrate from `SLOT_ORDER`, and the
loadout is `normalizeLoadout`'d so all eight weapon slots exist).

## Data accuracy & wiki reconciliation

Mystic Forge recipes aren't exposed by the API, so they are **hand-curated and cross-checked
against the GW2 Wiki**. What that means in practice:

- **Inventory-accumulating leaves use real, wiki-verified item ids and quantities** — every
  tier of the eight fine-material lines (Claw/Fang/Scale/Bone, Blood/Venom/Totem/Dust), plus
  Mystic Clovers/Coins, ecto, Obsidian Shards, Provisioner Tokens, and the account mats the
  trees touch (Memory of Battle, Amalgamated Draconic Lodestone/Rift Essence, Icy/Mystic
  Runestones, Certificates, etc.). On sync these subtract correctly against your account.
- **Shared forge gifts use real ids too** (Gift of Fortune, Mastery, Mystic Tribute,
  Condensed Might/Magic, Bloodstone Shard, Gift of War Prosperity, Gift of Jade Mastery, …),
  so a pre-built gift sitting in your bank is matched rather than re-counted.
- **Vendor-purchased items are fully costed** with dedicated vendor nodes: Gift of
  Craftsmanship (50 Provisioner Tokens), Eldritch Scroll (50 Spirit Shards), Legendary War
  Insight (1,095 WvW Skirmish Claim Tickets), Certificate of Honor (500) / Heroics (250), Glob
  of Condensed Spirit Energy (100). The engine expands these to currency costs.
- **Nothing required is hidden behind an opaque leaf.** Materials whose ingredients are
  needed on *every* acquisition path are always expanded — Gift of Research (250 Exotic
  Essence of Luck + reagents), Cube of Stabilized Dark Energy (1 Ball of Dark Energy + 75
  Stabilizing Matrix per cube), Vision Crystals (the Dragonite/Empyreal/Bloodstone "eater
  food"), Poems (daily-gated Deldrimor/Spiritwood refinements), the gen2 curio/shard walls.
  Kept leaves are documented decisions (`src/data/recipes/leaf-policy.json`); the
  `wiki:totals` gate fails if anything expandable regresses to a leaf. Buyable-vs-account-bound
  classification comes from the `/v2/items` flags (`account-bound.generated.json`), and
  save-your-materials notes (luck, eater food, ascended salvage) render in the recipe tree
  and Materials list.
- **Still synthetic by design:** per-map heart-vendor gifts, achievements, and precursors
  *consumed in the forge* rather than stockpiled (Gift of Exploration, weapon precursors,
  Draconic Tribute). Matching these against inventory has no practical effect.

### Verification status

`npm run wiki:check` is **green**: 74 wiki legendaries vs 94 catalog entries, 0 blocking
findings, empty baseline (full coverage — no acknowledged gap). Verification is effectively
complete:

- **92 of 94 entries are `verified: true`** and the gate enforces each against its committed
  wiki snapshot (any drift fails the build). The 2 left `verified: false` are genuinely
  unverifiable special cases — **Selachimorpha** (collection aquabreather, no `{{recipe}}`) and
  **Strife Unending** (vendor-sold, no craftable recipe) — and are intentionally not promoted.
- Beyond per-node checks, `npm run wiki:totals` verifies the **full-tree multiplication**: for
  every piece with a parseable wiki recipe (65 of 94; the skips are printed, not hidden), the
  catalog tree and the wiki snapshot DAG must flatten to identical leaf totals, and the
  engine's flatten must match an independent reference multiply for all 94.
- A committed **golden-totals snapshot** (`scripts/wiki-sync/golden-totals.json`) pins every
  piece's displayed leaf totals and buyable/time-gate flags — any change to a number the app
  shows becomes a reviewable diff (`npm run wiki:totals -- --update` to re-bless intentionally).

### The drift gate (`scripts/wiki-sync/`)

An automated, re-runnable system treats the GW2 Wiki as the single source of truth and
prevents the catalog from silently deviating from it (full detail in
[scripts/wiki-sync/README.md](scripts/wiki-sync/README.md)):

- `npm run wiki:fetch` re-downloads the legendary list pages + each item page from the
  MediaWiki API and rebuilds a **committed snapshot** (`scripts/wiki-sync/snapshot/*.json`).
- `npm run wiki:report` prints a drift report: what's missing, what disagrees, what to change.
- `npm run wiki:fix` regenerates the machine-owned `src/data/recipes/generated/` draft layer
  from the snapshot (every draft `verified: false`; curated files always win a collision).
- `npm run wiki:check` is the offline gate wired into `npm run build`. It fails on any
  unacknowledged drift and on any `verified: true` recipe that doesn't match its snapshot.
- `npm run wiki:totals` is the offline **totals** gate: full-tree leaf quantities must match
  the wiki snapshot DAG, the engine's flatten must match a reference multiply, and displayed
  totals must match the committed golden snapshot (see
  [Verification status](#verification-status)).

Run `wiki:fetch` after game updates, review the `snapshot/` diff, and commit.

## Deploying

`npm run deploy` (= `predeploy` build + `gh-pages -d dist`) builds with `base: /gw2-loadout/`
and publishes `dist/` to the `gh-pages` branch. For a **custom domain** instead of
`<user>.github.io/gw2-loadout/`:

1. Build for the domain root: `VITE_BASE=/ npm run build` (the project `base` path is wrong
   for an apex/subdomain).
2. Add a `CNAME` file containing your domain (e.g. `loadout.example.com`) to `public/` so it's
   copied into every `dist/` and survives redeploys.
3. DNS: for a subdomain, add a `CNAME` record pointing to `<user>.github.io`; for an apex
   domain, add GitHub Pages' `A`/`AAAA` records. Then set the custom domain in the repo's
   **Settings → Pages**. Allow time for DNS propagation and the TLS cert to issue.

## Caveats

- **Use a read-only key** and keep the app free of third-party scripts — there's no server, so
  the key stays in your browser, but anything running on the page can read localStorage. Build
  codes deliberately exclude the key, so sharing one is safe.
- **Inventory items are the source of truth.** The API can't report mid-forge progress, so a
  partially-built gift only counts once it exists as an item in your account.
- **Recipes are hand-curated and versioned** (the Mystic Forge isn't exposed by the API); they
  need a re-check when new content ships. See [Data accuracy](#data-accuracy--wiki-reconciliation).
