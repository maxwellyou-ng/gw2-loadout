// ---------------------------------------------------------------------------
// Enumeration (Phase A): parse the four list pages into the canonical set of
// legendaries the wiki recognizes. Scoped to the "List of legendary …" section
// so the component/cost tables elsewhere on the page don't leak in.
//
// Two row shapes are handled:
//   - Weapon table (transcluded `Legendary weapon/table`): the legendary itself
//     is `{{item icon|Name|large=1}}`; component gifts are plain item icons.
//   - Trinket/armor/back list tables: the legendary is the first-column HEADER
//     cell (a `!`-line) holding `{{item icon|Name}}` or `[[Name]]`.
// ---------------------------------------------------------------------------

import type { Category } from './types'
import { fetchWikitext, wikiUrl } from './fetch'
import { sectionUnder, transclusions } from './wikitext'

export interface ListEntry {
  name: string
  type: string | null
  generation: string | null
  wikiUrl: string
}

const LIST_HEADING: Record<Category, string> = {
  weapons: 'List of legendary weapons',
  armor: 'List of legendary armor',
  trinkets: 'List of legendary trinkets',
  backs: 'List of legendary back items',
}

/** First `{{item icon|NAME …}}` value (NAME is the first positional param). */
function firstIconName(cell: string): string | null {
  const m = /\{\{item icon\|([^}|]+)/i.exec(cell)
  return m ? m[1].trim() : null
}

/** First `[[Page|Label]]` or `[[Name]]` target in a cell. */
function firstLinkName(cell: string): string | null {
  const m = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(cell)
  return m ? m[1].trim() : null
}

/** Parse the transcluded weapon table: rows keyed by `{{item icon|X|large=1}}`. */
function parseWeaponTable(wikitext: string): ListEntry[] {
  const out: ListEntry[] = []
  let generation: string | null = null
  const lines = wikitext.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const gh = /^={2,4}\s*(.+?)\s*={2,4}\s*$/.exec(line)
    if (gh) {
      generation = gh[1].replace(/\[\[|\]\]/g, '').trim()
      continue
    }
    // The legendary headline icon carries large=1.
    const m = /\{\{item icon\|([^}|]+)\|large=1/i.exec(line)
    if (m) {
      const name = m[1].trim()
      // The weapon type is the next table cell (next `|` line with a [[link]]).
      let type: string | null = null
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (/^\|/.test(lines[j])) {
          type = firstLinkName(lines[j])
          break
        }
      }
      out.push({ name, type, generation, wikiUrl: wikiUrl(name) })
    }
  }
  return out
}

/** Parse a generic list table: legendary = first-column header (`!`) cell. */
function parseHeaderRowTable(section: string): ListEntry[] {
  const out: ListEntry[] = []
  const lines = section.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // First column is a header cell: `! style=… | {{item icon|Name}}`
    if (!/^!/.test(line)) continue
    if (/!!/.test(line)) continue // header row like `! Name !! Type` — skip
    const cellMatch = /^!(?:[^|]*\|)?(.*)$/.exec(line)
    const cell = cellMatch ? cellMatch[1] : ''
    const name = firstIconName(cell) ?? firstLinkName(cell)
    if (!name) continue
    // Type: next `|` data cell.
    let type: string | null = null
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      if (/^\|/.test(lines[j])) {
        type = firstLinkName(lines[j]) ?? (lines[j].replace(/^\|/, '').trim() || null)
        break
      }
    }
    out.push({ name, type, generation: null, wikiUrl: wikiUrl(name) })
  }
  return out
}

/**
 * Enumerate the legendaries for one category. Follows `{{:Subpage}}`
 * transclusions inside the list section (the weapon list lives in a subpage).
 */
export async function enumerateCategory(
  category: Category,
  listPage: string,
  opts: { noCache?: boolean } = {},
): Promise<{ entries: ListEntry[]; sourcePages: string[] }> {
  const page = await fetchWikitext(listPage, opts)
  const section = sectionUnder(page.wikitext, LIST_HEADING[category])
  const sourcePages = [listPage]
  const entries: ListEntry[] = []

  // Pull in any transcluded subtables (e.g. Legendary weapon/table).
  const subs = transclusions(section)
  for (const sub of subs) {
    const subPage = await fetchWikitext(sub, opts)
    sourcePages.push(sub)
    if (category === 'weapons') entries.push(...parseWeaponTable(subPage.wikitext))
    else entries.push(...parseHeaderRowTable(subPage.wikitext))
  }

  // Parse the inline section too (covers categories without a subpage).
  if (category === 'weapons') entries.push(...parseWeaponTable(section))
  else entries.push(...parseHeaderRowTable(section))

  // De-dupe by name (a name may appear inline and via transclusion).
  const seen = new Set<string>()
  const deduped = entries.filter((e) => {
    const k = e.name.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { entries: deduped, sourcePages: [...new Set(sourcePages)] }
}
