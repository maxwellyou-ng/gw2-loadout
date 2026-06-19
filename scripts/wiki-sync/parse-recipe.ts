// ---------------------------------------------------------------------------
// Recipe extraction (Phase B): parse a single legendary's wiki page into its
// infobox API id + top-level recipe components.
//
// Accuracy policy: when the page has no parseable `{{recipe}}` (achievement
// rewards, armor sets, unusual layouts), we DO NOT guess — the entry is marked
// low-confidence with a note and excluded from the pass/fail gate. The system
// refuses to assert a recipe it isn't sure of.
// ---------------------------------------------------------------------------

import type { Confidence, WikiComponent } from './types'
import { extractTemplates, parseParams, sectionUnder } from './wikitext'

export interface ParsedRecipe {
  apiId: number | null
  components: WikiComponent[]
  confidence: Confidence
  parseNote?: string
}

/** Collapse links/templates in a value to plain text. */
function stripWikitext(s: string): string {
  let t = s
  // {{item icon|Name|alt}} -> Name ; {{item icon|Name}} -> Name
  t = t.replace(/\{\{item icon\|([^}|]+)(?:\|[^}]*)?\}\}/gi, '$1')
  // {{recipe ingredient|Name|qty}} -> qty Name (rare)
  t = t.replace(/\{\{recipe ingredient\|([^}|]+)\|?(\d*)[^}]*\}\}/gi, '$2 $1')
  // generic templates -> drop
  t = t.replace(/\{\{[^}]*\}\}/g, '')
  // [[A|B]] -> B ; [[A]] -> A
  t = t.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
  t = t.replace(/\[\[([^\]]+)\]\]/g, '$1')
  return t.replace(/\s+/g, ' ').trim()
}

/** Turn an ingredient value ("1 Spark (weapon)") into {qty, name}. */
function toComponent(value: string): WikiComponent | null {
  const plain = stripWikitext(value)
  if (!plain) return null
  const m = /^(\d+)\s+(.*)$/.exec(plain)
  if (m) return { qty: parseInt(m[1], 10), name: m[2].trim() }
  return { qty: 1, name: plain }
}

/** Read the infobox API id from the first `{{X infobox}}` on the page. */
function parseApiId(wikitext: string): number | null {
  for (const name of ['Weapon infobox', 'Trinket infobox', 'Back item infobox', 'Armor infobox', 'Item infobox']) {
    const bodies = extractTemplates(wikitext, name)
    if (bodies.length === 0) continue
    const params = parseParams(bodies[0])
    if (params.id && /^\d+$/.test(params.id.trim())) return parseInt(params.id.trim(), 10)
  }
  return null
}

/** Extract components from a single `{{recipe}}` template body. */
function componentsFromRecipe(body: string): WikiComponent[] {
  const params = parseParams(body)
  const comps: WikiComponent[] = []
  for (let n = 1; n <= 12; n++) {
    const ing = params[`ingredient${n}`]
    if (ing) {
      const c = toComponent(ing)
      if (c) comps.push(c)
      continue
    }
    // Alternate `name{n}` / `count{n}` form.
    const nm = params[`name${n}`]
    if (nm) {
      const qty = params[`count${n}`] ? parseInt(params[`count${n}`], 10) || 1 : 1
      const name = stripWikitext(nm)
      if (name) comps.push({ qty, name })
    }
  }
  return comps
}

/**
 * Parse an item page. Prefers the `{{recipe}}` inside the "Recipe" section; the
 * chosen recipe must have a Mystic Forge / crafting source when ambiguous.
 */
export function parseItemPage(wikitext: string): ParsedRecipe {
  const apiId = parseApiId(wikitext)

  // Prefer the recipe under the Recipe heading; fall back to page-wide.
  const recipeSection = sectionUnder(wikitext, 'Recipe')
  const scope = recipeSection || wikitext
  let bodies = extractTemplates(scope, 'recipe')
  if (bodies.length === 0 && scope !== wikitext) {
    bodies = extractTemplates(wikitext, 'recipe')
  }

  if (bodies.length === 0) {
    // Distinguish a genuine vendor-sourced leaf from an unhandled layout. Items
    // bought from a vendor (`{{Sold by}}`) have no craftable `{{recipe}}`, and
    // their cost is rendered by a semantic DB query (no inline, machine-readable
    // params) — so they are correctly leaves, not parse failures. Recording the
    // reason keeps them out of the "unverified recipe" bucket in the report.
    const isVendorSold = extractTemplates(wikitext, 'sold by').length > 0
    return {
      apiId,
      components: [],
      confidence: 'low',
      parseNote: isVendorSold
        ? 'vendor-sold item — no craftable {{recipe}}; cost not machine-readable from {{Sold by}} (leaf material)'
        : 'no {{recipe}} template found (likely achievement reward, set, or non-standard layout)',
    }
  }

  // If several recipes exist, prefer the first whose source is Mystic Forge.
  let chosen = bodies[0]
  for (const b of bodies) {
    const p = parseParams(b)
    if ((p.source ?? '').toLowerCase().includes('mystic forge')) {
      chosen = b
      break
    }
  }

  const components = componentsFromRecipe(chosen)
  if (components.length === 0) {
    return {
      apiId,
      components: [],
      confidence: 'low',
      parseNote: '{{recipe}} found but no ingredients parsed',
    }
  }
  return { apiId, components, confidence: 'high' }
}
