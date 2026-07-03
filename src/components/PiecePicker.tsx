import { useEffect, useMemo, useRef, useState } from 'react'
import type { LegendaryPiece } from '../types'
import { ItemIcon } from './ui'

/**
 * Searchable piece picker (combobox) — replaces the native <select> for slot
 * pickers, where a 55-item weapon list with no search was unusable. Type to
 * filter by name or type; ↑/↓ + Enter to pick, Escape to close.
 */
export default function PiecePicker({
  options,
  onPick,
  placeholder = 'Search legendaries…',
}: {
  options: LegendaryPiece[]
  onPick: (pieceId: number) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (p) => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q),
    )
  }, [options, query])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // Keep the active row visible while arrowing through the list.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (p: LegendaryPiece) => {
    onPick(p.id)
    setQuery('')
    setOpen(false)
    setActive(0)
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={placeholder}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open && filtered[active]) {
            e.preventDefault()
            pick(filtered[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-accent"
      />
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No matches for “{query}”.</li>
          )}
          {filtered.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === active ? 'bg-accent-soft text-accent' : 'text-ink'
                }`}
              >
                <ItemIcon itemId={p.id} name={p.name} size={22} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted">{p.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
