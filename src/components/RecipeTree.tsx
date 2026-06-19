// Recursive, collapsible crafting-tree view for a legendary piece. Purely
// presentational — it renders a RecipeTreeNode produced by engine/buildRecipeTree
// (which carries qty, owned/remaining, TP price, category, game mode, and a
// provenance flag). The wiki-style nesting makes "what combines into what" clear,
// and the provenance badge keeps unverified (hand-entered) data visibly flagged.

import { useState } from 'react'
import type { MaterialCategory, Provenance, RecipeTreeNode } from '../types'
import { Badge, SeverityDot, WikiName, ItemIcon } from './ui'
import { formatGold } from '../lib/format'

const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  currency: 'Currency',
  'time-gated': 'Daily',
  crafting: 'Crafting',
  gift: 'Gift',
  'reward-track': 'Reward track',
  achievement: 'Achievement',
  collection: 'Collection',
  vendor: 'Vendor',
}

const CATEGORY_TONE: Record<MaterialCategory, 'neutral' | 'good' | 'warn' | 'bad' | 'gate' | 'accent'> = {
  currency: 'gate',
  'time-gated': 'gate',
  crafting: 'neutral',
  gift: 'accent',
  'reward-track': 'warn',
  achievement: 'warn',
  collection: 'warn',
  vendor: 'neutral',
}

const PROVENANCE: Record<Provenance, { label: string; tone: 'good' | 'neutral' | 'warn'; title: string }> = {
  verified: { label: '✓ wiki', tone: 'good', title: 'Recipe matches the GW2 wiki (gate-enforced).' },
  summarized: {
    label: 'summary',
    tone: 'neutral',
    title: 'Stands in for a deeper collection/achievement journey — open the wiki for the full steps.',
  },
  unverified: {
    label: '⚠ unverified',
    tone: 'warn',
    title: 'Hand-entered and not machine-verified — cross-check on the wiki before trusting.',
  },
}

function Right({ node }: { node: RecipeTreeNode }) {
  const { timeGate, remaining, owned, ref, buyable, unitPrice } = node
  const days = timeGate.isGated && timeGate.dailyRate ? Math.ceil(remaining / timeGate.dailyRate) : null
  return (
    <div className="flex shrink-0 items-center gap-3 text-xs">
      <span className={`w-16 text-right tabular-nums ${remaining === 0 ? 'text-good' : 'text-muted'}`}>
        {owned}/{ref.qty}
      </span>
      <span className="hidden w-10 text-right tabular-nums text-gate sm:block">{days != null ? `${days}d` : ''}</span>
      <span className="hidden w-24 text-right font-mono text-muted sm:block">
        {buyable && unitPrice != null && unitPrice > 0 ? formatGold(remaining * unitPrice) : ''}
      </span>
    </div>
  )
}

function TreeRow({ node, depth }: { node: RecipeTreeNode; depth: number }) {
  const hasChildren = node.children.length > 0
  const [open, setOpen] = useState(depth < 2)
  const done = node.remaining === 0 && node.owned >= node.ref.qty
  const prov = PROVENANCE[node.provenance]

  return (
    <div className={depth > 0 ? 'border-l border-line/60 pl-3' : ''}>
      <div className={`flex items-center justify-between gap-3 py-1.5 ${done ? 'opacity-55' : ''}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          {hasChildren ? (
            <button
              type="button"
              aria-label={open ? 'Collapse' : 'Expand'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted transition-colors hover:text-ink"
            >
              <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
            </button>
          ) : (
            <span className="h-4 w-4 shrink-0 text-center text-line">·</span>
          )}

          <ItemIcon itemId={node.ref.itemId} name={node.ref.name} size={20} />

          {node.timeGate.isGated && node.timeGate.severity && <SeverityDot severity={node.timeGate.severity} />}

          <WikiName name={node.ref.name} itemId={node.ref.itemId} className="truncate text-sm text-ink" />
          <span className="shrink-0 font-mono text-xs text-muted">×{node.ref.qty}</span>

          <span className="ml-1 flex shrink-0 items-center gap-1">
            {(hasChildren || node.category !== 'crafting') && (
              <Badge tone={CATEGORY_TONE[node.category]}>{CATEGORY_LABEL[node.category]}</Badge>
            )}
            {node.gameMode && <Badge tone="accent">{node.gameMode}</Badge>}
            <span title={prov.title}>
              <Badge tone={prov.tone}>{prov.label}</Badge>
            </span>
          </span>
        </div>

        <Right node={node} />
      </div>

      {hasChildren && open && (
        <div className="ml-2">
          {node.children.map((c, i) => (
            <TreeRow key={`${c.ref.itemId}-${c.ref.name}-${i}`} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RecipeTree({ root }: { root: RecipeTreeNode }) {
  return (
    <div>
      {root.children.map((c, i) => (
        <TreeRow key={`${c.ref.itemId}-${c.ref.name}-${i}`} node={c} depth={0} />
      ))}
    </div>
  )
}
