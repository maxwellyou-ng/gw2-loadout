// Single-level undo toast for destructive loadout mutations (remove, reorder,
// import). Renders globally from Layout; auto-dismisses after a few seconds.

import { useEffect } from 'react'
import { useApp } from '../state/store'

const UNDO_TIMEOUT_MS = 6000

export default function UndoToast() {
  const { undo, performUndo, dismissUndo } = useApp()

  // Timer keys off the capture object's identity: a new destructive action
  // replaces the entry and restarts the countdown.
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(dismissUndo, UNDO_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [undo, dismissUndo])

  if (!undo) return null

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-2.5 shadow-lg"
    >
      <span className="min-w-0 truncate text-sm text-ink">{undo.label}</span>
      <button
        type="button"
        onClick={performUndo}
        className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-canvas"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={dismissUndo}
        aria-label="Dismiss"
        className="shrink-0 rounded px-1 text-muted hover:text-ink"
      >
        ✕
      </button>
    </div>
  )
}
