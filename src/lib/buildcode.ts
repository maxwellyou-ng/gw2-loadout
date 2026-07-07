// ---------------------------------------------------------------------------
// Build codes: a compact, URL-safe, versioned string that captures only the
// loadout *goals* — never the API key, never sync/inventory data.
//
// Encoded per slot: key, chosenPieceId, tracked, flexible, priority,
// candidateIds. Presentational fields (label, family) are not transmitted;
// they're rehydrated from SLOT_ORDER on decode, so two clients on the same app
// version reconstruct an identical Loadout. The version prefix lets old codes
// keep working: v1 carried a `status` index (must-have/flexible/done/
// not-pursuing) which we map forward to the `flexible` boolean.
// ---------------------------------------------------------------------------

import {
  SLOT_ORDER,
  normalizeLoadout,
  type Loadout,
  type LoadoutSlot,
} from '../data/loadout'
import type { SlotFamily, SlotKey } from '../types'
import {
  makeGoal,
  migrateLoadoutToPlan,
  normalizePlan,
  type GoalState,
  type Plan,
} from '../state/plan'

const PREFIX_V3 = 'gw2-v3.'
const PREFIX_V2 = 'gw2-v2.'
const PREFIX_V1 = 'gw2-v1.'

// v1 status index order (frozen — only used to decode legacy codes).
const V1_STATUS = ['must-have', 'flexible', 'done', 'not-pursuing'] as const

interface SlotWireV2 {
  k: SlotKey
  c: number | null // chosenPieceId
  t: 0 | 1 // tracked
  f: 0 | 1 // flexible
  p: number | 'd' // priority ('d' = legacy defer sentinel, decode-only)
  n: number[] // candidateIds
}

interface SlotWireV1 {
  k: SlotKey
  c: number | null
  s: number // status index
  t: 0 | 1
  p: number | 'd'
  n: number[]
}

interface Wire<S> {
  n: string // loadout name
  s: S[]
}

