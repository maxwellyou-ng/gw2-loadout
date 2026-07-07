# UX Best Practices — GW2 Legendary Tracker

How to read this doc: each entry is **Principle → Why it matters → Concrete GW2 example → Current status**. ✅ means the app follows the practice (keep it that way); **⚠→✅ Fixed** marks practices the pre-redesign UI violated that the 2026-07 redesign (see [REDESIGN.md](REDESIGN.md)) implemented — the original violation is kept in the text so the reasoning survives. The scope is *making the right next action obvious* — none of these are guardrails against misuse. The violations index at the end records what was found and how it was resolved.

---

## Theme 1 — Make the next action obvious

### 1.1 One loud answer to "what do I do right now?"
- **Why:** A tracker's job is to convert an intimidating multi-month grind into today's 10 minutes. If the user must assemble the answer from several equally-weighted panels, the app has delegated its core job back to the user.
- **GW2 example:** A player logs in with 20 minutes before a raid. The app should say, in one glance: *"Forge your daily Mystic Clovers — they're the binding material for Twilight, your top goal."* Not: here's a ring, a ladder, a debt table, and four sections to synthesize.
- **Status: ⚠→✅ Fixed.** The old Dashboard's four sections had equal visual weight; nothing was the answer. The *Today* screen's Focus card is now the single accent-bordered element on the page, selected by strict rule: uncelebrated completion → best finish-line push → top goal framed by its binding time gate ([Today.tsx](../src/screens/Today.tsx), [FocusCard.tsx](../src/components/today/FocusCard.tsx)).

### 1.2 Surface the bottleneck, not just the debt
- **Why:** In legendary crafting, one time-gated material almost always sets the finish date (the *binding* material). Players who know the bottleneck can act on it (buy clovers with ecto/coin, run Fractal CMs); players who see only a flat list can't prioritize.
- **GW2 example:** Mystic Clover binds Twilight, Conflux, *and* Vision at ~2/day from the daily forge. That's one insight — "clovers gate 3 of your 5 goals; every clover source you add compresses three timelines" — and the data to compute it already exists in `aggregateRequirements().timeGateDebt` + per-piece `remainingMaterials`.
- **Status: ⚠→✅ Fixed.** Debt used to be listed flat, per material and per piece. Today's *Bottlenecks* module now groups the de-duplicated debt by material and names the goals it holds hostage ("Mystic Clover binds 3 goals — Twilight, Conflux…"), linking to the pace tuning on Materials ([Bottlenecks.tsx](../src/components/today/Bottlenecks.tsx)).

### 1.3 Recommend the finish-line push
- **Why:** Completion momentum is the strongest motivator in long grinds. When a goal is one focused session (or one Trading Post spree) from done, the app should promote it above the routine.
- **GW2 example:** Exordium at 92% with only ecto and TP-buyable mats left: "≈212g closes it today" is a better use of the evening than another day of passive clover accrual.
- **Status: ✅ Followed** — `isFinishLinePush` (≥80% and ≤14 days, or fully purchasable) powers the Dashboard's "Push to finish" cards, and gold-closable beats date-bound. The redesign keeps the rule and promotes the best push into the Focus card.

### 1.4 Daily actions should read as a checklist, not a report
- **Why:** Time-gated materials are a *ritual* (forge clovers, buy charged quartz, do the reward track tick). Rituals want checkboxes and a sense of "done for today," not tables.
- **GW2 example:** "○ Forge Mystic Clovers (77 left, ~2/day) · ● Charged Quartz ✓ · 2 of 4 collected."
- **Status: ✅ Followed** — the Dashboard's "Do today" list with its advisory *Mark collected today* toggle is exactly right, including the honest choice to keep the toggle cosmetic (real counts come only from sync). Keep the de-duplication across goals.

## Theme 2 — Information architecture at the altitude players think

