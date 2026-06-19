# GW2 Legendary Loadout Tracker

A pure client-side SPA (React + Vite + Tailwind v4) that plans and tracks progress
toward a Guild Wars 2 legendary loadout. Connect a read-only GW2 API key, sync, and
see per-piece completion, time-gate debt, earliest finish dates, and buy-out estimates.

This repo implements **Phases 1–5** of the build brief: the data spine (API client +
curated recipe dataset), the read-only tracker, the daily dashboard + time-gate engine,
flexible-slot comparison, whole-loadout material aggregation, and portable build codes.

### Core idea

Every tracked piece carries two deliberately-different numbers:

- **Completion score** — a time-weighted measure of how *close* you are (slow, daily-capped
  materials count for far more than cheap bulk).
- **Earliest finish date** — the soonest you could *actually* equip it, limited by
  daily-capped materials.

A piece can be 95% complete by quantity yet weeks out because it still needs Mystic Clovers
you can only earn a few a day. Surfacing both — and the gap between them — is the whole
point: start slow grinds early, spend active sessions finishing near-done pieces. The
Dashboard and Forecast are built around this.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + wiki:check + production build (base: /gw2-loadout/)
npm run check      # engine sanity checks (no API key needed)
npm run wiki:check # gate: catalog must match the committed wiki snapshot
npm run deploy     # build + publish dist/ to gh-pages
```

For a user/custom-domain deploy, build with `VITE_BASE=/`.

## Architecture

```
src/
  types/        Domain model (LegendaryPiece, RecipeNode, DerivedProgress, …)
  data/
    items.ts    Item-id registry + id-namespace conventions + time-gate table
    recipes/    Curated trees: weapons, armor, trinkets, backs (+ shared builders)
    loadout.ts  Slot model + the seed loadout (brief Section 4 worked example)
  api/gw2.ts    Authenticated client; merges every account source into a snapshot
  engine/       mergeInventory + computeProgress (weighted score, gates, buy-out)
  state/        localStorage-persisted store + derived-progress selector
  components/    Layout/nav + shared UI
  screens/       Loadout grid · Piece detail · Settings
