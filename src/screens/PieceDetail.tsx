// ---------------------------------------------------------------------------
// Piece detail — one legendary, at the disclosure ladder's L1 (docs/REDESIGN.md
// §5): summary header → grouped materials (collapsed where quiet) → recipe
// tree → wiki links per node.
//
// Allocation-first (docs/UX-BEST-PRACTICES.md §3.1): when the piece is an
// active goal, the plan-aware numbers lead ("in your plan: 43%, behind
// Twilight"); the isolation view is one toggle away. Refine-when-close (§3.3):
// a "Finishing steps" checklist appears only when everything left is on hand
// or buyable.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp, CATALOG_BY_ID } from '../state/store'
import { Card, ProgressBar, ScorePill, SeverityDot, Badge, EmptyState, WikiName, ItemIcon, InfoTooltip, StatStrip } from '../components/ui'
import { ITEM_NOTES } from '../data/items'
import RecipeTree from '../components/RecipeTree'
import { buildRecipeTree, finishingPlan } from '../engine'
import { VERIFIED_INTERMEDIATES } from '../data/verified-intermediates'
import refinementTable from '../data/recipes/generated/refinements.generated.json'
import { formatGold, formatDate, formatPercent } from '../lib/format'
import type { RemainingMaterial } from '../types'
import type { FinishingStep } from '../engine'

type View = 'list' | 'tree'
type Lens = 'plan' | 'isolation'

// Wiki-matched intermediates plus the refinement recipes, which are verified
// against the official /v2/recipes API instead of the wiki snapshot
// (`npm run wiki:refinements`) — equally authoritative, so equally badged.
const VERIFIED_NAMES: ReadonlySet<string> = new Set([
  ...VERIFIED_INTERMEDIATES,
  ...Object.values(refinementTable).map((r) => r.name),
])

function MaterialRow({ m }: { m: RemainingMaterial }) {
  const days = m.timeGate.isGated && m.timeGate.dailyRate
    ? Math.ceil(m.remaining / m.timeGate.dailyRate)
    : null
  return (
    <div className="flex items-center gap-3 border-b border-line/60 py-1.5 last:border-0">
      <ItemIcon itemId={m.itemId} name={m.name} size={24} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {m.timeGate.isGated && m.timeGate.severity && <SeverityDot severity={m.timeGate.severity} />}
        <WikiName name={m.name} itemId={m.itemId} className="truncate text-sm text-ink" />
        {ITEM_NOTES[m.itemId] && <InfoTooltip label={ITEM_NOTES[m.itemId]} />}
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted">
        {m.owned}/{m.required}
      </span>
      <span className="hidden w-14 shrink-0 text-right text-sm tabular-nums text-gate sm:block">
        {days != null ? `${days}d` : ''}
      </span>
      <span className="hidden w-24 shrink-0 text-right font-mono text-xs text-muted sm:block">
        {m.buyable && m.unitPrice != null && m.unitPrice > 0 ? formatGold(m.remaining * m.unitPrice) : ''}
      </span>
    </div>
  )
}

/** A material group as a disclosure: count + subtotal always visible, rows on
 *  demand. The loud group (time-gated) opens by default; the rest stay quiet. */
function Group({
  title,
  tone,
  materials,
  hint,
  defaultOpen = false,
}: {
  title: string
  tone: 'gate' | 'good' | 'warn'
  materials: RemainingMaterial[]
  hint?: string
  defaultOpen?: boolean
}) {
  if (materials.length === 0) return null
  return (
    <Card className="p-0">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer select-none items-center gap-2 p-3 marker:content-none">
          <span className="text-xs text-muted transition-transform group-open:rotate-90">▶</span>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <Badge tone={tone}>{materials.length}</Badge>
          {hint && <span className="hidden text-xs font-normal text-muted sm:inline">{hint}</span>}
        </summary>
        <div className="px-3 pb-3">
          {materials.map((m) => (
            <MaterialRow key={m.itemId} m={m} />
          ))}
        </div>
      </details>
    </Card>
  )
}

const STEP_VERB: Record<FinishingStep['action'], string> = {
  buy: 'Buy',
  craft: 'Craft',
  forge: 'Forge',
  vendor: 'Buy from vendor',
  collect: 'Collect',
}

