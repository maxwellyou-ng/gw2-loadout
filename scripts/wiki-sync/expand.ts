// ---------------------------------------------------------------------------
// `npm run wiki:expand -- "<Item>"` — Auto-fix Phase 4 driver (read-only).
//
// Recursively expands one legendary's (or any item's) wiki recipe into its
// nested tree, using the on-disk wikitext cache. By default expansion stops at
// the catalog's own vocabulary (`catalogKnownNames`): past that boundary lies
// Mystic-Forge material promotion (ingot→ore, dust chains) the catalog
// deliberately treats as terminal, and following it compounds into meaningless
// quantities. So the default tree mirrors the catalog's modeling granularity and
// flags any wiki component the catalog does NOT model — the actionable signal.
//
//   npm run wiki:expand -- "Bolt"            # tree to the catalog's granularity
//   npm run wiki:expand -- "Bolt" --check    # list wiki components not modeled
//   npm run wiki:expand -- "Gift of Fortune" --deep   # ignore the catalog stop
//   npm run wiki:expand -- "Bolt" --no-cache # force re-download
//
// This NEVER writes recipe files and is NOT part of the build gate — it is a
// maintainer lens for spot-checking trees and driving deeper transcription.
// ---------------------------------------------------------------------------

import { expandWikiRecipe, countNodes, type WikiTreeNode } from './expand-recipe'
import { catalogKnownNames } from './catalog-view'
import { canonComponent } from './aliases'
import { fetchWikitext } from './fetch'

interface Args {
  item: string
  check: boolean
  deep: boolean
  noCache: boolean
}

function parseArgs(argv: string[]): Args {
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const item = argv.filter((a) => !a.startsWith('--')).join(' ').trim()
  return {
    item,
    check: flags.has('--check'),
    deep: flags.has('--deep'),
    noCache: flags.has('--no-cache'),
  }
}

const STOP_LABEL: Record<string, string> = {
  'leaf-no-recipe': 'leaf',
  'base-material': 'catalog-modeled',
  'builder-owned': 'gift (catalog-modeled)',
  cycle: '↺ cycle',
  'max-depth': '✂ max depth',
  'missing-page': '? page missing',
}

function printTree(node: WikiTreeNode, prefix = '', isLast = true, isRoot = true): void {
  const branch = isRoot ? '' : isLast ? '└─ ' : '├─ '
  const tag = node.stop ? `  [${STOP_LABEL[node.stop] ?? node.stop}]` : ''
  const qty = isRoot ? '' : `${node.qty}× `
  console.log(`${prefix}${branch}${qty}${node.name}${tag}`)
  const childPrefix = isRoot ? '' : prefix + (isLast ? '   ' : '│  ')
  node.children.forEach((c, i) => printTree(c, childPrefix, i === node.children.length - 1, false))
}

/** Collect terminal nodes the catalog does not model (genuine gaps / alias needs). */
function unmodeledTerminals(root: WikiTreeNode, known: ReadonlySet<string>): WikiTreeNode[] {
  const out: WikiTreeNode[] = []
  const walk = (n: WikiTreeNode): void => {
    const isTerminal = n.children.length === 0
    if (isTerminal && n.stop !== 'base-material' && n.stop !== 'builder-owned') {
      if (!known.has(canonComponent(n.name))) out.push(n)
    }
    n.children.forEach(walk)
  }
  root.children.forEach(walk)
  return out
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.item) {
    console.error('Usage: npm run wiki:expand -- "<Item name>" [--check] [--deep] [--no-cache]')
    process.exit(2)
  }

  const known = catalogKnownNames()
  // Default: stop at the catalog's vocabulary. --deep ignores it (free crawl,
  // capped, with the compounding caveat printed below).
  const baseMaterials = args.deep ? new Set<string>() : known

  let fetched = 0
  const fetchPage = async (name: string): Promise<string | null> => {
    try {
      const page = await fetchWikitext(name, { noCache: args.noCache })
      if (!page.fromCache) fetched++
      return page.wikitext
    } catch (err) {
      console.warn(`  ! ${name}: ${(err as Error).message}`)
      return null
    }
  }

  if (args.deep) {
    console.log('⚠️  --deep: expanding past the catalog vocabulary. Quantities below base')
    console.log('    materials compound via Mystic-Forge promotion recipes and are NOT')
    console.log('    cost-accurate — use this for structure, not totals.\n')
  }

  console.log(`Expanding "${args.item}" …\n`)
  const tree = await expandWikiRecipe(args.item, {
    fetchPage,
    baseMaterials,
    maxDepth: args.deep ? 6 : 12,
  })
  printTree(tree)
  console.log(`\n${countNodes(tree)} nodes, ${fetched} live fetch${fetched === 1 ? '' : 'es'} (rest cached).`)

  if (tree.stop === 'missing-page') {
    console.error(`\n"${args.item}" — no wiki page found (check spelling / try the exact wiki title).`)
    process.exit(1)
  }

  if (args.check) {
    const gaps = unmodeledTerminals(tree, known)
    console.log('\n── --check: wiki components the catalog does NOT model ──')
    if (gaps.length === 0) {
      console.log('✅ every wiki component resolves to a catalog-modeled name (or an alias).')
    } else {
      console.log('Each is a wiki ingredient with no matching catalog node — a genuine gap,')
      console.log('an alias to add in aliases.ts, or a sub-tree worth transcribing:')
      for (const g of [...gaps].sort((a, b) => a.name.localeCompare(b.name))) {
        const why = g.stop === 'missing-page' ? ' (page missing)' : ''
        console.log(`  • ${g.name}${why}`)
      }
    }
  }
}

main().catch((err) => {
  console.error('wiki:expand failed:', err)
  process.exit(1)
})
