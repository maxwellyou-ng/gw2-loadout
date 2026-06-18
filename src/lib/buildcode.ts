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

const PREFIX_V2 = 'gw2-v2.'
const PREFIX_V1 = 'gw2-v1.'

// v1 status index order (frozen — only used to decode legacy codes).
const V1_STATUS = ['must-have', 'flexible', 'done', 'not-pursuing'] as const

interface SlotWireV2 {
  k: SlotKey
  c: number | null // chosenPieceId
  t: 0 | 1 // tracked
  f: 0 | 1 // flexible
  p: number | 'd' // priority ('d' = defer)
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
      p: slot.priority === 'defer' ? 'd' : slot.priority,
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
    priority: sw.p === 'd' ? 'defer' : sw.p,
    chosenPieceId: sw.c,
    candidateIds: sw.n ?? [],
  }
}

export function decode(code: string): Loadout {
  const trimmed = code.trim()

  if (trimmed.startsWith(PREFIX_V2)) {
    const wire = JSON.parse(fromBase64Url(trimmed.slice(PREFIX_V2.length))) as Wire<SlotWireV2>
    const slots = wire.s.map((sw) => rehydrateSlot(sw, sw.f === 1))
    return normalizeLoadout({ name: wire.n, slots })
  }

  if (trimmed.startsWith(PREFIX_V1)) {
    // Legacy: derive `flexible` from the old status index.
    const wire = JSON.parse(fromBase64Url(trimmed.slice(PREFIX_V1.length))) as Wire<SlotWireV1>
    const slots = wire.s.map((sw) => rehydrateSlot(sw, V1_STATUS[sw.s] === 'flexible'))
    return normalizeLoadout({ name: wire.n, slots })
  }

  throw new Error('Unrecognized build code (wrong or missing version prefix).')
}
