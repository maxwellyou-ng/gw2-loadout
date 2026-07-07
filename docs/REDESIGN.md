# Redesign: From Slot Tracker to Goal Planner

Approved architecture for the UX overhaul. Companion to [UX-BEST-PRACTICES.md](UX-BEST-PRACTICES.md), whose violations index maps onto the phases below.

> **Status: implemented 2026-07-06** — all phases (P0–P4) shipped and verified in the live preview: goal-centric plan with lossless migration, Today/Goals/Materials/Settings nav, Catalog + generalized Compare, celebration → trophy-shelf lifecycle, finishing-steps closeness framing, undo, and the a11y pass. One deliberate deviation: the "convertible" material state surfaces at the *piece* level (Focus card + Finishing steps) rather than as a fourth leaf group — refinement expansion makes raw forms the leaves, so a leaf-level convertible state would be fiction. Compare's per-row delta chips on sort-by-fastest render on Goals as badges.

## 1. Verdict

**Replace the slot-centric model with a goal-centric plan, collapse six tabs into four, and make a single "Today" surface the front door.** This re-architects the UI shell and state model — not the engine, data pipeline, or design system, all of which survive unchanged.

The case for keeping slots was real (the armory-completion fantasy, fixed armor/trinket counts, working code) but the slot model is a *storage* concept leaking into the *interaction* model, and it directly causes four of the ten major UX problems: priority lives on slots (so reordering drifted to the Dashboard), discovery is trapped in per-slot pickers (so no catalog can exist), relic/runes/aquabreather render permanently dead cards, and a grid cell can't be "done and gone" (so completed pieces linger).

**The decisive finding: the engine is almost fully decoupled from slots.** `computeProgress` is purely piece-based; `allocateProgress` reads only `tracked`, `priority`, `chosenPieceId`, and `key` (as a map key). The allocation walk is "ordered pieces against a depleting snapshot" — it doesn't care whether the order comes from slots or a wishlist index. A ~15-line adapter maps goals onto the existing interface with zero engine edits.

## 2. Target information architecture

```
Today (default)  ·  Goals  ·  Materials  ·  Settings
overlays: /piece/:id (detail) · /catalog (add flow) · /compare?ids=a,b,c
```

| Screen | Primary question | Key modules |
|---|---|---|
| **Today** | What do I do right now? | Welcome-back diff · Focus card · Daily checklist · Bottlenecks · finish-line pushes · compact top-5 ladder |
| **Goals** | What am I working toward, in what order? | Priority ladder (drag + sort-by-fastest) · deciding goals w/ compare · derived coverage grid · trophy shelf + momentum chart |
| **Materials** | What do I farm/buy, and when does it land? | Existing shopping list/filters · projected-finish header + pace sliders (Forecast absorbed) · convertible tier |
| **Settings** | Is my data connected and safe? | API key, sync, weights, export/import (merge preview + undo) |

Where the old screens go: **Dashboard → Today** (ladder moves to Goals). **Loadout → Goals** (slot grid becomes a derived coverage-grid module computed from `piece.type` + `slotHint`). **Forecast → Materials** (pace panel + projected finish). **History → Goals** (chart on the trophy shelf; per-piece deltas fuel the welcome-back diff — the data is already logged in `gw2lt:history`). **Compare → generalized** to any `?ids=` set, reachable from Catalog multi-select and deciding goals.

**New: Catalog** (`/catalog`, full-screen overlay from Goals). Facets: family/type, generation/expansion (promote `WeaponSpec.gen` to a structured `LegendaryPiece.gen` field — today it's flattened into blurbs), game mode, buy-out cost, and **days-to-finish for your account** — free, because the store already computes isolation progress for the whole catalog each sync.

## 3. The "Today" surface

```
A · WELCOME BACK (only after >3 days away)
    "18 days · Quip COMPLETED · overall +6% · new bottleneck: Mystic Clover"  [Sync]
B · FOCUS ← the one loud element: accent border, largest type, only large CTA
    [icon] Finish Exordium — 92% ▓▓▓▓▓░
    Everything left is purchasable — ≈212g closes it today.  [View finishing steps →]
C · DO TODAY (checklist)          | D · BOTTLENECKS
    ○ Forge Mystic Clovers 77·2/d |   Mystic Clover 34d — binds 3 goals [pace↗]
    ● Charged Quartz ✓            |   Gift of Battle 9d — binds Conflux
E · PUSH TO FINISH (cards; only when >1 push — #1 is already the Focus)
F · YOUR LADDER (read-only top 5)                       [Manage goals →]
```

**Focus card selector** (strict order): 1) newly completed, uncelebrated piece → celebration card; 2) best finish-line push (`isFinishLinePush`; gold-closable beats date-bound) → "finish X now" with finishing steps; 3) top-priority active goal framed by its binding time-gate entry ("Twilight is bound by Mystic Clovers — 34 days at 2/day; today's clovers are the highest-leverage 10 minutes"); 4) no goals → onboarding into the Catalog.

