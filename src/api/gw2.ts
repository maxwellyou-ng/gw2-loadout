// ---------------------------------------------------------------------------
// GW2 API client (brief Section 3, step 3). Pure client-side: the browser
// calls api.guildwars2.com directly (CORS-enabled), so no backend is needed.
// A full sync is a handful of calls; static data is cacheable.
// ---------------------------------------------------------------------------

import type { InventorySnapshot, PriceMap, SyncMeta } from '../types'
import { mergeInventory, type RawAccountData } from '../engine'
import { CATALOG } from '../data/recipes'
import { CURRENCY_BASE, isSynthetic } from '../data/items'

const BASE = 'https://api.guildwars2.com/v2'

export interface SyncResult {
  snapshot: InventorySnapshot
  prices: PriceMap
  meta: SyncMeta
  /** Endpoints that failed (e.g. key missing a scope), for honest UI reporting. */
  warnings: string[]
}

export type ProgressFn = (message: string) => void

class Gw2ApiError extends Error {
  path: string
  status: number
  constructor(path: string, status: number) {
    super(`GW2 API ${path} -> ${status}`)
    this.path = path
    this.status = status
  }
}

async function get<T>(path: string, key?: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (key) headers.Authorization = `Bearer ${key}`
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) throw new Gw2ApiError(path, res.status)
  return res.json() as Promise<T>
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Run async tasks with a concurrency cap (politeness toward the rate limit). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return results
}

/** Real, priceable item ids referenced anywhere in the catalog recipes. */
function priceableItemIds(): number[] {
  const ids = new Set<number>()
  for (const piece of CATALOG) {
    for (const node of piece.recipe.nodes) {
      for (const input of node.inputs) {
        if (!isSynthetic(input.itemId) && input.itemId < CURRENCY_BASE) ids.add(input.itemId)
      }
    }
  }
  return [...ids]
}

const normName = (s: string) => s.trim().toLowerCase()

export async function validateKey(key: string): Promise<{ name: string; permissions: string[] }> {
  return get<{ name: string; permissions: string[] }>('/tokeninfo', key)
}

/**
 * Full account sync. Pulls every account source, merges to one snapshot,
 * fetches live TP prices for the catalog's buyable mats, and resolves which
 * legendaries are already unlocked (auto-"Done").
 */
export async function syncAccount(key: string, onProgress?: ProgressFn): Promise<SyncResult> {
  const warnings: string[] = []
  const note = (m: string) => onProgress?.(m)

  // Tolerant fetch: a missing scope shouldn't abort the whole sync.
  const tryGet = async <T>(path: string, fallback: T, label: string): Promise<T> => {
    try {
      return await get<T>(path, key)
    } catch (e) {
      warnings.push(`${label} failed (${(e as Gw2ApiError).status ?? 'error'})`)
      return fallback
    }
  }

  note('Fetching material vault…')
  const materials = await tryGet<{ id: number; count: number }[]>(
    '/account/materials',
    [],
    'materials',
  )

  note('Fetching wallet…')
  const wallet = await tryGet<{ id: number; value: number }[]>('/account/wallet', [], 'wallet')

  note('Fetching bank & shared slots…')
  const [bank, sharedInventory] = await Promise.all([
    tryGet<({ id: number; count: number } | null)[]>('/account/bank', [], 'bank'),
    tryGet<({ id: number; count: number } | null)[]>('/account/inventory', [], 'shared inventory'),
  ])

  note('Fetching characters…')
  const charNames = await tryGet<string[]>('/characters', [], 'characters')
  const characterItems: { id: number; count: number }[] = []
  await mapLimit(charNames, 4, async (name) => {
    const enc = encodeURIComponent(name)
    const [inv, equip] = await Promise.all([
      tryGet<{ bags: ({ inventory: ({ id: number; count: number } | null)[] } | null)[] }>(
        `/characters/${enc}/inventory`,
        { bags: [] },
        `inventory:${name}`,
      ),
      tryGet<{ equipment: { id: number; count?: number }[] }>(
        `/characters/${enc}/equipment`,
        { equipment: [] },
        `equipment:${name}`,
      ),
    ])
    for (const bag of inv.bags ?? []) {
      for (const slot of bag?.inventory ?? []) {
        if (slot) characterItems.push({ id: slot.id, count: slot.count })
      }
    }
    for (const eq of equip.equipment ?? []) {
      characterItems.push({ id: eq.id, count: eq.count ?? 1 })
    }
  })

  note('Resolving unlocked legendaries…')
  const ownedArmory = await tryGet<{ id: number; count: number }[]>(
    '/account/legendaryarmory',
    [],
    'legendary armory',
  )
  const ownedArmoryIds = ownedArmory.map((a) => a.id)
  let ownedArmoryNames: string[] = []
  if (ownedArmoryIds.length) {
    const nameChunks = await Promise.all(
      chunk(ownedArmoryIds, 150).map((ids) =>
        tryGet<{ id: number; name: string }[]>(
          `/items?ids=${ids.join(',')}`,
          [],
          'item names',
        ),
      ),
    )
    ownedArmoryNames = nameChunks.flat().map((i) => i.name)
  }

  note('Fetching achievement progress…')
  const achievementsList = await tryGet<
    { id: number; current: number; max: number; done: boolean }[]
  >('/account/achievements', [], 'achievements')
  const achievements: SyncMeta['achievements'] = {}
  for (const a of achievementsList) {
    achievements[a.id] = { current: a.current, max: a.max, done: a.done }
  }

  note('Fetching Trading Post prices…')
  const priceIds = priceableItemIds()
  const prices: PriceMap = {}
  const priceChunks = await Promise.all(
    chunk(priceIds, 150).map((ids) =>
      tryGet<{ id: number; sells: { unit_price: number }; buys: { unit_price: number } }[]>(
        `/commerce/prices?ids=${ids.join(',')}`,
        [],
        'TP prices',
      ),
    ),
  )
  for (const p of priceChunks.flat()) {
    // Use the sell (buy-it-now) price as the cost to skip the grind.
    prices[p.id] = p.sells?.unit_price ?? p.buys?.unit_price ?? 0
  }

  const raw: Partial<RawAccountData> = {
    materials,
    bank,
    sharedInventory,
    characterItems,
    wallet,
  }
  const snapshot = mergeInventory(raw)

  const meta: SyncMeta = {
    lastSynced: new Date().toISOString(),
    characters: charNames,
    ownedArmoryIds,
    ownedArmoryNames,
    achievements,
  }

  return { snapshot, prices, meta, warnings }
}

export { normName }
