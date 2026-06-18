# GW2 Legendary Loadout Tracker

A pure client-side SPA (React + Vite + Tailwind v4) that plans and tracks progress
toward a Guild Wars 2 legendary loadout. Connect a read-only GW2 API key, sync, and
see per-piece completion, time-gate debt, earliest finish dates, and buy-out estimates.

This repo implements **Phases 1–2** of the build brief: the data spine (API client +
curated recipe dataset) and a read-only tracker.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build (base: /gw2-loadout/)
npm run check      # engine sanity checks (no API key needed)
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

### Id-namespace convention

The merged `owned[itemId]` snapshot keeps items, currencies, and unverified
intermediates collision-free:

| Range | Meaning |
|---|---|
| `0 … 7_999_999` | Real GW2 item ids |
| `8_000_000 + currencyId` | Wallet currencies (`/v2/account/wallet`) |
| `9_000_000 + n` | Synthetic intermediates (unverified gifts / precursors) |

### Completion score

`completionScore = Σ(weight·dimProgress) / Σweight` over the dimensions that have a
measurable basis (time = gated mats present; gold = TP prices loaded; quantity =
always). Defaults weight **time 0.6 ≫ gold 0.3 ≫ quantity 0.1**, adjustable in
Settings. A dimension with no basis (e.g. prices not synced yet) is **excluded**, not
counted as 100% — so an unsynced account never looks falsely complete.

## Data accuracy (important)

Per the brief's risk section, Mystic Forge recipes are hand-curated, not API-derived.
**The well-known costed / time-gated leaves use real item ids and quantities**
(Mystic Clovers, Mystic Coins, Globs of Ectoplasm, T6 fine mats, Obsidian Shards,
Charged Quartz). **Piece-specific precursors / themed gifts and newer
"Visions of Eternity"-era catalog entries are modeled as synthetic placeholders and
ship `verified: false`** with a wiki link — the UI flags them as *unverified*. They
must be cross-checked against the wiki and filled in (Phase 1 follow-up). Slot
assignments for a few newer trinkets are likewise unconfirmed.

## Verification status (brief checklist)

| Check | Status |
|---|---|
| App builds without errors | ✅ `npm run build` clean |
| Enter API key + Sync — no console errors | ✅ UI renders error-free; client has tolerant per-endpoint handling (needs a live key for a full end-to-end run) |
| Material counts match in-game vault | ⏳ needs a live key; engine maps the real item ids and merges all sources |
| Aetheric Anchor tree down to base mats | ✅ clovers (gated) + Mystic Tribute leaves + map-completion gifts; VoE specifics flagged unverified |
| Owned legendary auto-shows "Done" | ✅ id + name match (`npm run check` covers it) |
| Eikasia gloves achievement-gated, no forge | ✅ asserted in `npm run check` |

## Not yet built (Phase 3+)

Daily "what to do" dashboard, flexible-slot comparison, whole-loadout aggregation,
time-gate forecaster, build-code export/import, snapshot history.
