import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatRelative } from '../lib/format'

const tabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/loadout', label: 'Loadout' },
  { to: '/materials', label: 'Materials' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { sync, syncing, runSync, settings } = useApp()

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            GW2 Legendary Loadout Tracker
          </h1>
          <p className="text-xs text-muted">
            Last synced: {formatRelative(sync?.meta.lastSynced ?? null)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-lg border border-line bg-surface p-0.5">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      <main className="flex-1 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-line py-3 text-center text-xs text-muted">
        Read-only · API key stays in your browser · recipe data is wiki-seeded and flagged for
        verification
      </footer>
    </div>
  )
}
