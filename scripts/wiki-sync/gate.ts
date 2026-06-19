// ---------------------------------------------------------------------------
// Gate classification: split findings into blocking / acknowledged / advisory
// using baseline.json. This is the anti-deviation core — error-severity findings
// that are NOT acknowledged in the baseline block the build, so only NEW drift
// fails while the accepted current state (recorded, reviewable in git) passes.
// ---------------------------------------------------------------------------

import { findingKey, type Baseline, type Finding } from './types'

export interface Classified {
  /** Error-severity findings not acknowledged in the baseline — these fail the gate. */
  blocking: Finding[]
  /** Error-severity findings the baseline accepts (known gaps/simplifications). */
  acknowledged: Finding[]
  /** warn-severity findings (advisory, never block). */
  warnings: Finding[]
  /** info-severity findings (e.g. low-confidence; never block). */
  infos: Finding[]
  /** Baseline keys that no longer correspond to any finding (stale; safe to prune). */
  staleAcknowledgements: string[]
}

function isAcknowledged(f: Finding, baseline: Baseline): boolean {
  if (f.type === 'MISSING_ITEM') {
    return baseline.acknowledgedMissing.some((n) => n.toLowerCase() === f.item.toLowerCase())
  }
  return baseline.acknowledgedFindings.includes(findingKey(f))
}

export function classify(findings: Finding[], baseline: Baseline): Classified {
  const blocking: Finding[] = []
  const acknowledged: Finding[] = []
  const warnings: Finding[] = []
  const infos: Finding[] = []

  const seenAck = new Set<string>()

  for (const f of findings) {
    if (f.severity === 'warn') {
      warnings.push(f)
      continue
    }
    if (f.severity === 'info') {
      infos.push(f)
      continue
    }
    // error severity
    if (isAcknowledged(f, baseline)) {
      acknowledged.push(f)
      if (f.type === 'MISSING_ITEM') seenAck.add(`missing:${f.item.toLowerCase()}`)
      else seenAck.add(`finding:${findingKey(f)}`)
    } else {
      blocking.push(f)
    }
  }

  const staleAcknowledgements: string[] = []
  for (const n of baseline.acknowledgedMissing) {
    if (!seenAck.has(`missing:${n.toLowerCase()}`)) staleAcknowledgements.push(`missing: ${n}`)
  }
  for (const k of baseline.acknowledgedFindings) {
    if (!seenAck.has(`finding:${k}`)) staleAcknowledgements.push(`finding: ${k}`)
  }

  return { blocking, acknowledged, warnings, infos, staleAcknowledgements }
}

/** Build a baseline that accepts the current error-severity findings. */
export function baselineFromFindings(findings: Finding[], note?: string): Baseline {
  const acknowledgedMissing: string[] = []
  const acknowledgedFindings: string[] = []
  for (const f of findings) {
    if (f.severity !== 'error') continue
    if (f.type === 'MISSING_ITEM') acknowledgedMissing.push(f.item)
    else acknowledgedFindings.push(findingKey(f))
  }
  return {
    acknowledgedMissing: [...new Set(acknowledgedMissing)].sort(),
    acknowledgedFindings: [...new Set(acknowledgedFindings)].sort(),
    note: note ?? 'Accepted current state. Remove entries as the catalog is brought in line with the wiki; any NEW unacknowledged error fails npm run wiki:check.',
  }
}
