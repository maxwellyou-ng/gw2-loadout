// ---------------------------------------------------------------------------
// `npm run wiki:gate-audit` — seed / maintain the gate-or-allowlist file.
//
// Every non-buyable bulk leaf (see gate-candidates.ts) must be either in
// TIME_GATED (data/items.ts) or documented in fast-acquire.json with a reason.
// This script appends any unclassified candidate to fast-acquire.json with an
// "UNCLASSIFIED — review" reason (never overwrites hand-written entries) and
// prunes entries whose material is now gated or no longer a candidate.
// Check 4 in check-totals.ts (`npm run wiki:totals`, in CI) fails on any
// UNCLASSIFIED reason, so a new recipe leaf can't ship unreviewed.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectGateCandidates } from './gate-candidates'

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/data/recipes/fast-acquire.json',
)

interface FastAcquireEntry {
  name: string
  itemId: number
  reason: string
}

function main(): void {
  const existing: Record<string, FastAcquireEntry> = existsSync(OUT)
    ? (JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, FastAcquireEntry>)
    : {}

  const candidates = collectGateCandidates()
  const byCanon = new Map(candidates.map((c) => [c.canon, c]))

  const next: Record<string, FastAcquireEntry> = {}
  let added = 0
  const pruned: string[] = []

  for (const c of candidates) {
    if (c.gated) {
      if (existing[c.canon]) pruned.push(`${c.name} (now in TIME_GATED)`)
      continue
    }
    if (existing[c.canon]) {
      next[c.canon] = existing[c.canon]
    } else {
      next[c.canon] = { name: c.name, itemId: c.itemId, reason: 'UNCLASSIFIED — review' }
      added++
      console.log(`  + ${c.name} (id ${c.itemId}, max ${c.maxRequired} across ${c.pieces} piece(s))`)
    }
  }
  for (const [canon, e] of Object.entries(existing)) {
    if (!byCanon.has(canon) && !(canon in next)) pruned.push(`${e.name} (no longer a candidate)`)
  }

  const ordered = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(OUT, JSON.stringify(ordered, null, 1) + '\n')

  const unclassified = Object.values(ordered).filter((e) => e.reason.includes('UNCLASSIFIED'))
  console.log(
    `\n✅ ${Object.keys(ordered).length} allowlist entries → ${OUT}` +
      ` (${added} added, ${pruned.length} pruned, ${candidates.filter((c) => c.gated).length} candidates gated)`,
  )
  for (const p of pruned) console.log(`  - ${p}`)
  if (unclassified.length > 0) {
    console.log(`\n⚠️  ${unclassified.length} UNCLASSIFIED entr(ies) need a hand-written reason:`)
    for (const e of unclassified) console.log(`   • ${e.name}`)
  }
}

main()
