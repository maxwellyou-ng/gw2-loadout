import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatRelative } from '../lib/format'
import UndoToast from './UndoToast'

// One tab per recurring question (docs/REDESIGN.md §2): what do I do now ·
// what am I working toward · what do I farm/buy · is my account connected.
const tabs = [
  { to: '/today', label: 'Today' },
  { to: '/goals', label: 'Goals' },
  { to: '/materials', label: 'Materials' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { sync, syncing, syncMessage, syncError, runSync, settings, storageFailing } = useApp()
  const warnings = sync?.warnings ?? []

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4">
      {/* Skip link: focus the main region directly — a plain #main href would
          be swallowed by HashRouter as a route change. */}
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only fixed left-3 top-3 z-50 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-canvas focus:not-sr-only"
      >
        Skip to content
      </a>
      {/* Sync progress for screen readers; visually the header/Settings show it. */}
      <p aria-live="polite" className="sr-only">
        {syncing ? syncMessage || 'Syncing…' : syncError ? `Sync failed: ${syncError}` : ''}
      </p>
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-ink">
            GW2 Legendary Loadout Tracker
          </h1>
          <p className="text-xs text-muted">
            Last synced: {formatRelative(sync?.meta.lastSynced ?? null)}
            {warnings.length > 0 && (
              <span
                className="ml-1.5 cursor-help text-warn"
                title={`Last sync was partial — some numbers may be stale or missing:\n• ${warnings.join('\n• ')}`}
              >
                ⚠ {warnings.length} sync warning{warnings.length === 1 ? '' : 's'}
              </span>
            )}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <nav className="flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-0.5">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={runSync}
            disabled={syncing || !settings.apiKey}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 py-6 outline-none">
        {storageFailing && (
          <div className="mb-4 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            Your changes aren't being saved — this browser's storage is full or blocked. Free up
            space (or allow site data) and reload, or your edits will be lost when you leave.
          </div>
        )}
        <Outlet />
      </main>

      <UndoToast />

      <footer className="border-t border-line py-3 text-center text-xs text-muted">
        Read-only · API key stays in your browser · recipes wiki-verified (92/94) and
        drift-gated against the GW2 Wiki
      </footer>
    </div>
  )
}
