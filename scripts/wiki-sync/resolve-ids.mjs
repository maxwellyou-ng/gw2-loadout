// One-off phase-3 resolver: resolve every unique recipe component name across
// the weapon/trinket/back snapshots to its real GW2 API item id (read off the
// wiki infobox), with redirect following. Writes a committed item-ids.json so
// the catalog can bake real ids into recipe leaves (enables TP pricing + armory
// ownership matching). Shared gifts that the engine expands via builders are
// skipped (handled with their own known ids).
import https from 'node:https'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAP = join(HERE, 'snapshot')
const OUT = join(HERE, 'item-ids.json')

// Components expanded by builders (their ids are already known) — don't resolve.
const SKIP = new Set([
  'gift of fortune',
  'gift of mastery',
  'mystic tribute',
  'draconic tribute',
])

function wikitext(title) {
  return new Promise((res, rej) => {
    const u =
      'https://wiki.guildwars2.com/api.php?action=parse&format=json&prop=wikitext&redirects=1&page=' +
      encodeURIComponent(title)
    https
      .get(u, { headers: { 'User-Agent': 'gw2-loadout-tracker/1.0 (recipe id sync)' } }, (r) => {
        let d = ''
        r.on('data', (c) => (d += c))
        r.on('end', () => {
          try {
            res(JSON.parse(d))
          } catch (e) {
            rej(e)
          }
        })
      })
      .on('error', rej)
  })
}
const idOf = (wt) => {
  const m = /\|\s*id\s*=\s*(\d+)/i.exec(wt)
  return m ? parseInt(m[1], 10) : null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Collect unique component names from all snapshots.
const names = new Map() // canon -> display name
for (const cat of ['weapons', 'trinkets', 'backs']) {
  const snap = JSON.parse(readFileSync(join(SNAP, `${cat}.json`), 'utf8'))
  for (const e of snap.entries) {
    for (const c of e.components ?? []) {
      const canon = c.name.trim().toLowerCase()
      if (SKIP.has(canon)) continue
      if (!names.has(canon)) names.set(canon, c.name.trim())
    }
  }
}

const existing = (() => {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'))
  } catch {
    return {}
  }
})()

const result = { ...existing }
const unresolved = []
for (const [canon, display] of names) {
  if (result[canon]?.id) continue
  let title = display
  // The wiki disambiguates several precursors/weapons with "(weapon)".
  const tries = [title, title.replace(/\s*\(weapon\)$/i, ''), title.replace(/\s*\(weapon\)$/i, ' (legendary weapon)')]
  let id = null
  let resolvedTitle = null
  for (const t of tries) {
    try {
      const j = await wikitext(t)
      const wt = j?.parse?.wikitext?.['*']
      if (!wt) continue
      const red = /^#redirect\s*\[\[([^\]]+)\]\]/i.exec(wt.trim())
      if (red) {
        const j2 = await wikitext(red[1])
        const wt2 = j2?.parse?.wikitext?.['*']
        id = wt2 ? idOf(wt2) : null
        resolvedTitle = red[1]
      } else {
        id = idOf(wt)
        resolvedTitle = j?.parse?.title ?? t
      }
      if (id) break
    } catch {
      /* try next */
    }
    await sleep(120)
  }
  result[canon] = { name: display, id, wikiTitle: resolvedTitle }
  if (!id) unresolved.push(display)
  console.log(`${display} -> ${id ?? 'UNRESOLVED'}`)
  await sleep(120)
}

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log(`\nWrote ${Object.keys(result).length} ids to item-ids.json`)
console.log(`Unresolved (${unresolved.length}): ${unresolved.join(', ')}`)
