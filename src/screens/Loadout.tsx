import { useState } from 'react'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { Card, ProgressBar, ScorePill, Badge, InfoTooltip, OverlayLink } from '../components/ui'
import { formatDate, formatDateShort } from '../lib/format'
import { piecesForSlot } from '../lib/slotPieces'
import type { SlotFamily } from '../types'
import type { LoadoutSlot } from '../data/loadout'

/** Inline-editable loadout name: click the title (or its edit button) to rename.
 *  Enter / blur commits, Escape cancels. Empty names fall back to "My loadout". */
function LoadoutName({ name }: { name: string }) {
  const { setLoadoutName } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const commit = () => {
    setLoadoutName(draft.trim() || 'My loadout')
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(name)
            setEditing(false)
          }
        }}
        aria-label="Loadout name"
        className="min-w-0 rounded-lg border border-line bg-surface-2 px-2 py-1 text-lg font-semibold text-ink outline-none focus:border-accent"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      title="Rename loadout"
      className="group flex items-center gap-1.5 text-lg font-semibold text-ink hover:text-accent"
    >
      <span className="truncate">{name}</span>
      <span aria-hidden className="text-xs text-muted group-hover:text-accent">
        ✎
      </span>
    </button>
  )
}

/** Sections of the loadout grid. Trinkets and Back share a section so the grid
 *  is a tidy multiple of 2/3 (5 trinkets + 1 back = 6 cards). */
const SECTIONS: { families: SlotFamily[]; title: string }[] = [
  { families: ['weapon'], title: 'Weapons' },
  { families: ['armor'], title: 'Armor' },
  { families: ['trinket', 'back'], title: 'Trinkets and Back' },
  { families: ['misc'], title: 'Relic / Runes / Aquabreather' },
]

const MAX_WEAPONS = 8

/** Short "earliest finish" date (month + day) with an info dot whose tooltip
 *  spells out the full date. */
function EarliestFinish({ iso }: { iso: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{formatDateShort(iso)}</span>
      <InfoTooltip label={`If you hit every time gate, the absolute earliest you could finish is ${formatDate(iso)}`} />
    </span>
  )
}

/** A small on/off switch for the slot's tracked state. */
function TrackedToggle({ slot }: { slot: LoadoutSlot }) {
  const { setSlotTracked } = useApp()
  const on = slot.tracked
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Tracked: ${slot.label}`}
      onClick={() => setSlotTracked(slot.key, !on)}
      title={on ? 'Counts in totals — click to stop tracking' : 'Not counted — click to track'}
      className="flex items-center gap-2 text-xs font-medium"
    >
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          on ? 'bg-accent' : 'bg-surface-2'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-ink transition-transform ${
            on ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className={on ? 'text-ink' : 'text-muted'}>{on ? 'Tracked' : 'Untracked'}</span>
    </button>
  )
}

/** Static link to weigh candidates for this slot on the Compare screen. */
function CompareLink({ slot }: { slot: LoadoutSlot }) {
  return (
    <OverlayLink to={`/compare/${slot.key}`} className="text-xs font-medium text-accent hover:underline">
      Compare →
    </OverlayLink>
  )
}

/** The footer common to every card: tracked switch + compare link. */
function SlotControls({ slot }: { slot: LoadoutSlot }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <TrackedToggle slot={slot} />
      <CompareLink slot={slot} />
    </div>
  )
}

/** A chosen-piece card body (name links to detail; no full-card link so the
 *  controls stay clickable). `eyebrow` is omitted for weapons. */
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
        <SlotControls slot={slot} />
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {eyebrow && <p className="truncate text-xs text-muted">{slot.label}</p>}
          <OverlayLink to={`/piece/${piece.id}`} className="block truncate font-semibold text-ink hover:text-accent">
            {piece.name}
          </OverlayLink>
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
        {progress && !progress.owned && progress.earliestFinishDate && (
          <EarliestFinish iso={progress.earliestFinishDate} />
        )}
        {progress?.finishableByGold && <Badge tone="good">finish for gold</Badge>}
        {piece && !piece.recipe.verified && <Badge tone="warn">unverified</Badge>}
      </div>

      <SlotControls slot={slot} />
    </Card>
  )
}

/**
 * Non-weapon slot (armor / trinket / back). Mirrors the Weapons UX:
 *  - a chosen piece shows an X to clear the slot, and
 *  - an empty slot offers a dropdown of the pieces that fit this slot to track.
 * Every card also exposes a static Compare link to weigh candidates.
 */
function SlotCard({ slot }: { slot: LoadoutSlot }) {
  const { setSlotPiece } = useApp()
  const [pick, setPick] = useState('')
  const piece = slot.chosenPieceId != null ? CATALOG_BY_ID[slot.chosenPieceId] : undefined

  if (piece) {
    return <PieceBody slot={slot} eyebrow onRemove={() => setSlotPiece(slot.key, null)} />
  }

  const options = piecesForSlot(slot)

  return (
    <Card className="flex h-full flex-col border-dashed">
      <span className="truncate text-sm font-medium text-muted">{slot.label}</span>

      <div className="mt-2 flex-1">
        {options.length === 0 ? (
          <p className="text-xs text-muted">No catalog pieces for this slot yet.</p>
        ) : (
          <select
            value={pick}
            onChange={(e) => {
              const id = Number(e.target.value)
              if (id) setSlotPiece(slot.key, id)
              setPick('')
            }}
            className="w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">+ Choose a piece…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.type}
              </option>
            ))}
          </select>
        )}
      </div>

      <SlotControls slot={slot} />
    </Card>
  )
}

/** Weapons: compact, removable, up to 8; empty slots collapse. */
function WeaponsSection({ slots }: { slots: LoadoutSlot[] }) {
  const { setSlotPiece } = useApp()
  const [pick, setPick] = useState('')

  const filled = slots.filter((s) => s.chosenPieceId != null)
  const firstEmpty = slots.find((s) => s.chosenPieceId == null)
  const weaponOptions = firstEmpty ? piecesForSlot(firstEmpty) : []

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
            {weaponOptions.map((p) => (
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
          <LoadoutName name={loadout.name} />
          <p className="text-sm text-muted">
            {doneCount}/{tracked.length} tracked pieces unlocked
            {!sync && ' · sync your account to populate progress'}
          </p>
        </div>
      </div>

      {SECTIONS.map(({ families, title }) => {
        const slots = loadout.slots.filter((s) => families.includes(s.family))
        if (slots.length === 0) return null
        return (
          <section key={title}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
            {families.includes('weapon') ? (
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
