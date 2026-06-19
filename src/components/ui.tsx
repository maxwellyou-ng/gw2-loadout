// Small shared presentational components.

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { TimeGateSeverity } from '../types'
import { formatPercent, wikiUrl } from '../lib/format'

/**
 * An "ⓘ" info dot with a custom tooltip that works on every device:
 *  - mouse: opens on hover, closes on leave,
 *  - touch/pen: tap toggles (we suppress the synthesized focus/click so it
 *    doesn't immediately re-close), tap elsewhere dismisses,
 *  - keyboard: opens on focus, closes on blur.
 * No native `title`, so there's no hover delay and it shows on touch.
 */
export function InfoTooltip({ label }: { label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Tap-outside (or any outside pointer press) dismisses an open tooltip.
  useEffect(() => {
    if (!open) return
    const onAway = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onAway)
    return () => document.removeEventListener('pointerdown', onAway)
  }, [open])

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault() // stop the synthesized focus + click that would fight the toggle
      setOpen((v) => !v)
    }
  }
  const onHover = (e: ReactPointerEvent<HTMLButtonElement>, next: boolean) => {
    if (e.pointerType === 'mouse') setOpen(next)
  }

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerEnter={(e) => onHover(e, true)}
        onPointerLeave={(e) => onHover(e, false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line text-[9px] font-semibold leading-none text-muted transition-colors hover:border-accent hover:text-accent"
      >
        i
      </button>
      <span
        role="tooltip"
        aria-hidden={!open}
        className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-normal normal-case text-ink shadow-lg transition-opacity duration-100 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {label}
      </span>
    </span>
  )
}

/**
 * A material/ingredient name that links to its GW2 wiki page when one exists.
 * Synthetic intermediates (no resolved item id) render as plain text.
 */
export function WikiName({
  name,
  itemId,
  className = '',
}: {
  name: string
  itemId: number
  className?: string
}) {
  const url = wikiUrl(name, itemId)
  if (!url) return <span className={className}>{name}</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`${className} underline decoration-dotted underline-offset-2 hover:text-accent`}
      title={`${name} — open GW2 wiki`}
    >
      {name}
    </a>
  )
}

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

/** Circular completion ring. `value` is 0..1. */
export function Ring({
  value,
  size = 132,
  stroke = 12,
  label,
  sublabel,
}: {
  value: number
  size?: number
  stroke?: number
  label?: ReactNode
  sublabel?: ReactNode
}) {
  const pct = Math.max(0, Math.min(1, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color =
    pct >= 0.999 ? 'text-good' : pct >= 0.66 ? 'text-accent' : pct >= 0.33 ? 'text-warn' : 'text-bad'
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${formatPercent(pct)} complete`}>
        <title>{formatPercent(pct)} complete</title>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`${color} transition-all`}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label != null && <span className="text-2xl font-semibold text-ink">{label}</span>}
        {sublabel != null && <span className="text-xs text-muted">{sublabel}</span>}
      </div>
    </div>
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
