# Agent task: recipe data cleanup (low complexity)

**Intended runner:** a Sonnet-class agent. Every task here is bounded, mechanical, and
low-risk — wiki transcription into an existing, well-typed pattern. No new architecture.

## What this project is

A client-side React + Vite + Tailwind SPA that tracks progress toward a GW2 legendary
loadout. The recipe data was wiki-verified on 2026-06-17; this task closes the last few
gaps. Read `README.md` (esp. the "Data accuracy" section) before starting.

## Ground rules (do not violate)

1. **Never invent item ids.** Every numeric id must be read off the item's GW2 Wiki
   infobox ("API #####"). If you can't confirm an id, leave the ref synthetic (see below)
   and add a `notes:` explaining why.
2. **Respect the id-namespace convention** in `src/data/items.ts`:
   - `0 … 7_999_999` = real GW2 item ids
   - `8_000_000 + currencyId` = wallet currencies (`currency(id)` helper)
   - `9_000_000 + n` = synthetic intermediates (`synthetic()` helper) for things with no
     inventory-matchable id (account-bound gifts consumed in the forge, achievements,
     precursor journeys).
3. **Add real ids to the `ITEM` registry** in `items.ts` (don't inline magic numbers),
   then reference them as `ref(ITEM.foo, 'Foo', qty)`.
4. **`verified: true` means the whole modelled tree was wiki cross-checked.** Only set it
   when that's true. A summarized synthetic sub-tree is fine and does not block
   `verified: true` as long as the top combine + leaf quantities are confirmed (this is
   the existing convention — see the weapons file).
5. After every task run **`npx tsc -b --noEmit`** (must exit 0) and **`npm run check`**
   (the engine sanity test — must print "ALL CHECKS PASSED"). Both must stay green.

## Recipe builder pattern (how the data works)

- `src/data/recipes/_builders.ts` — `ref()`, `node()`, and shared sub-trees
  (`giftOfFortune`, `mysticTribute`, `draconicTribute`, `giftOfCondensedMight/Magic`, …).
- A `RecipeNode` is `{ output, inputs[], source, buyable, timeGate, discipline?, notes? }`.
- A node whose `output.itemId` has **no producing node** OR has **empty `inputs`** is a
  *leaf* (counted directly against inventory). To "expand" a synthetic placeholder, give
  it real `inputs` (and ideally a real `output` id).
- Catalog files: `weapons.ts`, `armor.ts`, `trinkets.ts`, `backs.ts`. `index.ts` assembles
  `CATALOG`. Each piece ends with `recipe: { rootItemId, nodes, verified, wikiUrl, version }`.

---

## Task 1 — Prismatic Champion's Regalia (highest priority, ~20 min)

It is the **only** catalog entry still `verified: false`. In `trinkets.ts` it currently
has no `tribute`/`clovers` and no `verified` flag.

1. Open `https://wiki.guildwars2.com/wiki/Prismatic_Champion%27s_Regalia`.
2. Read the Acquisition → Recipe and "Full material list". Confirm: slot (already set to
   Amulet — verify), the Mystic Forge combine ingredients, and whether it consumes a
   **Mystic Tribute** (→ set `tribute: true`) or a flat clover count (→ `clovers: N`), and
   the real item id.
3. Update the `trinket({...})` entry: correct `type`/`acquisitionMode` if needed, set the
   gate (`tribute` or `clovers`), add the combine summary to `blurb`, and set
   `verified: true`.
4. Capture the real armory item id from the infobox and, if you wire ownership matching by
   id, swap the synthetic `id` for it (optional but nice — see how weapons.ts uses real
   armory ids like `90551`).

**Acceptance:** no catalog piece has `verified: false`; `tsc` + `npm run check` green.

## Task 2 — Resolve any remaining name-only synthetic leaves to real ids

Some leaves are still `ref(synthetic(), 'Name', qty)` even though the item has a real,
inventory-matchable id. Resolving them improves the "owned" math on sync.

Run this to list current synthetic-by-name leaves:

```bash
grep -rno "ref(synthetic(), '[^']*'" src/data/recipes/
```

For each, decide:
- **Has a real, stockpile-able item id** (it's a normal material/gift that sits in your
  bank) → look up the id on the wiki, add it to `ITEM`, and switch the ref.
  Known still-synthetic candidates worth resolving: **Bloodstone Shard**
  (`https://wiki.guildwars2.com/wiki/Bloodstone_Shard`), **Gift of War Prosperity**,
  **Gift of Jade Mastery**, **Mystic Runestone** (id already in `ITEM.mysticRunestone` —
  reuse it), **Icy Runestone** (already `ITEM.icyRunestone`).
- **Is genuinely id-less for our purposes** (an achievement, a per-map heart-vendor gift,
  a precursor *journey* rather than the precursor item) → leave synthetic, keep the
  `notes:`.

Do **not** force-fit an id you can't verify.

**Acceptance:** the grep list only contains genuinely id-less intermediates; each has a
`notes:` saying why; `tsc` + `npm run check` green.

## Task 3 — Expand weapon themed-gift sub-trees (optional, voluminous, low payoff)

Each seed weapon's "themed gift" and precursor are currently single synthetic leaves
(e.g. `Gift of Incinerator`, `Spark`). The wiki documents their full sub-recipes under
each weapon's "Full material list".

Only do this if the requester wants 100% tree depth. It is **bulk transcription**, and the
payoff is low (precursors are TP-buyable; themed-gift collections are achievement work that
doesn't map to countable inventory items). If you do it:

- For each weapon page (Incinerator, Astralaria, Exordium, Pharus, Aurene's Fang, Aurene's
  Scale, Aetheric Anchor), expand the themed gift into a `node(themed, [<components>], …)`
  with real leaf ids where the components are real materials (e.g. Deldrimor Steel ingots,
  Mystic Runestones, Gift of Research — already `ITEM.giftOfResearch`).
- Keep purely collection/achievement steps as synthetic leaves with notes.
- Do them one weapon at a time; run `tsc` + `npm run check` after each.

**Acceptance:** each expanded weapon still passes `npm run check`; no fabricated ids.

---

## Definition of done for this file

- `npx tsc -b --noEmit` exits 0.
- `npm run check` prints "ALL CHECKS PASSED".
- `npm run build` succeeds (note: the sandbox may have an arch-mismatched native binary
  for Vite/esbuild — if `npm run build` fails *only* on a `*.node` binding error, that's
  an environment issue, not your code; `tsc -b` + `npm run check` are the real gates).
- No new `verified: false` entries; no invented ids; the synthetic-leaf grep is down to
  genuinely id-less intermediates.
