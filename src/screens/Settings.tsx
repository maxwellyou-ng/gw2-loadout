import { useState } from 'react'
import { useApp } from '../state/store'
import { validateKey } from '../api/gw2'
import { Card, Badge } from '../components/ui'
import { formatRelative } from '../lib/format'
import { encodePlan, decodePlan } from '../lib/buildcode'

// Ordered as they appear on the GW2 account site (account.arena.net/applications),
// each paired with ArenaNet's own description of the scope.
const REQUIRED_SCOPES_INFO: { scope: string; description: string }[] = [
  {
    scope: 'account',
    description:
      'Your account display name, ID, home world, and list of guilds. Required permission.',
  },
  {
    scope: 'inventories',
    description:
      'Your account bank, material storage, recipe unlocks, and character inventories.',
  },
  { scope: 'characters', description: 'Basic information about your characters.' },
  { scope: 'wallet', description: "Your account's wallet." },
  {
    scope: 'unlocks',
    description:
      'Your wardrobe unlocks—skins, dyes, minipets, finishers, etc.—and currently equipped skins.',
  },
  {
    scope: 'progression',
    description:
      'Your achievements, dungeon unlock status, mastery point assignments, and general PvE progress.',
  },
]

const REQUIRED_SCOPES = REQUIRED_SCOPES_INFO.map((s) => s.scope)

export default function Settings() {
  const {
    settings,
    setApiKey,
    forgetAccount,
    runSync,
    syncing,
    syncMessage,
    syncError,
    sync,
    plan,
    importPlan,
  } = useApp()
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

  const forget = () => {
    if (
      confirm(
        'Remove your API key and all synced account data from this browser? Your loadout goals are kept.',
      )
    ) {
      forgetAccount()
      setKeyInput('')
      setValidation({ state: 'idle' })
    }
  }

  const check = async () => {
    setValidation({ state: 'checking' })
    try {
      const info = await validateKey(keyInput.trim())
      setApiKey(keyInput.trim())
      setValidation({ state: 'ok', name: info.name, permissions: info.permissions })
    } catch (e) {
      let message = 'Key invalid or unreachable.'
      if (e && typeof e === 'object' && 'status' in e) {
        const status = (e as { status: number }).status
        if (status === 401)
          message = 'Key rejected (401) — check you pasted the full key with no extra spaces.'
        else if (status === 403)
          message = 'Key forbidden (403) — it may be missing required permissions.'
        else message = `GW2 API returned ${status}.`
      } else if (e instanceof TypeError) {
        message =
          'Could not reach the GW2 API — check your connection, VPN, or an ad/script blocker that may be blocking api.guildwars2.com.'
      }
      setValidation({ state: 'error', message })
    }
  }

  // --- Build-code import / export — goals only, never the key ---------------
  const exportCode = encodePlan(plan)
  const [importInput, setImportInput] = useState('')
  const [importMsg, setImportMsg] = useState<
    { state: 'idle' } | { state: 'ok' } | { state: 'error'; message: string }
  >({ state: 'idle' })
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exportCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the textarea is selectable as a fallback */
    }
  }

  const applyImport = () => {
    try {
      const next = decodePlan(importInput)
      importPlan(next)
      setImportInput('')
      setImportMsg({ state: 'ok' })
    } catch (e) {
      setImportMsg({ state: 'error', message: e instanceof Error ? e.message : 'Invalid code.' })
    }
  }

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
          with the permissions below. It's stored only in this browser's localStorage and never sent
          anywhere but the official GW2 API.
        </p>
        <details className="group mb-3 text-sm text-muted">
          <summary className="flex cursor-pointer select-none flex-wrap items-center gap-1.5 text-ink marker:content-none">
            <span className="text-xs text-muted transition-transform group-open:rotate-90">▶</span>
            Required permissions
            <span className="flex flex-wrap gap-1">
              {REQUIRED_SCOPES.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </span>
          </summary>
          <ul className="mt-2 space-y-2 pl-4">
            {REQUIRED_SCOPES_INFO.map(({ scope, description }) => (
              <li key={scope} className="flex flex-wrap items-baseline gap-2">
                <Badge>{scope}</Badge>
                <span>{description}</span>
              </li>
            ))}
          </ul>
        </details>
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
          {settings.apiKey && (
            <button
              onClick={forget}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-bad hover:text-bad"
            >
              Forget key & data
            </button>
          )}
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
        <h2 className="mb-1 text-lg font-semibold text-ink">Share your plan</h2>
        <p className="mb-4 text-sm text-muted">
          A build code captures only your goals (pieces, order, states, candidates) — never your
          API key or account data. Old slot-based codes import fine. Share it or save it as a
          backup.
        </p>

        <label className="mb-1 block text-sm font-medium text-ink">Export</label>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            readOnly
            value={exportCode}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink outline-none"
          />
          <button
            onClick={copyCode}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-accent"
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>

        <label className="mb-1 mt-4 block text-sm font-medium text-ink">Import</label>
        <p className="mb-2 text-xs text-warn">
          Importing replaces your current plan — an Undo toast lets you take it back.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={importInput}
            onChange={(e) => {
              setImportInput(e.target.value)
              setImportMsg({ state: 'idle' })
            }}
            placeholder="Paste a gw2-v1.… build code"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
          />
          <button
            onClick={applyImport}
            disabled={!importInput.trim()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-canvas disabled:opacity-40"
          >
            Import
          </button>
        </div>
        {importMsg.state === 'ok' && (
          <p className="mt-2 text-sm text-good">✓ Plan replaced from build code.</p>
        )}
        {importMsg.state === 'error' && (
          <p className="mt-2 text-sm text-bad">{importMsg.message}</p>
        )}
      </Card>
    </div>
  )
}
