// Layout migrations (docs/plan/03-design-model.md section 3, rule 5). Each entry of the table
// brings a document from its layout to the next one; layout 1 is the first, so it is empty.
import * as Y from 'yjs'

import { designMaps, LAYOUT, type DesignMaps } from './layout.ts'

/** The origin of a migration's transaction. */
export const MIGRATE_ORIGIN = 'migrate'

const migrations: Partial<Record<number, (maps: DesignMaps) => void>> = {}

/** The layout of a document; one without `meta.layout` yet (still syncing) counts as current. */
export function layoutOf(doc: Y.Doc): number {
  const layout = doc.getMap('meta').get('layout')
  return typeof layout === 'number' ? layout : LAYOUT
}

/**
 * Brings an older layout up to date in one transaction with origin `migrate`; the first editor
 * that opens the design runs it. A layout newer than this build throws.
 */
export function migrate(doc: Y.Doc): void {
  const from = layoutOf(doc)
  if (from > LAYOUT)
    throw new Error(`The design has layout ${String(from)}; this xDesign reads up to ${String(LAYOUT)}`)
  if (from === LAYOUT) return
  doc.transact(() => {
    const maps = designMaps(doc)
    for (let layout = from; layout < LAYOUT; layout++) {
      const step = migrations[layout]
      if (!step) throw new Error(`No migration from layout ${String(layout)}`)
      step(maps)
    }
    maps.meta.set('layout', LAYOUT)
  }, MIGRATE_ORIGIN)
}

/** The document in the current layout: itself, or a migrated copy in memory for readers. */
export function migratedView(doc: Y.Doc): Y.Doc {
  if (layoutOf(doc) === LAYOUT) return doc
  const copy = new Y.Doc()
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))
  migrate(copy)
  return copy
}
