// ---------------------------------------------------------------------------
// Snapshot history (brief 6.9): chart loadout momentum across syncs.
//
// The store logs one HistoryEntry per new sync timestamp (overall completion +
// per-piece scores). Here we plot overall completion over time and show a
// per-piece momentum table (latest score and Δ since the previous sync).
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, CATALOG_BY_ID, type HistoryEntry } from '../state/store'
import { plannedSlots } from '../engine'
import { Card, ScorePill, EmptyState, OverlayLink } from '../components/ui'
import { formatDate, formatPercent } from '../lib/format'
import { STORAGE_KEYS, loadJSON } from '../state/storage'

function LineChart({ entries }: { entries: HistoryEntry[] }) {
  const W = 640
  const H = 180
  const pad = { top: 16, right: 16, bottom: 28, left: 36 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const n = entries.length
  const x = (i: number) => pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => pad.top + (1 - Math.max(0, Math.min(1, v))) * innerH
  const points = entries.map((e, i) => `${x(i)},${y(e.overall)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Loadout completion over time">
      <title>Overall loadout completion across syncs</title>
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad.left} y1={y(g)} x2={W - pad.right} y2={y(g)} className="stroke-line" strokeWidth={1} />
          <text x={pad.left - 6} y={y(g) + 4} textAnchor="end" className="fill-muted" fontSize={10}>
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}
      <polyline fill="none" points={points} className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />
      {entries.map((e, i) => (
        <circle key={e.ts} cx={x(i)} cy={y(e.overall)} r={3} className="fill-accent" />
      ))}
      <text x={pad.left} y={H - 8} textAnchor="start" className="fill-muted" fontSize={10}>
        {formatDate(entries[0].ts)}
      </text>
      {n > 1 && (
        <text x={W - pad.right} y={H - 8} textAnchor="end" className="fill-muted" fontSize={10}>
          {formatDate(entries[n - 1].ts)}
        </text>
      )}
    </svg>
  )
}

export default function History() {
  const { loadout, progressByPiece } = useApp()
  const [history] = useState<HistoryEntry[]>(() =>
    loadJSON<HistoryEntry[]>(STORAGE_KEYS.history, []),
  )

  const momentum = useMemo(() => {
    const latest = history.at(-1)
    const prev = history.at(-2)
    if (!latest) return []
    return plannedSlots(loadout)
      .map((slot) => {
        const id = slot.chosenPieceId!
        const piece = CATALOG_BY_ID[id]
        const cur = latest.byPiece[id] ?? progressByPiece[id]?.completionScore ?? 0
        const before = prev?.byPiece[id]
        const delta = before == null ? 0 : cur - before
        return { id, name: piece?.name ?? `#${id}`, label: slot.label, cur, delta }
      })
      .sort((a, b) => b.delta - a.delta || b.cur - a.cur)
  }, [history, loadout, progressByPiece])

  if (history.length < 2) {
    return (
      <EmptyState title="Not enough history yet">
        Sync your account a few times (from{' '}
        <Link to="/settings" className="text-accent underline">
          Settings
        </Link>
        ) — each sync is logged so you can watch momentum build here.
      </EmptyState>
    )
  }

  const latest = history.at(-1)!
  const prevOverall = history.at(-2)?.overall ?? latest.overall
  const overallDelta = latest.overall - prevOverall

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Momentum</h2>
        <p className="text-sm text-muted">
          {history.length} syncs logged · overall completion {formatPercent(latest.overall)}
          {overallDelta !== 0 && (
            <span className={overallDelta > 0 ? 'text-good' : 'text-bad'}>
              {' '}
              ({overallDelta > 0 ? '+' : ''}
              {formatPercent(overallDelta)} since last sync)
            </span>
          )}
        </p>
      </div>

      <Card>
        <LineChart entries={history} />
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-ink">Per-piece momentum (Δ since last sync)</h3>
        <div>
          {momentum.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0"
            >
              <OverlayLink to={`/piece/${m.id}`} className="min-w-0 truncate text-sm text-ink hover:text-accent">
                {m.name}
              </OverlayLink>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                <span
                  className={`w-16 text-right font-mono text-xs ${
                    m.delta > 0 ? 'text-good' : m.delta < 0 ? 'text-bad' : 'text-muted'
                  }`}
                >
                  {m.delta > 0 ? '+' : ''}
                  {m.delta === 0 ? '—' : formatPercent(m.delta)}
                </span>
                <ScorePill value={m.cur} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
