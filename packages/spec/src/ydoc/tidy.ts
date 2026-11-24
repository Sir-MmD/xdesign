// Orphan removal (docs/plan/03-design-model.md section 3, rule 4).
import type * as Y from 'yjs'

import { designMaps } from './layout.ts'
import { deleteUnused } from './refs.ts'
import { pruneCopied } from './texts.ts'

/** The origin of tidy's transaction; no undo manager tracks it. */
export const TIDY_ORIGIN = 'tidy'

/**
 * Removes the texts and buttons no step or part uses, and the copied marks of texts edited since;
 * an editor runs it once when it opens a design.
 */
export function tidy(doc: Y.Doc): void {
  doc.transact(() => {
    const maps = designMaps(doc)
    deleteUnused(maps, [...maps.texts.keys()], [...maps.buttons.keys()])
    pruneCopied(maps)
  }, TIDY_ORIGIN)
}
