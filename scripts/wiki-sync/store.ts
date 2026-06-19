// ---------------------------------------------------------------------------
// Snapshot + baseline file IO. The snapshot/ directory and baseline.json are
// COMMITTED — they are the canonical "what the wiki says" and the acknowledged
// current state. Reconciliation reads these; only wiki:fetch writes snapshots.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Baseline, Category, SnapshotFile } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
export const SNAPSHOT_DIR = join(HERE, 'snapshot')
export const BASELINE_PATH = join(HERE, 'baseline.json')

export function snapshotPath(category: Category): string {
  return join(SNAPSHOT_DIR, `${category}.json`)
}

export function readSnapshot(category: Category): SnapshotFile | null {
  const path = snapshotPath(category)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as SnapshotFile
}

export function writeSnapshot(file: SnapshotFile): void {
  mkdirSync(SNAPSHOT_DIR, { recursive: true })
  writeFileSync(snapshotPath(file.category), JSON.stringify(file, null, 2) + '\n')
}

const EMPTY_BASELINE: Baseline = {
  acknowledgedMissing: [],
  acknowledgedFindings: [],
}

export function readBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) return { ...EMPTY_BASELINE }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline
}

export function writeBaseline(baseline: Baseline): void {
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
}