### 2.1 Model goals, not storage slots
- **Why:** The unit of desire is the legendary ("I want Twilight"), not the equipment slot. A slot grid forces players to translate their intent into bookkeeping, spreads management across screens, and produces dead UI for slots with no catalog (relic/runes/aquabreather).
- **GW2 example:** No player has ever said "I'm working on weapon slot 4." They say "Aurene's Scale next, then Conflux."
- **Status: ⚠→✅ Fixed (structural).** The slot grid (`weapon1..weapon8` as bookkeeping, priority living on slots, reordering exiled to the Dashboard) is gone. The Plan model is an ordered goal list — array order *is* priority — with slot coverage reduced to a derived one-line view on Goals; the legacy `gw2lt:loadout` key migrates losslessly on first load and stays for rollback ([plan.ts](../src/state/plan.ts)). The engine needed zero math changes.

### 2.2 Browsable catalog with the facets players use
- **Why:** Choosing a legendary is a research decision players make by generation (Gen 1 RNG precursor vs Gen 3 deterministic), game mode (WvW's Conflux vs raid's Coalescence), weapon type, and — crucially — *cost/time for their account*. A search-only combobox assumes the decision is already made.
- **GW2 example:** "Show me Gen 3 greatswords I could finish fastest given what's in my bank" is the real question. The app already computes isolation progress for the entire catalog on every sync — days-to-finish-for-you per candidate is free.
- **Status: ⚠→✅ Fixed.** Discovery was trapped in per-slot 55-item comboboxes with generation flattened into blurb text. The Catalog screen now facets by family, generation/source (structured `gen` field), and sorts by *fastest for you* / cheapest buy-out, with per-card "~34d of time gates · ≈610g buyable" chips computed from your account ([Catalog.tsx](../src/screens/Catalog.tsx)).

### 2.3 Right altitude at each level: summary → drill-down → wiki
- **Why:** Legendary recipes are 4+ levels deep with hundred-item leaf lists. Showing everything everywhere buries the goal; hiding everything strands the curious. Each level should answer one question and link down.
- **GW2 example:** L0 goal card: "Twilight — 61%, ~Jul 28, bound by clovers." L1 detail summary: three progress dimensions + material groups (collapsed, with counts). L2: expand a group or the recipe tree (Dawn → Gift of Twilight → …). L3: the wiki page for *Charged Lodestone* farming routes — that depth belongs on the wiki, not in the app.
- **Status: ⚠→✅ Fixed** (with a correction: recipe-tree nodes already linked to the wiki via `WikiName` — the original review under-credited that). PieceDetail now enforces the ladder: summary header → material groups as disclosures (time-gated open, the rest collapsed with counts) → crafting tree → per-node wiki links ([PieceDetail.tsx](../src/screens/PieceDetail.tsx)).

### 2.4 Tabs are for questions, not features
- **Why:** Each top-level destination should answer a distinct recurring question. When one question (when will I finish?) is smeared across three tabs (Dashboard/Forecast/History), every check-in costs three navigations.
- **GW2 example:** "What do I do now?" (Today) · "What am I working toward, in what order?" (Goals) · "What do I farm/buy?" (Materials) · "Is my account connected?" (Settings). Forecast's pace sliders are a *parameter* of the Materials question; History's chart is a Goals module.
- **Status: ⚠→✅ Fixed.** Six tabs became four (Today · Goals · Materials · Settings). Forecast's pace sliders folded into Materials as a disclosure ([PacePanel.tsx](../src/components/PacePanel.tsx)), History's chart moved to Goals' trophy shelf, and old routes redirect.

## Theme 3 — Progress that tells the truth (and the whole truth)

### 3.1 One progress number per context, allocation-first
- **Why:** When tracked goals share materials, "your 77 clovers" can't count toward all five goals at once. Showing plan-aware (allocated) progress in one place and isolation progress in another — with the mismatch explained in a warning card — makes the *user* reconcile the books.
- **GW2 example:** Bolt is 5th in priority; your clovers are spoken for by Twilight and Conflux. Bolt's card should say "34% in your plan (72% if it were your only goal)" — plan-aware first, isolation as the aside.
- **Status: ⚠→✅ Fixed.** PieceDetail used to lead with isolation numbers plus a warning card explaining why they disagreed with the Dashboard. It now leads with the plan-aware (allocated) numbers when the piece is an active goal — "#2 in your plan (behind Twilight)" — with the isolation view one labelled toggle away. The engine's consumption-correct allocation walk is preserved verbatim.

