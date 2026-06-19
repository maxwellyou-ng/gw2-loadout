// Centered dialog overlay used for the item-detail / compare "background
// location" modal routes (see App.tsx). Keeps the page behind it visible but
// dimmed so the user stays oriented; dismiss via X, backdrop click, or Esc.

import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Modal({
  children,
  label = 'Details',
}: {
  children: ReactNode
  label?: string
}) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)

  const close = () => navigate(-1)

  // Esc to close, lock body scroll while open, and move focus into the dialog
  // (restoring it to the previously-focused element on close).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
    // close is stable for the lifetime of this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-canvas/70 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative my-8 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-line bg-canvas p-4 shadow-2xl outline-none sm:p-6"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          title="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-accent hover:text-ink"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
