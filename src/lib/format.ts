// Display formatting helpers.

import { isSynthetic } from '../data/items'

/**
 * GW2 wiki URL for a material/ingredient, or null when there's no page to link
 * (synthetic intermediates whose real item id isn't resolved). The wiki uses
 * deterministic title URLs (spaces → underscores, percent-encoded otherwise,
 * matching e.g. `Aurene%27s_Fang`). We strip a trailing parenthetical
 * disambiguator we add for display (e.g. " (achievement)", " (base)", " (helm)")
 * since it isn't part of the page title.
 */
export function wikiUrl(name: string, itemId: number): string | null {
  if (isSynthetic(itemId)) return null
  const title = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!title) return null
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(title).replace(/%20/g, '_')}`
}

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

/** Short date — month + day only (e.g. "Jul 5"), no year. */
export function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