### 3.2 Credit what the player already holds — raw, refined, or in the wallet
- **Why:** Legendary materials sit unrefined for months: ore that isn't ingots yet, wallet currency that isn't spent at the vendor yet. A tracker that counts only the finished form under-reports closeness and demoralizes exactly the players who are nearly done.
- **GW2 example:** 3,200 Mithril Ore in the material vault covers the Mithril Ingot line of a Gift; 1.2M karma covers the obsidian. That piece is *not* "missing ingots" — it's "93% done, mostly refinement left."
- **Status: ⚠→✅ Fixed.** The engine already credited refinement tiers (ore→ingot expansion) and wallet currencies — raw forms *are* the leaves — but the UI didn't say so. Closeness now surfaces at the piece level: the Focus card reads "every material is on hand — all that's left is refining and forging," and PieceDetail's Finishing steps card turns the conversion gap into a checklist ([convertible.ts](../src/engine/convertible.ts)). (A separate "convertible" leaf group would be fiction — at the leaf level you either hold the raw form or you don't.)

### 3.3 Refine-when-close: surface conversion work late
- **Why:** Refining early is often wrong in-game (raw mats are liquid; refined are not), and a long convert checklist on a 30% goal is noise. Conversion becomes the *action* only near the end.
- **GW2 example:** When Exordium's remainder is all convertible/buyable, show "Finishing steps: refine 250 ingots · buy 77 ecto · forge Gift of Fortune." Before that, keep it collapsed.
- **Status: ⚠→✅ Fixed.** PieceDetail shows a "Finishing steps" card — buys first, then conversions deepest-first (refine → forge → capstone combine), with disciplines and TP costs — only when the whole remainder is on hand or buyable (`finishingPlan`, [convertible.ts](../src/engine/convertible.ts)). Before that point it simply doesn't exist: no pressure to refine early.

### 3.4 Show your provenance
- **Why:** Players cross-check trackers against the wiki. Admitting which recipe nodes are wiki-verified vs hand-entered earns the trust that makes the rest of the numbers believable.
- **GW2 example:** "✓ wiki" vs "⚠ unverified" badges on tree nodes; the unverified-recipe banner on affected pieces.
- **Status: ✅ Followed** — provenance badges + the verified/wiki-URL fields are exemplary. Keep the badge in the redesigned tree.

## Theme 4 — Low-friction management, safe by default

### 4.1 Destructive actions get an undo, not a confirm
- **Why:** Confirms train click-through; undo preserves flow *and* safety. A tracked goal embodies months of intent — losing it to a stray click on ✕ shouldn't be possible, but neither should adding friction to every removal.
- **GW2 example:** Remove Aurene's Fang by accident while tidying → toast: "Removed Aurene's Fang — Undo" (6s). Same for reorder and for build-code import (which currently replaces the whole loadout wholesale).
- **Status: ⚠→✅ Fixed.** Removing a goal, reordering (incl. sort-by-fastest), and build-code import all raise a 6-second Undo toast backed by a single-level restore snapshot ([UndoToast.tsx](../src/components/UndoToast.tsx), store undo API).

### 4.2 Add flow: decision support at the point of choice
- **Why:** Adding should be 2–3 clicks *and* informed — cost/time chips belong on the candidates, not three screens later.
- **GW2 example:** Catalog card: "Aurene's Wisdom — Gen 3 · staff · ≈480g + 21 days for you" → "Add as goal."
- **Status: ⚠→✅ Fixed.** The old picker's 2-click mechanics were great but names-only. Catalog cards now carry the decision data — generation, game mode, % complete, days of gates, buy-out gold for *your* account — at the point of choice; "Add as goal" is one click from there.

