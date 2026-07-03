import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatRelative } from '../lib/format'

const tabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/loadout', label: 'Loadout' },
  { to: '/materials', label: 'Materials' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { sync, syncing, runSync, settings, storageFailing } = useApp()
  const warnings = sync?.warnings ?? []

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4">
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

      <main className="flex-1 py-6">
        {storageFailing && (
          <div className="mb-4 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            Your changes aren't being saved — this browser's storage is full or blocked. Free up
            space (or allow site data) and reload, or your edits will be lost when you leave.
          </div>
        )}
        <Outlet />
      </main>

      <footer className="border-t border-line py-3 text-center text-xs text-muted">
        Read-only · API key stays in your browser · recipe data is wiki-seeded and flagged for
        verification
      </footer>
    </div>
  )
}
