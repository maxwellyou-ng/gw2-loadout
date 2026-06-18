// Aggregated legendary catalog. The schema holds any legendary; this is the
// seeded slice (seed-loadout weapons + armor + full trinket/back catalog).

import type { LegendaryPiece } from '../../types'
import { WEAPONS } from './weapons'
import { ARMOR } from './armor'
import { TRINKETS } from './trinkets'
import { BACKS } from './backs'

export const CATALOG: LegendaryPiece[] = [...WEAPONS, ...ARMOR, ...TRINKETS, ...BACKS]

export const CATALOG_BY_ID: Record<number, LegendaryPiece> = Object.fromEntries(
  CATALOG.map((p) => [p.id, p])
)

const norm = (s: string) => s.trim().toLowerCase()

export const pieceByName = (name: string): LegendaryPiece | undefined =>
  CATALOG.find((p) => norm(p.name) === norm(name))

export { WEAPONS, ARMOR, TRINKETS, BACKS }
