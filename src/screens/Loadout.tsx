import { Link } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { Card, ProgressBar, ScorePill, Badge } from '../components/ui'
import { formatDate } from '../lib/format'
import type { SlotFamily } from '../types'
import type { LoadoutSlot } from '../data/loadout'

const FAMILY_ORDER: { family: SlotFamily; title: string }[] = [
  { family: 'weapon', title: 'Weapons' },
  { family: 'armor', title: 'Armor' },
  { family: 'trinket', title: 'Trinkets' },
  { family: 'back', title: 'Back' },
  { family: 'misc', title: 'Relic / Runes / Aquabreather' },
]

function SlotCard({ slot }: { slot: LoadoutSlot }) {
  const { progressByPiece } = useApp()
  const piece = slot.chosenPieceId != null ? CATALOG_BY_ID[slot.chosenPieceId] : undefined
  const progress = piece ? progressByPiece[piece.id] : undefined

  if (!piece) {
    return (
      <Card className="opacity-70">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted">{slot.label}</span>
          <Badge tone={slot.status === 'flexible' ? 'accent' : 'neutral'}>{slot.status}</Badge>
        </div>
        <p className="mt-3 text-sm text-muted">Undecided — pick a piece to track.</p>
      </Card>
    )
  }

  const inner = (
    <Card className="transition-colors hover:border-accent/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{slot.label}</p>
          <p className="truncate font-semibold text-ink">{piece.name}</p>
          <p className="truncate text-xs text-muted">{piece.type}</p>
        </div>
        <ScorePill value={progress?.completionScore ?? 0} done={progress?.owned} />
      </div>

      <div className="mt-3">
        <ProgressBar value={progress?.owned ? 1 : progress?.completionScore ?? 0} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone={slot.status === 'must-have' ? 'accent' : 'neutral'}>{slot.status}</Badge>
        {!slot.tracked && <Badge>untracked</Badge>}
        {slot.priority === 'defer' && <Badge tone="warn">defer</Badge>}
        {progress && !progress.owned && progress.earliestFinishDate && (
          <span>· earliest finish {formatDate(progress.earliestFinishDate)}</span>
        )}
        {progress?.finishableByGold && <Badge tone="good">finish for gold</Badge>}
        {!piece.recipe.verified && <Badge tone="warn">unverified</Badge>}
      </div>
    </Card>
  )

  return (
    <Link to={`/piece/${piece.id}`} className="block">
      {inner}
    </Link>
  )
}

export default function Loadout() {
  const { loadout, sync, progressByPiece } = useApp()

  const tracked = loadout.slots.filter((s) => s.tracked && s.chosenPieceId != null)
  const doneCount = tracked.filter(
    (s) => progressByPiece[s.chosenPieceId!]?.owned,
  ).length

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{loadout.name}</h2>
          <p className="text-sm text-muted">
            {doneCount}/{tracked.length} tracked pieces unlocked
            {!sync && ' · sync your account to populate progress'}
          </p>
        </div>
      </div>

      {FAMILY_ORDER.map(({ family, title }) => {
        const slots = loadout.slots.filter((s) => s.family === family)
        if (slots.length === 0) return null
        return (
          <section key={family}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {title}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => (
                <SlotCard key={slot.key} slot={slot} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
