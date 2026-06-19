// Aggregated legendary catalog. The schema holds any legendary; the curated
// slice (seed-loadout weapons + armor + full trinket/back catalog) is authored
// by hand, and the machine-owned `generated/` layer (wiki:fix drafts) is merged
// in on top — curated always wins a name/id collision so authored work is never
// clobbered.

import type { LegendaryPiece } from '../../types'
import { WEAPONS } from './weapons'
import { ARMOR } from './armor'
import { TRINKETS } from './trinkets'
import { BACKS } from './backs'
import { GENERATED } from './generated'

const norm = (s: string) => s.trim().toLowerCase()

const CURATED: LegendaryPiece[] = [...WEAPONS, ...ARMOR, ...TRINKETS, ...BACKS]

const curatedNames = new Set(CURATED.map((p) => norm(p.name)))
const curatedIds = new Set(CURATED.map((p) => p.id))

// Generated drafts only fill gaps: anything a curated file already covers (by
// name or id) takes precedence and the generated entry is dropped.
const generatedKept = GENERATED.filter(
  (p) => !curatedNames.has(norm(p.name)) && !curatedIds.has(p.id)
)

export const CATALOG: LegendaryPiece[] = [...CURATED, ...generatedKept]

export const CATALOG_BY_ID: Record<number, LegendaryPiece> = Object.fromEntries(
  CATALOG.map((p) => [p.id, p])
)

export const pieceByName = (name: string): LegendaryPiece | undefined =>
  CATALOG.find((p) => norm(p.name) === norm(name))

export { WEAPONS, ARMOR, TRINKETS, BACKS }
