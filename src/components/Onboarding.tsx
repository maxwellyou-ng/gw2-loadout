import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { Card } from './ui'

const steps = (hasKey: boolean) => [
  {
    n: 1,
    title: 'Pick your first goal',
    body: (
      <>
        Browse the{' '}
        <Link to="/catalog" className="text-accent underline">
          legendary catalog
        </Link>{' '}
        — filter by weapon type, generation, or game mode, and add whatever you want to work
        toward. Cost and time-to-finish show up right on the cards.
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
    title: 'Follow the plan',
    body: (
      <>
        Today tells you the single best thing to do right now,{' '}
        <Link to="/goals" className="text-accent underline">
          Goals
        </Link>{' '}
        is your priority ladder, and{' '}
        <Link to="/materials" className="text-accent underline">
          Materials
        </Link>{' '}
        is the combined shopping list.
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
