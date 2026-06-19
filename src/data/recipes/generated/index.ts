// ---------------------------------------------------------------------------
// Machine-owned recipe layer. The wiki:fix auto-fixer OWNS this folder; humans
// own the curated files (weapons.ts / armor.ts / trinkets.ts / backs.ts).
//
// `recipes.generated.json` is regenerated wholesale by `npm run wiki:fix` — it
// is a clean, idempotent rewrite, never surgically hand-edited. Every entry
// ships `verified: false` (a draft scaffolded from the wiki snapshot) until a
// human promotes it. On a name/id collision with a curated piece, the curated
// piece wins (see ../index.ts), so authored work is never clobbered.
// ---------------------------------------------------------------------------

import type { LegendaryPiece } from '../../../types'
import data from './recipes.generated.json'

export const GENERATED = data as unknown as LegendaryPiece[]
