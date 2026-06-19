// ---------------------------------------------------------------------------
// Minimal, dependency-free wikitext helpers. We parse raw wikitext (not HTML)
// because the GW2 wiki's templates are far more stable than rendered markup.
// ---------------------------------------------------------------------------

/**
 * Extract the raw bodies of every `{{name ...}}` template in `text`, with
 * balanced-brace matching so nested templates inside parameters are preserved.
 * The returned body excludes the outer `{{` `}}` and the leading template name.
 */
export function extractTemplates(text: string, name: string): string[] {
  const out: string[] = []
  // Template names are case-insensitive on MediaWiki ({{Recipe}} === {{recipe}}).
  const lower = text.toLowerCase()
  const needle = ('{{' + name).toLowerCase()
  let i = 0
  while (i < text.length) {
    const start = lower.indexOf(needle, i)
    if (start === -1) break
    // The template name ends here: skip any trailing whitespace, then the next
    // char MUST be a param pipe `|` or the closing `}`. This rejects both
    // `{{recipementum}}` (no boundary) AND `{{recipe list}}` (a DIFFERENT
    // template — "recipe list" — whose name merely shares the `recipe` prefix;
    // matching it as `{{recipe}}` was yielding empty, "no ingredients" recipes).
    let k = start + needle.length
    while (k < text.length && (text[k] === ' ' || text[k] === '\t' || text[k] === '\n' || text[k] === '\r')) k++
    const after = text[k]
    if (after !== '|' && after !== '}') {
      i = start + needle.length
      continue
    }
    let depth = 0
    let j = start
    for (; j < text.length - 1; j++) {
      if (text[j] === '{' && text[j + 1] === '{') {
        depth++
        j++
      } else if (text[j] === '}' && text[j + 1] === '}') {
        depth--
        j++
        if (depth === 0) {
          j++
          break
        }
      }
    }
    const block = text.slice(start, j) // includes {{ … }}
    out.push(block.slice(2 + name.length, block.length - 2))
    i = j
  }
  return out
}

/**
 * Split a template body into `key -> value` parameters, respecting nested
 * `{{}}` and `[[]]` so a `|` inside a link/template doesn't split a param.
 * Positional (unnamed) params are keyed "1", "2", … .
 */
export function parseParams(body: string): Record<string, string> {
  const params: Record<string, string> = {}
  const parts: string[] = []
  let depthC = 0
  let depthB = 0
  let buf = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    const c2 = body[i + 1]
    if (c === '{' && c2 === '{') {
      depthC++
      buf += '{{'
      i++
    } else if (c === '}' && c2 === '}') {
      depthC--
      buf += '}}'
      i++
    } else if (c === '[' && c2 === '[') {
      depthB++
      buf += '[['
      i++
    } else if (c === ']' && c2 === ']') {
      depthB--
      buf += ']]'
      i++
    } else if (c === '|' && depthC === 0 && depthB === 0) {
      parts.push(buf)
      buf = ''
    } else {
      buf += c
    }
  }
  parts.push(buf)

  let positional = 0
  for (const part of parts) {
    const eq = indexOfTopLevelEquals(part)
    if (eq === -1) {
      const v = part.trim()
      if (v) params[String(++positional)] = v
    } else {
      const key = part.slice(0, eq).trim().toLowerCase()
      const value = part.slice(eq + 1).trim()
      if (key) params[key] = value
    }
  }
  return params
}

/** Index of the first `=` not inside a nested template/link. */
function indexOfTopLevelEquals(s: string): number {
  let depthC = 0
  let depthB = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const c2 = s[i + 1]
    if (c === '{' && c2 === '{') {
      depthC++
      i++
    } else if (c === '}' && c2 === '}') {
      depthC--
      i++
    } else if (c === '[' && c2 === '[') {
      depthB++
      i++
    } else if (c === ']' && c2 === ']') {
      depthB--
      i++
    } else if (c === '=' && depthC === 0 && depthB === 0) {
      return i
    }
  }
  return -1
}

/**
 * Pull the section of wikitext under a heading (any `== … ==` level) up to the
 * next heading of the same-or-higher level. Returns '' if the heading is absent.
 */
export function sectionUnder(text: string, headingText: string): string {
  const re = new RegExp(
    `^(={2,6})\\s*${escapeRe(headingText)}\\s*\\1\\s*$`,
    'm',
  )
  const m = re.exec(text)
  if (!m) return ''
  const level = m[1].length
  const start = m.index + m[0].length
  const rest = text.slice(start)
  const next = new RegExp(`^={2,${level}}[^=].*?={2,${level}}\\s*$`, 'm').exec(rest)
  return next ? rest.slice(0, next.index) : rest
}

/** All page titles transcluded via `{{:Page}}` (whole-page transclusion). */
export function transclusions(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\{\{:\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}/g)) {
    out.push(m[1].trim())
  }
  return out
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