export default function PieceDetail({ inModal = false }: { inModal?: boolean }) {
  const { id } = useParams()
  const { plan, progressByPiece, allocatedByGoal, sync, pricesLoaded } = useApp()
  const [view, setView] = useState<View>('list')
  const [lens, setLens] = useState<Lens>('plan')
  const piece = id ? CATALOG_BY_ID[Number(id)] : undefined

  // Plan context: is this piece an active goal, and where in the ladder?
  const activeGoals = plan.goals.filter(
    (g) => g.state === 'active' && g.pieceId != null && CATALOG_BY_ID[g.pieceId],
  )
  const goalIndex = piece ? activeGoals.findIndex((g) => g.pieceId === piece.id) : -1
  const goal = goalIndex >= 0 ? activeGoals[goalIndex] : undefined
  const allocated = goal ? allocatedByGoal[goal.id] : undefined

  const tree = useMemo(
    () =>
      piece
        ? buildRecipeTree(piece, sync?.snapshot ?? {}, sync?.prices ?? {}, VERIFIED_NAMES)
        : null,
    [piece, sync],
  )

  if (!piece) {
    return (
      <EmptyState title="Piece not found">
        <Link to="/goals" className="text-accent underline">
          Back to goals
        </Link>
      </EmptyState>
    )
  }

  const isolation = progressByPiece[piece.id]
  // Allocation-first: plan numbers lead when the piece is an active goal; the
  // isolation lens (full inventory credited to this piece alone) is a toggle.
  const hasBothLenses =
    allocated != null &&
    !allocated.owned &&
    Math.abs(allocated.completionScore - isolation.completionScore) > 0.005
  const progress = goal && allocated && lens === 'plan' ? allocated : isolation

  const timeGated = progress.remainingMaterials.filter((m) => m.timeGate.isGated)
  const buyable = progress.remainingMaterials.filter((m) => m.buyable && !m.timeGate.isGated)
  const grind = progress.remainingMaterials.filter((m) => !m.buyable && !m.timeGate.isGated)

  // Refine-when-close: only computable (non-null) when every remaining leaf is
  // on hand or buyable — i.e. the piece is closeable without more farming.
  const finishing = !progress.owned && tree ? finishingPlan(tree) : null

  const ahead = goalIndex > 0 ? CATALOG_BY_ID[activeGoals[goalIndex - 1].pieceId!] : undefined

  return (
    <div className="space-y-6">
      {!inModal && (
        <Link to="/goals" className="text-sm text-accent underline">
          ← Goals
        </Link>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ItemIcon itemId={piece.id} name={piece.name} size={44} className="mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-ink">{piece.name}</h2>
                <ScorePill value={progress.completionScore} done={progress.owned} />
              </div>
              <p className="text-sm text-muted">
                {piece.type} · {piece.acquisitionMode}
                {piece.gen && ` · ${piece.gen}`}
                {piece.unlocks.length > 1 && ` · ${piece.unlocks.length} armory unlocks`}
                {goal &&
                  !progress.owned &&
                  ` · #${goalIndex + 1} in your plan${ahead ? ` (behind ${ahead.name})` : ''}`}
              </p>
              {piece.blurb && <p className="mt-2 max-w-xl text-sm text-muted">{piece.blurb}</p>}
            </div>
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

        <StatStrip
          className="mt-4"
          stats={[
            {
              label: 'Time',
              value: progress.hasTimeBasis ? formatPercent(progress.timeProgress) : '—',
            },
            {
              label: 'Gold',
              value: progress.hasGoldBasis ? formatPercent(progress.goldProgress) : '—',
            },
            { label: 'Quantity', value: formatPercent(progress.qtyProgress) },
          ]}
        />

        {hasBothLenses && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
              {(
                [
                  ['plan', 'In your plan'],
                  ['isolation', 'In isolation'],
                ] as [Lens, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setLens(v)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    lens === v ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {lens === 'plan'
                ? `Higher-priority goals claim shared stock first — this is what's truly left for ${piece.name}.`
                : `If ${piece.name} were your only goal, with your full inventory credited to it (${formatPercent(isolation.completionScore)}).`}
            </p>
          </div>
        )}

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
          {/* Finishing steps: refine-when-close. Only rendered when the whole
              remainder is conversion work (or conversion + a TP run). */}
          {finishing && sync && (
            <Card className="border-good/50 bg-good/5">
              <h3 className="text-sm font-semibold text-good">
                {finishing.conversionOnly
                  ? 'Everything is on hand — finishing steps:'
                  : pricesLoaded
                    ? `One session from done — ≈${formatGold(finishing.buyGold)} on the TP plus these steps:`
                    : 'One session from done — a TP run plus these steps:'}
              </h3>
              <ol className="mt-2 space-y-1">
                {finishing.steps.map((s) => (
                  <li key={s.itemId} className="flex items-center gap-2 text-sm text-ink">
                    <span className="text-xs text-muted">{STEP_VERB[s.action]}</span>
                    <ItemIcon itemId={s.itemId} name={s.name} size={20} />
                    <WikiName name={s.name} itemId={s.itemId} className="min-w-0 truncate" />
                    <span className="font-mono text-xs text-muted">×{s.qty}</span>
                    {s.discipline && <Badge tone="neutral">{s.discipline}</Badge>}
                    {s.action === 'buy' && s.goldCost != null && pricesLoaded && (
                      <span className="font-mono text-xs text-muted">≈{formatGold(s.goldCost)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
              {(['list', 'tree'] as const).map((v) => (
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
                ? 'Full recipe structure — expand a gift to see what it combines; names link to the wiki.'
                : 'What you still need, grouped by how you get it.'}
            </p>
          </div>

          {view === 'tree' && tree && (
            <Card>
              <RecipeTree root={tree} />
            </Card>
          )}

          {/* Buy-out callout. Suppressed pre-sync when there are no prices. */}
          {view === 'list' && !finishing && (progress.finishableByGold || progress.buyOutGold > 0) && (
            <Card
              className={progress.finishableByGold ? 'border-good/50 bg-good/5' : 'border-line'}
            >
              {progress.finishableByGold ? (
                <p className="text-sm text-good">
                  {pricesLoaded ? (
                    <>
                      <span className="font-semibold">
                        Finish now for ≈{formatGold(progress.buyOutGold)}
                      </span>{' '}
                      — everything left is purchasable. Spending gold is now the fastest path.
                    </>
                  ) : (
                    <>Everything left is purchasable on the TP — prices unavailable, sync to cost it.</>
                  )}
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
                defaultOpen
                hint="Daily-capped — collect every day so the finish date doesn't slip."
              />
              <Group
                title="Grind-only (account-bound)"
                tone="warn"
                materials={grind}
                hint="Can't be bought on the Trading Post."
              />
              <Group
                title="Buyable"
                tone="good"
                materials={buyable}
                hint="Available on the Trading Post."
              />

              {progress.remainingMaterials.length === 0 && sync && !finishing && (
                <EmptyState title="No remaining materials — ready to forge!" />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
