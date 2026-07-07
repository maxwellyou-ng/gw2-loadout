// Returning-user re-orientation (docs/UX-BEST-PRACTICES.md, violation #13):
// after ≥3 days away, one card answers "what changed and what matters now"
// from data the app already logs — plan completions, history deltas, and the
// current binding bottleneck. Dismissible; renders at most once per visit.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { TimeGateDebt } from '../../types'
import type { Plan } from '../../state/plan'
import { CATALOG_BY_ID, type HistoryEntry } from '../../state/store'
import { STORAGE_KEYS, loadJSON } from '../../state/storage'
import { Card } from '../ui'
import { formatPercent } from '../../lib/format'

export default function WelcomeBack({
  previousVisit,
  plan,
  bottleneck,
  hasApiKey,
  syncing,
  onSync,
}: {
  previousVisit: string | null
  plan: Plan
  bottleneck: TimeGateDebt | undefined
  hasApiKey: boolean
  syncing: boolean
  onSync: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  // Captured once per mount: "how long was I away" shouldn't tick mid-visit.
  const [now] = useState(() => Date.now())
  if (dismissed || !previousVisit) return null

  const daysAway = Math.floor((now - new Date(previousVisit).getTime()) / 86_400_000)
  if (daysAway < 3) return null

  const sinceISO = previousVisit.slice(0, 10)
  const completedWhileAway = plan.goals.filter(
    (g) => g.state === 'done' && g.completedAt && g.completedAt >= sinceISO,
  )

  // Overall trend across the absence, when history brackets it.
  const hist = loadJSON<HistoryEntry[]>(STORAGE_KEYS.history, [])
  const baseline = [...hist].reverse().find((h) => h.ts <= previousVisit)
  const latest = hist.at(-1)
  const delta =
    baseline && latest && latest.ts > baseline.ts ? latest.overall - baseline.overall : null

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-gate/40 bg-gate/5">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-ink">
          Welcome back — {daysAway} days away.
          {completedWhileAway.length > 0 &&
            ` ${completedWhileAway
              .map((g) => (g.pieceId != null ? CATALOG_BY_ID[g.pieceId]?.name : ''))
              .filter(Boolean)
              .join(', ')} completed 🎉`}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {delta != null && `Overall ${delta >= 0 ? '+' : ''}${formatPercent(Math.abs(delta))} since your last visit · `}
          {bottleneck
            ? `your binding bottleneck is ${bottleneck.name} (${bottleneck.days}d)`
            : 'no time gates outstanding'}
          {hasApiKey && ' · sync to refresh the numbers'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hasApiKey ? (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-canvas"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        ) : (
          <Link
            to="/settings"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:border-accent"
          >
            Connect account
          </Link>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded px-1.5 text-muted hover:text-ink"
        >
          ✕
        </button>
      </div>
    </Card>
  )
}
