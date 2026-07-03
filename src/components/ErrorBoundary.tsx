import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
  copied: boolean
}

/**
 * Last-resort render-crash net: a component error shows a recoverable fallback
 * instead of blanking the whole app. State lives in localStorage, so a reload
 * loses nothing.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  copy = () => {
    const e = this.state.error
    void navigator.clipboard
      ?.writeText(`${e?.name}: ${e?.message}\n${e?.stack ?? ''}`)
      .then(() => this.setState({ copied: true }))
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-xl border border-line bg-surface p-6">
          <h1 className="text-lg font-semibold text-ink">Something broke while rendering</h1>
          <p className="mt-2 text-sm text-muted">
            Your loadout, sync data, and settings are safe in this browser — reloading loses
            nothing. If this keeps happening, copy the error and open an issue.
          </p>
          <p className="mt-3 rounded-lg bg-surface-2 p-2 font-mono text-xs text-bad">
            {error.name}: {error.message}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-canvas"
            >
              Reload
            </button>
            <button
              onClick={this.copy}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:border-accent"
            >
              {this.state.copied ? 'Copied ✓' : 'Copy error'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