**Bottlenecks** inverts existing data: group aggregate `timeGateDebt` by material, count goals whose remaining materials include it, attach the pace slider inline.

## 4. Journey step counts (before → after)

| Journey | Before | After |
|---|---|---|
| Discover + add | ~7 steps, 2 screens, zero decision data | 3 clicks via faceted Catalog with per-account cost/time chips |
| Check progress | 3 tabs to assemble one answer | 0 extra clicks (Today), allocation-first detail |
| Reprioritize by fastest | impossible without a spreadsheet | 1 click, deltas shown, undo |
| Complete a piece | silent pill, lingers forever | celebration → trophy shelf → visible reallocation |
| Return after weeks | stale timestamp | sync → welcome-back diff incl. bottleneck changes |

## 5. Schema, migration, closeness model

```ts
// gw2lt:plan (v2) — old gw2lt:loadout left untouched for rollback
interface Plan { version: 2; name: string; goals: Goal[] }     // array order = priority
interface Goal {
  id: string                        // stable uuid — allocation key
  pieceId: number | null            // null only while deciding
  state: 'active' | 'paused' | 'deciding' | 'done'
  candidateIds?: number[]
  slotHint?: SlotKey                // migration provenance; feeds coverage grid + buildcode
  addedAt: string; completedAt?: string
}
```

**Lossless migration** (one-time, when `gw2lt:plan` absent): chosen+tracked → `active`, chosen+untracked → `paused`, flexible with candidates and no choice → `deciding`, empty non-flexible slots → dropped. Priority order preserved. Buildcode gets a v2 payload; import becomes merge-preview + undo.

**Closeness model** (user-directed): materials classify as **missing / convertible / buyable / gated**. Convertible = the raw form is on hand (ore for ingots, wallet currency for vendor items — the engine already credits these) and reads as near-owned: "93% — mostly refinement left." Conversion work surfaces late as a **Finishing steps** checklist (refine / buy / forge) shown only when a piece is ≥80% or its remainder is fully convertible+buyable. Disclosure ladder: L0 goal card (%, date, one-line blocker) → L1 detail summary (collapsed groups) → L2 tree → L3 wiki links per node.

## 6. Phases

- **P0 — a11y + safety** (independent): focus-visible rings, prefers-reduced-motion, disabled contrast, skip link, aria-live sync region, generic UndoToast on remove/reorder/import.
- **P1 — model:** `src/state/plan.ts` (types, migration, `goalsAsSlots()` adapter), store goals API + celebration detector + `gw2lt:lastVisit`, structured `gen` field, `src/engine/convertible.ts` (additive helper), buildcode v2.
- **P2 — Today:** `screens/Today.tsx` + `components/today/*`; `/` routes to Today.
- **P3 — Goals + Catalog:** `screens/Goals.tsx`, `screens/Catalog.tsx`, Compare `?ids=`, celebration moment.
- **P4 — consolidation:** PacePanel into Materials, PieceDetail allocation-first + finishing steps + wiki links, delete Loadout/Dashboard/Forecast/History, 4-tab nav.

## 7. Not changing

`src/engine/` (sole permitted edit: widen `Partial<Record<SlotKey,…>>` map keys to `Record<string,…>`, last) · `src/data/recipes/**` + wiki-sync pipeline · TIME_GATED registry · `src/api/gw2.ts` · design tokens + `ui.tsx` primitives · HashRouter, localStorage, background-location modal pattern · RecipeTree internals, Materials toolbar, PiecePicker (reused in Catalog search).
