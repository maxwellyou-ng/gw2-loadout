import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { CATALOG } from '../data/recipes'
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

const MAX_WEAPONS = 8
const WEAPON_PIECES = CATALOG.filter((p) => p.slot === 'weapon')

/** Tracked / Flexible toggle pills (the two orthogonal slot states). */
function SlotToggles({ slot }: { slot: LoadoutSlot }) {
  const { setSlotTracked, setSlotFlexible } = useApp()
  const pill = (on: boolean) =>
    `rounded px-2 py-0.5 text-xs font-medium transition-colors ${
      on ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:text-ink'
    }`
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => setSlotTracked(slot.key, !slot.tracked)}
        className={pill(slot.tracked)}
        title={slot.tracked ? 'Counts in totals — click to hide' : 'Hidden from totals — click to track'}
      >
        {slot.tracked ? 'Tracked' : 'Hidden'}
      </button>
      <button
        type="button"
        onClick={() => setSlotFlexible(slot.key, !slot.flexible)}
        className={pill(slot.flexible)}
        title="Weighing candidates for this slot"
      >
        Flexible
      </button>
    </div>
  )
}

/** A chosen-piece card body (name links to detail; no full-card link so the
 *  toggle buttons stay clickable). `eyebrow` is omitted for weapons. */
function PieceBody({
  slot,
  eyebrow,
  onRemove,
}: {
  slot: LoadoutSlot
  eyebrow?: boolean
  onRemove?: () => void
}) {
  const { progressByPiece } = useApp()
  const piece = slot.chosenPieceId != null ? CATALOG_BY_ID[slot.chosenPieceId] : undefined
  const progress = piece ? progressByPiece[piece.id] : undefined

  // Stale localStorage can hold a piece id no longer in the catalog — degrade
  // to a removable "unknown" card instead of crashing.
  if (!piece) {
    return (
      <Card className="flex h-full flex-col border-dashed">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-muted">{slot.label}</span>
          {onRemove && (
            <button type="button" onClick={onRemove} title="Remove" className="rounded px-1.5 text-muted hover:text-bad">
              ✕
            </button>
          )}
        </div>
        <p className="mt-2 flex-1 text-xs text-muted">Unknown piece (data updated). Remove and re-pick.</p>
        <div className="mt-3"><SlotToggles slot={slot} /></div>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {eyebrow && <p className="truncate text-xs text-muted">{slot.label}</p>}
          <Link to={`/piece/${piece.id}`} className="block truncate font-semibold text-ink hover:text-accent">
            {piece.name}
          </Link>
          <p className="truncate text-xs text-muted">{piece.type}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ScorePill value={progress?.completionScore ?? 0} done={progress?.owned} />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove from loadout"
              className="rounded px-1.5 text-muted hover:text-bad"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar value={progress?.owned ? 1 : progress?.completionScore ?? 0} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        {!slot.tracked && <Badge>untracked</Badge>}
        {slot.priority === 'defer' && <Badge tone="warn">defer</Badge>}
        {progress && !progress.owned && progress.earliestFinishDate && (
          <span>· earliest finish {formatDate(progress.earliestFinishDate)}</span>
        )}
        {progress?.finishableByGold && <Badge tone="good">finish for gold</Badge>}
        {piece && !piece.recipe.verified && <Badge tone="warn">unverified</Badge>}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SlotToggles slot={slot} />
        {slot.flexible && (
          <Link to={`/compare/${slot.key}`} className="text-xs text-accent underline">
            Compare →
          </Link>
        )}
      </div>
    </Card>
  )
}

/** Non-weapon slot: chosen piece, or a minimal blank placeholder. */
function SlotCard({ slot }: { slot: LoadoutSlot }) {
  const piece = slot.chosenPieceId != null ? CATALOG_BY_ID[slot.chosenPieceId] : undefined

  if (!piece) {
    return (
      <Card className="flex h-full flex-col border-dashed">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-muted">{slot.label}</span>
        </div>
        <p className="mt-2 flex-1 text-xs text-muted">
          {slot.flexible ? 'Weigh candidates to pick one.' : 'Empty.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <SlotToggles slot={slot} />
          {slot.flexible && (
            <Link to={`/compare/${slot.key}`} className="text-xs text-accent underline">
              Compare →
            </Link>
          )}
        </div>
      </Card>
    )
  }

  return <PieceBody slot={slot} eyebrow />
}

/** Weapons: compact, removable, up to 8; empty slots collapse. */
function WeaponsSection({ slots }: { slots: LoadoutSlot[] }) {
  const { setSlotPiece } = useApp()
  const [pick, setPick] = useState('')

  const filled = slots.filter((s) => s.chosenPieceId != null)
  const firstEmpty = slots.find((s) => s.chosenPieceId == null)

  const addWeapon = (pieceId: number) => {
    if (firstEmpty) setSlotPiece(firstEmpty.key, pieceId)
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filled.map((slot) => (
        <PieceBody key={slot.key} slot={slot} onRemove={() => setSlotPiece(slot.key, null)} />
      ))}

      {filled.length < MAX_WEAPONS && firstEmpty && (
        <Card className="flex h-full flex-col justify-center border-dashed">
          <label className="text-xs font-medium text-muted">Add weapon ({filled.length}/{MAX_WEAPONS})</label>
          <select
            value={pick}
            onChange={(e) => {
              const id = Number(e.target.value)
              if (id) addWeapon(id)
              setPick('')
            }}
            className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">+ Choose a weapon…</option>
            {WEAPON_PIECES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.type}
              </option>
            ))}
          </select>
        </Card>
      )}
    </div>
  )
}

export default function Loadout() {
  const { loadout, sync, progressByPiece } = useApp()

  const tracked = loadout.slots.filter((s) => s.tracked && s.chosenPieceId != null)
  const doneCount = tracked.filter((s) => progressByPiece[s.chosenPieceId!]?.owned).length

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
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
            {family === 'weapon' ? (
              <WeaponsSection slots={slots} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {slots.map((slot) => (
                  <SlotCard key={slot.key} slot={slot} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
