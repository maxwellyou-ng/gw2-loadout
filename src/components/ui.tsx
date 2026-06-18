// Small shared presentational components.

import type { ReactNode } from 'react'
import type { TimeGateSeverity } from '../types'
import { formatPercent } from '../lib/format'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const color =
    value >= 0.999 ? 'bg-good' : value >= 0.66 ? 'bg-accent' : value >= 0.33 ? 'bg-warn' : 'bg-bad'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ScorePill({ value, done }: { value: number; done?: boolean }) {
  if (done) {
    return (
      <span className="rounded-md bg-good/20 px-2 py-0.5 text-sm font-semibold text-good">
        Done
      </span>
    )
  }
  return (
    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent">
      {formatPercent(value)}
    </span>
  )
}

const SEVERITY_COLORS: Record<TimeGateSeverity, string> = {
  low: 'bg-warn',
  medium: 'bg-gate',
  high: 'bg-bad',
}

export function SeverityDot({ severity }: { severity: TimeGateSeverity }) {
  return (
    <span
      title={`${severity} time-gate`}
      className={`inline-block h-2.5 w-2.5 rounded-full ${SEVERITY_COLORS[severity]}`}
    />
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'gate' | 'accent'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-2 text-muted',
    good: 'bg-good/15 text-good',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
    gate: 'bg-gate/15 text-gate',
    accent: 'bg-accent-soft text-accent',
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/50 p-8 text-center">
      <p className="text-lg font-medium text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}
