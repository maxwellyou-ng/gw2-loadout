# Wiki reconciliation system

Keeps the legendary recipe catalog (`src/data/recipes/*`) in line with the
[GW2 Wiki](https://wiki.guildwars2.com), the single source of truth. It detects
missing legendaries, id mismatches, and recipe/quantity drift, and **gates the
build** so the project cannot silently deviate from the wiki.

The wiki has often been transcribed incorrectly by hand; this system makes those
discrepancies visible and enforced instead of relying on manual cross-checking.

## Commands

| Command | Network | Writes | Purpose |
|---|---|---|---|
| `npm run wiki:fetch` | yes | `snapshot/`, `cache/` | Re-download wikitext and rebuild the committed snapshot. |
| `npm run wiki:report` | no | — | Human-readable drift report (what's missing / wrong). |
| `npm run wiki:check` | no | — | The gate. Exits non-zero on unacknowledged drift. Runs inside `npm run build`. |
| `npm run wiki:check -- --update-baseline` | no | `baseline.json` | Accept the current state as the baseline. |
| `npm run wiki:report -- --scaffold="<Item>"` | no | — | Print a draft recipe stub (verified:false) for a missing item. |
| `npm run wiki:fix` | no | `generated/`, `baseline.json` | Auto-fixer. Regenerate `verified:false` drafts for all generatable missing items, validate (`tsc`/`check`/`wiki:check`), revert on failure, auto-prune resolved baseline acks. `-- --dry-run` previews. Alias: `wiki:report -- --apply`. |
| `npm run wiki:expand -- "<Item>"` | cache (live on miss) | — | Phase 4 recursive expander. Walks the wiki recipe DAG, stopping at the catalog's vocabulary (cycle/depth-guarded). `--check` lists wiki components the catalog doesn't model; `--deep` expands past base materials (structure only — totals compound via promotion recipes); `--no-cache` re-downloads. |
| `npm run wiki:ids` | yes (GW2 API) | — | Id gate (also in CI). Every `{name, id}` in the generated tables + assembled catalog must match its `/v2/items` name; every currency ref must exist in `/v2/currencies`; nothing may reference a `discontinued.json` tender or a `SUPERSEDED_BY_CURRENCY` item id. Self-skips (exit 0, loud notice) if the API is down. |
| `npm run wiki:obtainable` | cache (live on miss) | — | Obtainability review list. Scans every golden-totals leaf's wiki page for `{{historical}}` / "no longer obtainable" / disambiguation / gem-store-container-only acquisition. Human judges each flag: dead path → `discontinued.json` + recipe fix. |
| `npm run wiki:refinements` | yes (GW2 API) | `generated/refinements.generated.json` | Deterministic refinement recipes (ingots/planks/bolts/leather ← ore/logs/scraps/sections) from `/v2/recipes`, merged into the crafted-expansion path so owned refined stock credits against the raw tier. |

## How it works

```
wiki (MediaWiki API)
   │  fetch.ts        polite client + cache/  (raw wikitext)
   ▼
parse-list.ts  ──►  enumeration (every legendary the wiki lists)
parse-recipe.ts ─►  infobox API id + top-level recipe components (confidence-gated)
   │  snapshot.ts
   ▼
snapshot/<category>.json   ← COMMITTED "what the wiki says" (auditable in git)
   │  reconcile.ts (pure)  vs  src/data/recipes CATALOG (catalog-view.ts)
   ▼
Finding[]  ──►  report.ts (markdown)   check.ts (gate, uses baseline.json + gate.ts)
```

### Accuracy guardrails

1. **Wiki → catalog only.** Nothing here edits the wiki or rewrites recipe files.
2. **Pinned snapshot.** Fetching (network) is separate from comparison (pure).
   Every change in "what the wiki says" is a reviewable `snapshot/` diff.
3. **Confidence gating.** A recipe that can't be parsed cleanly is marked
   `confidence: "low"` and excluded from the gate — never emitted as a guess.
4. **`verified: true` is a contract.** A verified catalog recipe that doesn't
   match its high-confidence wiki snapshot fails `wiki:check`.
5. **Baseline.** `baseline.json` records the accepted current state (known gaps,
   intentional simplifications). The gate fails only on **new** drift.

### Curated overrides

If the parser gets a recipe wrong, edit that entry in `snapshot/<category>.json`
and set `"source": "curated"`. `wiki:fetch` then preserves it, but warns if the
upstream wikitext changes (via `wikitextHash`) so you can re-verify.

### Obtainability (2026-07-05 audit learnings)

The wiki does **not** reliably mark dead acquisition paths. The Black Lion
Commemorative Sprocket (a Gem Store Memory Box tender whose container left the
store) carries no `{{historical}}` template, yet its exchange row was the first
row of Gift of Ascension's vendor table — which the old first-row-wins parser
happily took, hiding the real Fractal Relic vendors. Defenses, in order:

- `discontinued.json` — reviewed-dead tenders. `gen-vendor-costs` skips rows
  priced in them; `wiki:ids` fails if anything still references one.
- `vendor-cost-overrides.json` — manual pin when several *current* vendors
  disagree and the tracked cost is a product decision (keep `GIFT_NOTES` in
  `_builders.ts` in sync so alternates stay visible to the player).
- `SUPERSEDED_BY_CURRENCY` (`aliases.ts`) — items converted to wallet
  currencies (Legendary Insight, Tales of Dungeon Delving). Generators emit
  `currency` inputs for these; referencing the retired item id fails `wiki:ids`.
- `wikitext.ts#itemInfoboxId` — ids come from the `{{Item infobox}}` block
  only. An unanchored `| id =` match returns nested-template ids (food pages
  embed `{{nourishment|…|id=N}}` *effect* ids — 10 wrong food ids in Orrax
  Manifested's gifts came from exactly this).

## Periodic operation

- Run `npm run wiki:fetch` after game updates / expansions (≈monthly), review the
  `snapshot/` + `baseline.json` diff, and commit via PR.
- `npm run wiki:check` runs on every `npm run build`, blocking drift between refreshes.

## Bringing the catalog in line

`npm run wiki:report` lists, per item, exactly what to change. To resolve an item:
fix its recipe in `src/data/recipes/*`, then remove its entries from
`baseline.json` (or rerun `--update-baseline`). If a fixed item later regresses,
the gate catches it. `--scaffold` drafts a starting point for missing items.

**Automated path:** `npm run wiki:fix` regenerates `verified:false` drafts for every
generatable missing item into the machine-owned `src/data/recipes/generated/` layer
(merged into `CATALOG`; curated entries win any collision). It self-validates and reverts
on failure, so a bad generation can't land. Drafts use synthetic component ids until
phase 3 resolves real ones; armor sets and id-less items stay in the curated lane.

## Files

- `types.ts` — shared shapes (`SnapshotEntry`, `Finding`, `Baseline`).
- `fetch.ts` / `wikitext.ts` — MediaWiki client + cache; dependency-free wikitext parsing.
- `parse-list.ts` / `parse-recipe.ts` — enumeration + recipe extraction.
- `snapshot.ts` — `wiki:fetch` entrypoint. `store.ts` — snapshot/baseline IO.
- `catalog-view.ts` — comparison view over the live `CATALOG`.
- `reconcile.ts` — the pure diff. `gate.ts` — baseline classification.
- `report.ts` / `check.ts` / `fix.ts` — `wiki:report` / `wiki:check` / `wiki:fix` entrypoints.
- `../../src/data/recipes/generated/` — machine-owned draft layer written by `fix.ts`.
- `aliases.ts` — name normalization + wiki↔catalog name aliases + `SUPERSEDED_BY_CURRENCY`.
- `check-ids.ts` / `gen-obtainability.ts` / `gen-refinements.ts` — id gate,
  obtainability review, refinement recipes (see Commands).
- `discontinued.json` / `vendor-cost-overrides.json` — **committed** review
  decisions: dead tenders + manual vendor-cost pins.
- `snapshot/*.json`, `baseline.json` — **committed**. `cache/` — git-ignored.

## Known follow-ups

- Deeper leaf verification: snapshot the shared-gift wiki pages (Gift of Fortune,
  Mystic/Draconic Tribute, Gift of Condensed Might/Magic) and compare flattened
  leaf quantities (clovers, ecto, T6 tiers) — where the historical errors lived.
- Add name aliases for catalog modeling choices that don't 1:1 match wiki titles
  (Aetheric Anchor ↔ Ancora Bellum/Pax; WvW shoulders ↔ armor sets).
