import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { Card, ProgressBar, ScorePill, SeverityDot, Badge, EmptyState, WikiName } from '../components/ui'
import RecipeTree from '../components/RecipeTree'
import { buildRecipeTree } from '../engine'
import { VERIFIED_INTERMEDIATES } from '../data/verified-intermediates'
import { formatGold, formatDate, formatPercent } from '../lib/format'
import type { RemainingMaterial } from '../types'

type View = 'tree' | 'list'

function MaterialRow({ m }: { m: RemainingMaterial }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <div className="flex min-w-0 items-center gap-2">
        {m.timeGate.isGated && m.timeGate.severity && <SeverityDot severity={m.timeGate.severity} />}
        <WikiName name={m.name} itemId={m.itemId} className="truncate text-sm text-ink" />
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">
        {m.timeGate.isGated && m.timeGate.dailyRate ? (
          <span className="text-gate">
            {m.remaining} left · {Math.ceil(m.remaining / m.timeGate.dailyRate)}d
          </span>
        ) : (
          <span className="text-muted">
            {m.owned}/{m.required}
          </span>
        )}
        {m.buyable && m.unitPrice != null && m.unitPrice > 0 && (
          <span className="w-28 text-right font-mono text-xs text-muted">
            {formatGold(m.remaining * m.unitPrice)}
          </span>
        )}
      </div>
    </div>
  )
}

function Group({
  title,
  tone,
  materials,
  hint,
}: {
  title: string
  tone: 'gate' | 'good' | 'warn'
  materials: RemainingMaterial[]
  hint?: string
}) {
  if (materials.length === 0) return null
  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <Badge tone={tone}>{materials.length}</Badge>
      </div>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div>
        {materials.map((m) => (
          <MaterialRow key={m.itemId} m={m} />
        ))}
      </div>
    </Card>
  )
}

export default function PieceDetail({ inModal = false }: { inModal?: boolean }) {
  const { id } = useParams()
  const { progressByPiece, sync } = useApp()
  const [view, setView] = useState<View>('tree')
  const piece = id ? CATALOG_BY_ID[Number(id)] : undefined

  const tree = useMemo(
    () =>
      piece
        ? buildRecipeTree(piece, sync?.snapshot ?? {}, sync?.prices ?? {}, VERIFIED_INTERMEDIATES)
        : null,
    [piece, sync],
  )

  if (!piece) {
    return (
      <EmptyState title="Piece not found">
        <Link to="/loadout" className="text-accent underline">
          Back to loadout
        </Link>
      </EmptyState>
    )
  }

  const progress = progressByPiece[piece.id]
  const timeGated = progress.remainingMaterials.filter((m) => m.timeGate.isGated)
  const buyable = progress.remainingMaterials.filter((m) => m.buyable && !m.timeGate.isGated)
  const grind = progress.remainingMaterials.filter((m) => !m.buyable && !m.timeGate.isGated)

  return (
    <div className="space-y-6">
      {!inModal && (
        <Link to="/loadout" className="text-sm text-accent underline">
          ← Loadout
        </Link>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-ink">{piece.name}</h2>
              <ScorePill value={progress.completionScore} done={progress.owned} />
            </div>
            <p className="text-sm text-muted">
              {piece.type} · {piece.acquisitionMode}
              {piece.unlocks.length > 1 && ` · ${piece.unlocks.length} armory unlocks`}
            </p>
            {piece.blurb && <p className="mt-2 max-w-xl text-sm text-muted">{piece.blurb}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="text-muted">Earliest finish</p>
            <p className="text-lg font-semibold text-ink">
              {progress.owned ? 'Unlocked' : formatDate(progress.earliestFinishDate)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar value={progress.owned ? 1 : progress.completionScore} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
          <div>
            <p className="text-muted">Time</p>
            <p className="font-semibold text-ink">
              {progress.hasTimeBasis ? formatPercent(progress.timeProgress) : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted">Gold</p>
            <p className="font-semibold text-ink">
              {progress.hasGoldBasis ? formatPercent(progress.goldProgress) : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted">Quantity</p>
            <p className="font-semibold text-ink">{formatPercent(progress.qtyProgress)}</p>
          </div>
        </div>

        {!piece.recipe.verified && (
          <p className="mt-4 rounded-lg border border-warn/30 bg-warn/10 p-2 text-xs text-warn">
            ⚠ Recipe seeded from known structure but not yet wiki-verified.{' '}
            {piece.recipe.wikiUrl && (
              <a className="underline" href={piece.recipe.wikiUrl} target="_blank" rel="noreferrer">
                Cross-check on the wiki
              </a>
            )}
          </p>
        )}
      </Card>

      {!sync && (
        <EmptyState title="No account data yet">
          Sync your account on the Settings tab to see real remaining-material counts.
        </EmptyState>
      )}

      {progress.owned ? (
        <EmptyState title="Already unlocked in your armory 🎉" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
              {(['tree', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    view === v ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
                  }`}
                >
                  {v === 'tree' ? 'Crafting tree' : 'Shopping list'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {view === 'tree'
                ? 'Full recipe structure — expand a gift to see what it combines.'
                : 'Flat list of what you still need, grouped by how you get it.'}
            </p>
          </div>

          {view === 'tree' && tree && (
            <Card>
              <RecipeTree root={tree} />
            </Card>
          )}

          {/* Buy-out callout — timed per Section 6.5. Suppressed pre-sync when
              there are no prices (buyOutGold === 0 and not finishable). */}
          {view === 'list' && (progress.finishableByGold || progress.buyOutGold > 0) && (
            <Card
              className={
                progress.finishableByGold ? 'border-good/50 bg-good/5' : 'border-line'
              }
            >
              {progress.finishableByGold ? (
                <p className="text-sm text-good">
                  <span className="font-semibold">Finish now for ≈{formatGold(progress.buyOutGold)}</span>{' '}
                  — everything left is purchasable. Spending gold is now the fastest path.
                </p>
              ) : (
                <p className="text-sm text-muted">
                  ≈{formatGold(progress.buyOutGold)} of buyables left (informational) — you'll likely
                  pick most of this up while grinding the non-purchasable parts, so don't buy early.
                </p>
              )}
            </Card>
          )}

          {view === 'list' && (
            <>
              <Group
                title="Time-gated"
                tone="gate"
                materials={timeGated}
                hint="Daily-capped — collect every day so the finish date doesn't slip."
              />
              <Group
                title="Grind-only (account-bound)"
                tone="warn"
                materials={grind}
                hint="Can't be bought on the Trading Post."
              />
              <Group title="Buyable" tone="good" materials={buyable} hint="Available on the Trading Post." />

              {progress.remainingMaterials.length === 0 && sync && (
                <EmptyState title="No remaining materials — ready to forge!" />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
