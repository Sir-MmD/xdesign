// The step count and languages of a design's card (docs/plan/04 section 3), kept on its designs
// row so the Designs page does not open every document. Set at create and duplicate; live editing
// (LIVE-01) calls refreshDesignSummary after each save.
import { readDesign, type Design } from '@xdesign/spec'
import { eq } from 'drizzle-orm'
import type * as Y from 'yjs'

import { getDb } from '../db/index.ts'
import { designs } from '../db/schema.ts'

export interface DesignSummary {
  stepCount: number
  languages: string[]
}

// Notes and sections are drawn on the map but are not steps of the bot; the default language
// comes first.
export function summaryOf(design: Design): DesignSummary {
  const steps = Object.values(design.steps).filter((step) => step.kind !== 'note' && step.kind !== 'frame')
  const { default: first, list } = design.languages
  return { stepCount: steps.length, languages: [first, ...list.filter((lang) => lang !== first)] }
}

export function refreshDesignSummary(designId: string, doc: Y.Doc): void {
  getDb()
    .update(designs)
    .set(summaryOf(readDesign(doc)))
    .where(eq(designs.id, designId))
    .run()
}
