import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { Card } from './ui'

const steps = (hasKey: boolean) => [
  {
    n: 1,
    title: 'Pick your targets',
    body: (
      <>
        On the{' '}
        <Link to="/loadout" className="text-accent underline">
          Loadout
        </Link>{' '}
        tab, choose the legendaries you want to work toward — as many or as few as you like. Every
        tracked piece feeds the combined plan.
      </>
    ),
    done: false,
  },
  {
    n: 2,
    title: 'Connect your account (optional)',
    body: (
      <>
        Add a read-only API key in{' '}
        <Link to="/settings" className="text-accent underline">
          Settings
        </Link>{' '}
        and sync to credit what you already own. The app works without a key — you just won't see
        owned counts or live prices.
      </>
    ),
    done: hasKey,
  },
  {
    n: 3,
    title: 'See what to save',
    body: (
      <>
        The{' '}
        <Link to="/materials" className="text-accent underline">
          Materials
        </Link>{' '}
        tab is your combined shopping list, and the Dashboard tells you which daily-capped
        materials to collect today so the finish date doesn't slip.
      </>
    ),
    done: false,
  },
]

/** First-run guide: shown wherever a screen would otherwise be empty because
 *  no pieces are chosen yet. */
export default function Onboarding({ title = 'Plan your legendaries' }: { title?: string }) {
  const { settings } = useApp()
  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        Three steps from empty to a clear savings plan:
      </p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps(!!settings.apiKey).map((s) => (
          <li key={s.n} className="rounded-lg border border-line bg-surface-2/50 p-3">
            <p className="text-sm font-semibold text-ink">
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-xs text-accent">
                {s.done ? '✓' : s.n}
              </span>
              {s.title}
            </p>
            <p className="mt-1.5 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}