```

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

### Id-namespace convention

The merged `owned[itemId]` snapshot keeps items, currencies, and synthetic
intermediates collision-free:

| Range | Meaning |
|---|---|
| `0 … 7_999_999` | Real GW2 item ids |
| `8_000_000 + currencyId` | Wallet currencies (`/v2/account/wallet`) |
| `9_000_000 + n` | Synthetic intermediates (account-bound gifts / precursors consumed in the forge; not inventory-matchable) |

### Completion score

`completionScore = Σ(weight·dimProgress) / Σweight` over the dimensions that have a
measurable basis (time = gated mats present; gold = TP prices loaded; quantity =
always). Defaults weight **time 0.6 ≫ gold 0.3 ≫ quantity 0.1**, adjustable in
Settings. A dimension with no basis (e.g. prices not synced yet) is **excluded**, not
counted as 100% — so an unsynced account never looks falsely complete.

## Data accuracy (important)

Per the brief's risk section, Mystic Forge recipes are hand-curated, not API-derived.
Every recipe in the seed loadout plus the full trinket/back catalog was
**cross-checked against the GW2 Wiki (2026-06-17/18)** and ships `verified: true` with a
wiki link.

- **All inventory-accumulating leaves use real, wiki-verified item ids and
  quantities** — every tier of the eight fine-material lines (Claw/Fang/Scale/Bone,
  Blood/Venom/Totem/Dust), plus Mystic Clovers/Coins, ecto, Obsidian Shards, Provisioner
  Tokens, and the account mats the trees touch (Memory of Battle, Amalgamated Draconic
  Lodestone/Rift Essence, Icy/Mystic Runestones, Certificates, etc.). On sync these
  subtract correctly against your account.
- **The shared forge gifts use real ids too** (Gift of Fortune, Mastery, Mystic Tribute,
  Condensed Might/Magic, Might/Magic, Bloodstone Shard, Gift of War Prosperity, Gift of
  Jade Mastery, Gift of Expertise, Gift of Magical/Mighty Prosperity), so a pre-built
  gift sitting in your bank is matched rather than re-counted.
- **Vendor-purchased items are fully costed** with dedicated vendor nodes: Gift of
  Craftsmanship (50 Provisioner Tokens), Eldritch Scroll (50 Spirit Shards from Miyani),
  Legendary War Insight (1,095 WvW Skirmish Claim Tickets), Certificate of Honor (500),
  Certificate of Heroics (250), and Glob of Condensed Spirit Energy (100) — all wiki-
  verified 2026-06-18. The engine expands these to their currency costs rather than
  treating them as opaque leaves.
- **Still synthetic by design:** per-map heart-vendor gifts, achievements, and precursors
  that are *consumed in the forge* rather than stockpiled (e.g. the Aetheric Anchor
  heart-vendor gifts, Gift of Exploration, weapon precursors, Draconic Tribute). Matching
  these against inventory has no practical effect, so their ids were left unresolved.
- **All catalog entries are `verified: true`.** Prismatic Champion's Regalia (2026-06-18):
  confirmed as a direct achievement reward (Seasons of the Dragons, 24 Return
  meta-achievements) — no Mystic Forge combine, no clover gate. Real api id 95380.

### Wiki reconciliation (automated drift gate)

Hand cross-checking is now backed by an automated, re-runnable system in
[`scripts/wiki-sync/`](scripts/wiki-sync/README.md) that treats the GW2 Wiki as the
single source of truth and **prevents the catalog from silently deviating from it**:

- `npm run wiki:fetch` re-downloads the four legendary list pages + each item page from
  the MediaWiki API and rebuilds a **committed snapshot** (`scripts/wiki-sync/snapshot/*.json`)
  of what the wiki says each legendary requires (id + top-level recipe components).
- `npm run wiki:report` prints a drift report: which legendaries are missing from the
  catalog, which ids/recipes/quantities disagree with the wiki, and what to change.
- `npm run wiki:check` is a pure, offline gate wired into `npm run build`. It fails on any
  drift not acknowledged in `scripts/wiki-sync/baseline.json`, and enforces that any
  `verified: true` recipe **exactly matches** its high-confidence wiki snapshot — so a
  verified entry cannot drift without breaking the build.

Coverage as installed: the wiki lists ~74 legendaries; the catalog authors 24. The gap and
the current trinket/back recipe simplifications are recorded in `baseline.json` (reviewable
in git) so the gate is green today and only *new* divergence fails. Run `wiki:fetch`
after game updates; see [scripts/wiki-sync/README.md](scripts/wiki-sync/README.md).

## Caveats

- **Use a read-only key** and keep the app free of third-party scripts — there's no server,
  so the key stays in your browser, but anything running on the page can read localStorage.
  Build codes deliberately exclude the key, so sharing one is safe.
- **Inventory items are the source of truth.** The API can't report mid-forge progress, so a
  partially-built gift only counts once it exists as an item in your account.
- **Recipes are hand-curated and versioned** (the Mystic Forge isn't exposed by the API);
  they need a re-check when new content ships. See "Data accuracy" above.

## Verification status (brief checklist)

| Check | Status |
|---|---|
| App builds without errors | ✅ `npm run build` clean |
| Enter API key + Sync — no console errors | ✅ UI renders error-free; client has tolerant per-endpoint handling (needs a live key for a full end-to-end run) |
| Material counts match in-game vault | ⏳ needs a live key; engine maps real item ids (all fine-mat tiers resolved) and merges all sources |
| Aetheric Anchor tree down to base mats | ✅ wiki-verified: four VoE gifts; 100-clover gate inside Gift of Insight; dual spear+staff unlock |
| Owned legendary auto-shows "Done" | ✅ real armory ids + name match (`npm run check` covers it) |
| Eikasia gloves achievement-gated | ✅ wiki-verified: "Incursive Investigation" gate + 18-clover craft path (asserted in `npm run check`) |
| All catalog entries verified | ✅ Prismatic Champion's Regalia resolved 2026-06-18 — last `verified: false` entry |
| Recipe ingredient accuracy | ✅ Gift of Expertise (50 Obsidian Shard, not 600 ecto), Gift of Prosperity (no Provisioner Token in forge), Eikasia prosperity (Gift of Research added) — all corrected 2026-06-18 |
| Vendor cost tracking | ✅ Gift of Craftsmanship (50 PT), Eldritch Scroll (50 Spirit Shards), WvW ticket items (LWI/Cert of Honor/Heroics/Glob) — all modeled as vendor nodes 2026-06-18 |

## Planning layer (Phases 3–5)

Built on top of the per-piece engine — every total routes through
`engine/loadout-progress.ts` so untracked slots are excluded everywhere and shared
materials (clovers feed many pieces) are de-duplicated.

- **Dashboard** (`/dashboard`, default tab) — the daily "what to do": a time-gate
  hygiene list of daily-capped mats to collect today (with a localStorage "collected
  today" toggle — `gw2lt:dailyLog[itemId] = ISODate`, advisory only, never alters
  computed counts), finish-line pushes for nearly-done pieces, and summary cards
  (completion ring, nearest finishes, total time-gate debt). Honors `priority`; `'defer'`
  slots sink to the bottom.
- **Loadout** (`/loadout`) — editable. Each slot has two orthogonal toggles: **Tracked**
  (counts toward Materials + dashboard totals, or hidden) and **Flexible** (you're weighing
  candidates — surfaces the Compare link). There's no `status` enum: "done" is derived from
  ownership, and an unchosen slot just renders blank. **Weapons** are compact and editable —
  up to 8, each removable, with an "Add weapon" picker; empty weapon slots collapse.
- **Materials** (`/materials`) — whole-loadout aggregation: every tracked piece rolled
  into one master list keyed by itemId, required summed across pieces, owned subtracted
  **once**, split gated / grind / buyable, with a total buy-out cost. A **Base materials ↔
  Gifts & intermediates** view switch (`aggregateRequirements` vs `aggregateIntermediates`)
  toggles granularity: the gift view stops at the final-combine inputs, so once a gift is
  crafted and synced its base mats drop out. Every material name links to its GW2 wiki page
  (`lib/format.ts` `wikiUrl`; synthetic intermediates have no link).
- **Compare** (`/compare/:slotKey`) — side-by-side flexible-slot candidates ranked by
  remaining time-gate days, then gold, then material overlap; recommends the lowest-effort
  option and lets you pick the winner.
- **Build codes** (`lib/buildcode.ts`) — `encode`/`decode` a compact, URL-safe, versioned
  (`gw2-v2.…`) string of **goals only** (chosen pieces, tracked, flexible, priority,
  candidates). Never includes the API key. Import/export lives in Settings. Legacy `gw2-v1.`
  codes (which carried a `status` index) still decode — their status maps forward to the
  `flexible` flag. Round-trip is lossless for the goal fields (presentational label/family
  are rehydrated from `SLOT_ORDER` on decode, and the loadout is `normalizeLoadout`'d so all
  eight weapon slots exist).
- **Forecast** (`/forecast`) — time-gate forecaster: a what-if over the de-duplicated
  whole-loadout time-gate debt. Adjust the assumed daily pace per gated material (sliders)
  and the projected whole-loadout finish date moves; the binding (slowest) material is
  highlighted. Pace overrides persist in `gw2lt:paceOverrides` (advisory; never alters
  computed counts).
- **History** (`/history`) — snapshot momentum. The store logs one record per new sync
  (`gw2lt:history`: `{ ts, overall, byPiece }`); the screen charts overall completion across
  syncs (inline SVG) and shows a per-piece Δ-since-last-sync table.

### Custom-domain hosting (one-time DNS)

`npm run deploy` builds with `base: /gw2-loadout/` and publishes `dist/` to the `gh-pages`
branch. For a **custom domain** instead of `<user>.github.io/gw2-loadout/`:

1. Build for the domain root: `VITE_BASE=/ npm run build` (the project `base` path is wrong
   for an apex/subdomain).
2. Add a `CNAME` file containing your domain (e.g. `loadout.example.com`) to `public/` so
   it's copied into every `dist/` and survives redeploys.
3. DNS: for a subdomain, add a `CNAME` record pointing to `<user>.github.io`; for an apex
   domain, add GitHub Pages' `A`/`AAAA` records. Then set the custom domain in the repo's
   **Settings → Pages**. Allow time for DNS propagation and the TLS cert to issue.

## Phase 6 (polish) — shipped

Weighting sliders (Settings), the time-gate **forecaster** (`/forecast`), and **snapshot
history** (`/history`) are all built. Remaining open work is data accuracy and catalog reach,
not features — see [TODO.md](TODO.md) (unresolved PvP `testimonyOfHeroics` currency id;
precursor and weapon-themed-gift sub-trees still summarized as synthetic leaves; Draconic
Tribute id).