function toBase64Url(s: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encode(loadout: Loadout): string {
  const wire: Wire<SlotWireV2> = {
    n: loadout.name,
    s: loadout.slots.map((slot) => ({
      k: slot.key,
      c: slot.chosenPieceId,
      t: slot.tracked ? 1 : 0,
      f: slot.flexible ? 1 : 0,
      p: slot.priority,
      n: slot.candidateIds,
    })),
  }
  return PREFIX_V2 + toBase64Url(JSON.stringify(wire))
}

function rehydrateSlot(
  sw: { k: SlotKey; c: number | null; t: 0 | 1; p: number | 'd'; n: number[] },
  flexible: boolean,
): LoadoutSlot {
  const meta = SLOT_ORDER.find((o) => o.key === sw.k)
  return {
    key: sw.k,
    label: meta?.label ?? sw.k,
    family: (meta?.family ?? 'misc') as SlotFamily,
    tracked: sw.t === 1,
    flexible,
    // Legacy codes encoded a 'd' defer sentinel; map it to a high number so it
    // sorts last. New codes always carry a numeric priority.
    priority: sw.p === 'd' ? 99 : sw.p,
    chosenPieceId: sw.c,
    candidateIds: sw.n ?? [],
  }
}

// Build codes are tiny (~23 slots of small fields). Reject anything wildly larger
// than a legitimate code before we base64-decode and JSON.parse untrusted input —
// a cheap guard against a pasted megabyte triggering pathological parse cost.
const MAX_CODE_LENGTH = 16_384

const VALID_SLOT_KEYS = new Set<SlotKey>(SLOT_ORDER.map((o) => o.key))

/** Shape-check an untrusted decoded wire object; throws a clear error if malformed. */
function assertWire(value: unknown): asserts value is Wire<{ k: SlotKey; n?: number[] }> {
  if (typeof value !== 'object' || value === null) throw new Error('Build code is not an object.')
  const v = value as Record<string, unknown>
  if (typeof v.n !== 'string') throw new Error('Build code is missing its loadout name.')
  if (!Array.isArray(v.s)) throw new Error('Build code is missing its slot list.')
  for (const sw of v.s) {
    if (typeof sw !== 'object' || sw === null) throw new Error('Build code has a malformed slot.')
    const s = sw as Record<string, unknown>
    if (!VALID_SLOT_KEYS.has(s.k as SlotKey)) throw new Error(`Build code has an unknown slot key.`)
    if (s.n !== undefined && !(Array.isArray(s.n) && s.n.every((x) => typeof x === 'number')))
      throw new Error('Build code has malformed candidate ids.')
  }
}

export function decode(code: string): Loadout {
  const trimmed = code.trim()
  if (trimmed.length > MAX_CODE_LENGTH) throw new Error('Build code is too large.')

  if (trimmed.startsWith(PREFIX_V2)) {
    const wire = JSON.parse(fromBase64Url(trimmed.slice(PREFIX_V2.length)))
    assertWire(wire)
    const slots = (wire.s as SlotWireV2[]).map((sw) => rehydrateSlot(sw, sw.f === 1))
    return normalizeLoadout({ name: wire.n, slots })
  }

  if (trimmed.startsWith(PREFIX_V1)) {
    // Legacy: derive `flexible` from the old status index.
    const wire = JSON.parse(fromBase64Url(trimmed.slice(PREFIX_V1.length)))
    assertWire(wire)
    const slots = (wire.s as SlotWireV1[]).map((sw) => rehydrateSlot(sw, V1_STATUS[sw.s] === 'flexible'))
    return normalizeLoadout({ name: wire.n, slots })
  }

  throw new Error('Unrecognized build code (wrong or missing version prefix).')
}

// --- v3: goal-centric plan codes --------------------------------------------
// Encoded per goal: pieceId, state index, candidates, slot hint. Goal ids are
// NOT transmitted (regenerated on decode); `celebrated` is forced true so an
// imported plan never replays someone else's completion celebrations.

const V3_STATES: GoalState[] = ['active', 'paused', 'deciding', 'done']

interface GoalWireV3 {
  p: number | null // pieceId
  s: number // state index into V3_STATES
  n?: number[] // candidateIds
  h?: SlotKey // slotHint
  c?: string // completedAt
}

interface WireV3 {
  n: string
  g: GoalWireV3[]
}

export function encodePlan(plan: Plan): string {
  const wire: WireV3 = {
    n: plan.name,
    g: plan.goals.map((g) => ({
      p: g.pieceId,
      s: Math.max(0, V3_STATES.indexOf(g.state)),
      ...(g.candidateIds.length ? { n: g.candidateIds } : {}),
      ...(g.slotHint ? { h: g.slotHint } : {}),
      ...(g.completedAt ? { c: g.completedAt } : {}),
    })),
  }
  return PREFIX_V3 + toBase64Url(JSON.stringify(wire))
}

function assertWireV3(value: unknown): asserts value is WireV3 {
  if (typeof value !== 'object' || value === null) throw new Error('Build code is not an object.')
  const v = value as Record<string, unknown>
  if (typeof v.n !== 'string') throw new Error('Build code is missing its plan name.')
  if (!Array.isArray(v.g)) throw new Error('Build code is missing its goal list.')
  for (const gw of v.g) {
    if (typeof gw !== 'object' || gw === null) throw new Error('Build code has a malformed goal.')
    const g = gw as Record<string, unknown>
    if (!(typeof g.p === 'number' || g.p === null))
      throw new Error('Build code has a malformed goal piece id.')
    if (typeof g.s !== 'number' || g.s < 0 || g.s >= V3_STATES.length)
      throw new Error('Build code has an unknown goal state.')
    if (g.n !== undefined && !(Array.isArray(g.n) && g.n.every((x) => typeof x === 'number')))
      throw new Error('Build code has malformed candidate ids.')
  }
}

/**
 * Decode any build code version into a Plan: v3 natively; v1/v2 slot codes are
 * decoded to a Loadout and migrated forward, so old shared codes keep working.
 */
export function decodePlan(code: string): Plan {
  const trimmed = code.trim()
  if (trimmed.length > MAX_CODE_LENGTH) throw new Error('Build code is too large.')

  if (trimmed.startsWith(PREFIX_V3)) {
    const wire = JSON.parse(fromBase64Url(trimmed.slice(PREFIX_V3.length)))
    assertWireV3(wire)
    return normalizePlan({
      version: 2,
      name: wire.n,
      goals: wire.g.map((gw) =>
        makeGoal({
          pieceId: gw.p,
          state: V3_STATES[gw.s],
          candidateIds: gw.n ?? [],
          slotHint: gw.h,
          completedAt: gw.c,
          celebrated: V3_STATES[gw.s] === 'done' ? true : undefined,
        }),
      ),
    })
  }

  return migrateLoadoutToPlan(decode(trimmed))
}