### 4.3 Completion is a moment and a place, not a pill
- **Why:** Finishing a legendary is a months-long arc ending in one sync. If the app's response is a checkmark pill on a list row, the user gets closure from Reddit instead. Celebrate once, then archive — done goals shouldn't clutter the working list.
- **GW2 example:** Sync detects Quip unlocked → gold celebration card on Today (confetti respecting `prefers-reduced-motion`) → goal moves to the *trophy shelf* on Goals: icon, completion date, days it took — and the ladder visibly improves as Quip's claimed materials free up for the next goal.
- **Status: ⚠→✅ Fixed.** Sync detects newly-unlocked goals (first-ever sync stays silent — no confetti for ancient history), Today leads with a one-time celebration card ("36 days in the making · its claimed materials are now free"), and the goal auto-archives to Goals' trophy shelf with completion date and duration. The ladder shrinks; downstream numbers visibly improve.

### 4.4 Reprioritization should answer "what's fastest?" in one click
- **Why:** "What should I finish first?" is the most common replanning question, and the app already knows every goal's earliest finish date. Making the user eyeball dates across cards is computation offloading in the wrong direction.
- **GW2 example:** "Sort by fastest finish" reorders the ladder (time-gate days → gold → overlap), shows the deltas ("Twilight slips +12d"), and offers undo — because allocation order changes the numbers, the trade-off must be visible.
- **Status: ⚠→✅ Fixed.** "Sort by fastest finish" on Goals reorders the ladder by remaining effort (time-gate days → gold → overlap), shows per-goal finish-date delta badges ("slips +12d" / "9d sooner"), and raises an Undo toast.

## Theme 5 — Visual language & density

### 5.1 Speak GW2's palette, quietly
- **Why:** Players spend hundreds of hours in the game's UI; borrowed color semantics transfer instantly (legendary purple-gold, rarity tiers, the dark client chrome).
- **GW2 example:** Legendary-gold `#e0a44a` as the accent; gate-purple for time-locks; `g s c` coin formatting.
- **Status: ✅ Followed** — the token set is cohesive and GW2-true. The redesign recomposes these tokens; it does not restyle them.

### 5.2 Status is never color alone
- **Why:** ~8% of male players are red-green colorblind; green-done vs amber-progress side by side is exactly the failure case.
- **GW2 example:** "Done ✓" pill text + percentage labels + opacity dimming alongside the green/amber/red coding.
- **Status: ✅ Followed** — multi-signal throughout. Preserve in all new components.

### 5.3 Density scales by collapsing, not shrinking
- **Why:** The UI must hold at 2 goals and at 25. Grouping with counts ("Time-gated · 12") keeps orientation; font-size reduction and truncation destroy it.
- **GW2 example:** A veteran tracking 5 gen-2s plus armor sees: Focus card, 4-item checklist, 3 bottleneck rows, compact top-5 ladder — regardless of total goal count. The other 20 goals are one click away on Goals.
- **Status: ✅ mostly** — Materials groups and the depth-gated tree scale well; the Dashboard ladder renders everything. The Today/Goals split (compact top-5 + full managed list) completes it (Phases 2–3).

### 5.4 One loud element per screen
- **Why:** Emphasis is a budget. When four sections shout, the eye reads none of them first — hierarchy is the design.
- **GW2 example:** Today: the Focus card alone gets the accent border and large CTA; checklist gets affordances; ladder is quiet text.
- **Status: ⚠→✅ Fixed.** Today enforces the budget: the Focus card alone gets the accent border and the only large CTA; the checklist gets affordances; the ladder is quiet text.

## Theme 6 — Accessibility & feedback

### 6.1 Keyboard visibility equals mouse visibility
- **Why:** The app already has excellent keyboard *support* (combobox arrows, modal escape/focus-restore, real buttons) — but without `:focus-visible` rings, keyboard users navigate blind.
- **Status: ⚠→✅ Fixed.** Global accent `:focus-visible` outline in [index.css](../src/index.css), unlayered so it wins over `outline-none` utilities.

### 6.2 Respect prefers-reduced-motion
- **Why:** Progress-bar transitions, ring animations, and (soon) celebration confetti are vestibular triggers for some users; one media query opts them all out.
- **Status: ⚠→✅ Fixed.** Global `prefers-reduced-motion: reduce` media query kills animations and transitions; the celebration moment is a static gold card, not motion-dependent.

### 6.3 Contrast floors apply to disabled states too
- **Why:** "Disabled" must still be *readable* — users need to know what the button would do.
- **Status: ⚠→✅ Fixed.** A global `button:disabled` rule replaces opacity fading with a dedicated disabled ink (`#9aa2b5` on surface-2, ≈6:1).

