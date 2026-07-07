// Overall-completion line chart across syncs. Extracted from the History
// screen so the Goals trophy shelf can render momentum next to completions.

import type { HistoryEntry } from '../state/store'
import { formatDate } from '../lib/format'

export default function MomentumChart({ entries }: { entries: HistoryEntry[] }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Plan completion over time">
      <title>Overall plan completion across syncs</title>
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
