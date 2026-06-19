// ---------------------------------------------------------------------------
// MediaWiki action-API client for the GW2 wiki, with an on-disk wikitext cache.
//
// We pull raw wikitext via api.php?action=parse&prop=wikitext. Polite usage:
// a descriptive User-Agent, sequential requests with a small delay, and a disk
// cache so re-runs are cheap and reproducible. Uses Node's built-in fetch — no
// new runtime dependency (mirrors src/api/gw2.ts's plain-fetch approach).
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, 'cache')
const API = 'https://wiki.guildwars2.com/api.php'
const USER_AGENT =
  'gw2-loadout-wikisync/1.0 (legendary recipe reconciliation; contact: project maintainer)'
const DELAY_MS = 300

export interface FetchedPage {
  title: string
  wikitext: string
  hash: string
  fromCache: boolean
}

let lastRequest = 0

function cachePath(page: string): string {
  const safe = page.replace(/[^a-z0-9]+/gi, '_').slice(0, 120)
  const h = createHash('sha1').update(page).digest('hex').slice(0, 8)
  return join(CACHE_DIR, `${safe}.${h}.json`)
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch a page's wikitext. Uses the disk cache unless `noCache` is set. Throws
 * on network/API error so callers can decide whether to abort or degrade.
 */
export async function fetchWikitext(
  page: string,
  opts: { noCache?: boolean } = {},
): Promise<FetchedPage> {
  const path = cachePath(page)
  if (!opts.noCache && existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, 'utf8')) as {
      title: string
      wikitext: string
    }
    return {
      title: cached.title,
      wikitext: cached.wikitext,
      hash: hashText(cached.wikitext),
      fromCache: true,
    }
  }

  // Rate-limit: keep at least DELAY_MS between live requests.
  const wait = DELAY_MS - (Date.now() - lastRequest)
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()

  const url =
    `${API}?action=parse&prop=wikitext&format=json&redirects=1&page=` +
    encodeURIComponent(page)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`wiki fetch ${page}: HTTP ${res.status}`)
  const json = (await res.json()) as {
    error?: { info?: string }
    parse?: { title: string; wikitext: { '*': string } }
  }
  if (json.error) throw new Error(`wiki API ${page}: ${json.error.info ?? 'error'}`)
  if (!json.parse) throw new Error(`wiki API ${page}: no parse result`)

  const wikitext = json.parse.wikitext['*']
  const title = json.parse.title
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(path, JSON.stringify({ title, wikitext }, null, 2))
  return { title, wikitext, hash: hashText(wikitext), fromCache: false }
}

/** Wiki page URL for a title (spaces -> underscores, encoded). */
export function wikiUrl(title: string): string {
  return 'https://wiki.guildwars2.com/wiki/' + encodeURIComponent(title.replace(/ /g, '_'))
}
