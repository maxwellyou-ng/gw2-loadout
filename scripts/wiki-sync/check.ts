// ---------------------------------------------------------------------------
// `npm run wiki:check` — the CI gate. Pure, offline, deterministic. Exits
// non-zero when the catalog has drifted from the committed wiki snapshot in a
// way the baseline does not acknowledge. Wired into `npm run build` next to the
// existing engine `check`, so neither a bad recipe edit nor a refreshed snapshot
// can land without being reconciled.
//
//   npm run wiki:check                     # gate
//   npm run wiki:check -- --update-baseline # accept current state as baseline
// ---------------------------------------------------------------------------

import { reconcile } from './reconcile'
import { classify, baselineFromFindings } from './gate'
import { readBaseline, writeBaseline } from './store'
import { findingKey } from './types'

function main() {
  const update = process.argv.slice(2).includes('--update-baseline')
  const { findings, stats } = reconcile()

  if (update) {
    const baseline = baselineFromFindings(findings)
    writeBaseline(baseline)
    console.log(
      `Baseline updated: ${baseline.acknowledgedMissing.length} missing items + ` +
        `${baseline.acknowledgedFindings.length} findings acknowledged.`,
    )
    console.log('Review baseline.json in your diff and commit it. Future unacknowledged drift will fail this check.')
    return
  }

  const baseline = readBaseline()
  const c = classify(findings, baseline)

  console.log(
    `wiki:check — ${stats.wikiCount} wiki legendaries vs ${stats.catalogCount} catalog entries; ` +
      `${c.blocking.length} blocking, ${c.acknowledged.length} acknowledged, ${c.warnings.length} warnings.`,
  )

  if (c.staleAcknowledgements.length) {
    console.log(`  note: ${c.staleAcknowledgements.length} baseline entr(y/ies) are stale (resolved) — prune with --update-baseline.`)
  }

  if (c.blocking.length === 0) {
    console.log('WIKI CHECK PASSED ✅ — catalog matches the wiki snapshot (within the accepted baseline).')
    process.exit(0)
  }

  console.error('\nWIKI CHECK FAILED ❌ — unacknowledged drift from the wiki:\n')
  for (const f of c.blocking) {
    console.error(`  [${f.type}] ${f.item} — ${f.message}`)
    console.error(`      (baseline key: ${f.type === 'MISSING_ITEM' ? `missing item "${f.item}"` : findingKey(f)})`)
  }
  console.error('\nFix the catalog to match the wiki (npm run wiki:report for detail), or — if this')
  console.error('change is intentional — accept it with: npm run wiki:check -- --update-baseline')
  process.exit(1)
}

main()
