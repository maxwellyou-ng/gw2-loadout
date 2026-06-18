// Display formatting helpers.

/** Copper -> "12g 34s 56c" (GW2 coin: 1g = 100s = 10000c). */
export function formatGold(copper: number): string {
  const c = Math.max(0, Math.round(copper))
  const g = Math.floor(c / 10000)
  const s = Math.floor((c % 10000) / 100)
  const cu = c % 100
  const parts: string[] = []
  if (g) parts.push(`${g.toLocaleString()}g`)
  if (s || g) parts.push(`${s}s`)
  parts.push(`${cu}c`)
  return parts.join(' ')
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return formatDate(iso)
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  return Math.max(0, Math.ceil((target - Date.now()) / 86400000))
}
