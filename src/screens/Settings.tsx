import { useState } from 'react'
import { useApp } from '../state/store'
import { validateKey } from '../api/gw2'
import { Card, Badge } from '../components/ui'
import { formatRelative } from '../lib/format'
import { DEFAULT_WEIGHTS } from '../types'

const REQUIRED_SCOPES = ['account', 'inventories', 'wallet', 'unlocks', 'characters', 'progression']

export default function Settings() {
  const { settings, setApiKey, setWeights, runSync, syncing, syncMessage, syncError, sync } =
    useApp()
  const [keyInput, setKeyInput] = useState(settings.apiKey)
  const [validation, setValidation] = useState<
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'ok'; name: string; permissions: string[] }
    | { state: 'error'; message: string }
  >({ state: 'idle' })

  const saveKey = () => {
    setApiKey(keyInput.trim())
  }

  const check = async () => {
    setValidation({ state: 'checking' })
    try {
      const info = await validateKey(keyInput.trim())
      setApiKey(keyInput.trim())
      setValidation({ state: 'ok', name: info.name, permissions: info.permissions })
    } catch {
      setValidation({ state: 'error', message: 'Key invalid or unreachable.' })
    }
  }

  const w = settings.weights

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-ink">GW2 API key</h2>
        <p className="mb-3 text-sm text-muted">
          Create a read-only key at{' '}
          <a
            className="text-accent underline"
            href="https://account.arena.net/applications"
            target="_blank"
            rel="noreferrer"
          >
            account.arena.net/applications
          </a>{' '}
          with scopes: {REQUIRED_SCOPES.map((s) => <Badge key={s}>{s}</Badge>)}. It's stored only in
          this browser's localStorage and never sent anywhere but the official GW2 API.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="XXXXXXXX-XXXX-…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent"
          />
          <button
            onClick={check}
            disabled={!keyInput.trim() || validation.state === 'checking'}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-accent disabled:opacity-40"
          >
            {validation.state === 'checking' ? 'Checking…' : 'Validate'}
          </button>
          <button
            onClick={saveKey}
            disabled={!keyInput.trim()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-canvas disabled:opacity-40"
          >
            Save
          </button>
        </div>

        {validation.state === 'ok' && (
          <p className="mt-3 text-sm text-good">
            ✓ {validation.name} — scopes: {validation.permissions.join(', ')}
            {REQUIRED_SCOPES.filter((s) => !validation.permissions.includes(s)).length > 0 && (
              <span className="text-warn">
                {' '}
                (missing:{' '}
                {REQUIRED_SCOPES.filter((s) => !validation.permissions.includes(s)).join(', ')})
              </span>
            )}
          </p>
        )}
        {validation.state === 'error' && (
          <p className="mt-3 text-sm text-bad">{validation.message}</p>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Sync</h2>
            <p className="text-sm text-muted">
              Last synced {formatRelative(sync?.meta.lastSynced ?? null)}
              {sync && ` · ${sync.meta.characters.length} characters`}
            </p>
          </div>
          <button
            onClick={runSync}
            disabled={syncing || !settings.apiKey}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas disabled:opacity-40"
          >
            {syncing ? 'Syncing…' : 'Sync account'}
          </button>
        </div>
        {syncing && syncMessage && <p className="mt-3 text-sm text-muted">{syncMessage}</p>}
        {syncError && <p className="mt-3 text-sm text-bad">{syncError}</p>}
        {sync && sync.warnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
            <p className="font-medium">Some endpoints didn't return data:</p>
            <ul className="mt-1 list-inside list-disc">
              {sync.warnings.map((wn) => (
                <li key={wn}>{wn}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold text-ink">Completion-score weights</h2>
        <p className="mb-4 text-sm text-muted">
          Time is weighted highest by default so slow, daily-capped materials count for more than
          cheap bulk. (time ≫ gold ≫ quantity)
        </p>
        {(['time', 'gold', 'qty'] as const).map((k) => (
          <label key={k} className="mb-3 block">
            <span className="flex justify-between text-sm text-ink">
              <span className="capitalize">{k === 'qty' ? 'quantity' : k}</span>
              <span className="font-mono text-muted">{w[k].toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={w[k]}
              onChange={(e) => setWeights({ ...w, [k]: Number(e.target.value) })}
              className="w-full accent-accent"
            />
          </label>
        ))}
        <button
          onClick={() => setWeights(DEFAULT_WEIGHTS)}
          className="text-sm text-accent underline"
        >
          Reset to defaults
        </button>
      </Card>
    </div>
  )
}