### 6.4 Async progress talks to screen readers
- **Why:** Sync takes seconds and reports progress visually ("Fetching inventory…"); without `aria-live`, a screen-reader user hears silence, then a changed page.
- **Status: ⚠→✅ Fixed.** Layout now has a skip-to-main link (focus-based, since a bare `#main` href would fight HashRouter) and a polite `aria-live` region narrating sync progress and failures.

### 6.5 Acknowledge every user action within one beat
- **Why:** Toggles, collections, and syncs should produce immediate, proportionate feedback — quiet for routine (checkmark flip), loud once for milestones (celebration card).
- **Status: ✅.** "✓ Collected" flips instantly for the routine; completions get the one-time celebration moment (see 4.3).

---

## Violations index (all resolved in the 2026-07 redesign)

| # | Practice violated | Where (pre-redesign) | Severity | Resolution |
|---|---|---|---|---|
| 1 | 1.1 One loud "what now" | Dashboard's four equal sections | High | Today screen + Focus card (P2) |
| 2 | 2.1 Goals, not slots | Loadout slot grid; priority on slots | High (structural) | Plan/Goal model + migration (P1), Goals screen (P3) |
| 3 | 3.1 Allocation-first everywhere | PieceDetail isolation-first + warning card | High | Flip default, isolation toggle (P4) |
| 4 | 3.2/3.3 Credit raw & wallet; refine-when-close | Materials shown as gaps until refined | High | Convertible state + Finishing steps (P1/P4) |
| 5 | 4.1 Undo over confirm | 1-click irreversible remove/reorder/import | High | UndoToast (P0), import merge preview (P1) |
| 6 | 4.3 Completion moment + archive | "🎉" line; done pieces linger on ladder | High | Celebration + trophy shelf (P1/P3) |
| 7 | 2.2 Browsable catalog | Per-slot comboboxes only; gen buried in blurbs | Medium | Catalog overlay with facets (P3) |
| 8 | 1.2 Bottleneck surfacing | Flat debt lists | Medium | Bottlenecks module (P2) |
| 9 | 4.4 One-click fastest-first | Manual drag only | Medium | Sort-by-fastest + deltas + undo (P3) |
| 10 | 2.4 Tabs = questions | 6 tabs for 4 questions | Medium | 6→4 consolidation (P2–P4) |
| 11 | 6.1–6.4 Focus rings, reduced motion, disabled contrast, aria-live, skip link | Global | Medium | index.css + Layout (P0) |
| 12 | 2.3 Disclosure ladder + wiki links | Detail dumps materials; tree nodes don't link out | Low | PieceDetail ladder + node wiki links (P4) |
| 13 | — Returning-user re-orientation | Stale timestamp only; history data unused | Medium | WelcomeBack diff from gw2lt:history (P2) |

## Persona walkthroughs

**New player, first legendary, zero progress.** Lands on Today → onboarding Focus card → "Browse legendaries" → Catalog faceted to Gen 1 weapons, cards show honest "≈95d · ≈2,100g for you" → adds Twilight (3 clicks total) → Today now shows the clover ritual as the first checklist item and Twilight's binding gate as the Focus framing. The scary number is made actionable, not hidden.

**Veteran, 5 gen-2 legendaries, overlapping mats.** Today: Focus = highest-leverage action across all five; Bottlenecks: "Mystic Clover binds 3 goals · 34d," pace slider inline. Goals: allocation-aware ladder, sort-by-fastest with visible deltas. Materials: one de-duplicated list, convertible tier showing the ore/wallet cushion. The overlap that used to require mental math is the headline.

**Completed an item; wants closure, not clutter.** Sync detects the unlock → celebration card (once) → trophy shelf entry with completion date and days-in-progress → ladder shrinks and every downstream goal's numbers visibly improve as the freed materials reallocate. Closure, then a clean list.

**Wants to reprioritize by what's fastest.** Goals → "Sort by fastest finish" → ladder reorders by finish date with per-goal deltas and an undo toast. One click for what was previously impossible without a spreadsheet.
