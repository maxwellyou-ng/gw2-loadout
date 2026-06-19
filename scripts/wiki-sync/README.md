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

## Periodic operation

- Run `npm run wiki:fetch` after game updates / expansions (≈monthly), review the
  `snapshot/` + `baseline.json` diff, and commit via PR.
- `npm run wiki:check` runs on every `npm run build`, blocking drift between refreshes.

## Bringing the catalog in line

`npm run wiki:report` lists, per item, exactly what to change. To resolve an item:
fix its recipe in `src/data/recipes/*`, then remove its entries from
`baseline.json` (or rerun `--update-baseline`). If a fixed item later regresses,
the gate catches it. `--scaffold` drafts a starting point for missing items.

## Files

- `types.ts` — shared shapes (`SnapshotEntry`, `Finding`, `Baseline`).
- `fetch.ts` / `wikitext.ts` — MediaWiki client + cache; dependency-free wikitext parsing.
- `parse-list.ts` / `parse-recipe.ts` — enumeration + recipe extraction.
- `snapshot.ts` — `wiki:fetch` entrypoint. `store.ts` — snapshot/baseline IO.
- `catalog-view.ts` — comparison view over the live `CATALOG`.
- `reconcile.ts` — the pure diff. `gate.ts` — baseline classification.
- `report.ts` / `check.ts` — `wiki:report` / `wiki:check` entrypoints.
- `aliases.ts` — name normalization + wiki↔catalog name aliases.
- `snapshot/*.json`, `baseline.json` — **committed**. `cache/` — git-ignored.

## Known follow-ups

- Deeper leaf verification: snapshot the shared-gift wiki pages (Gift of Fortune,
  Mystic/Draconic Tribute, Gift of Condensed Might/Magic) and compare flattened
  leaf quantities (clovers, ecto, T6 tiers) — where the historical errors lived.
- Add name aliases for catalog modeling choices that don't 1:1 match wiki titles
  (Aetheric Anchor ↔ Ancora Bellum/Pax; WvW shoulders ↔ armor sets).
