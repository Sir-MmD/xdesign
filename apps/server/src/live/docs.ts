// The rows behind live documents (docs/plan/02 section 4 item 3): a design's Yjs document is
// loaded from design_docs.state and saved back in one transaction with the design's doc_version,
// updated_at, updated_by, card summary and, every 10 minutes of changes, an automatic version
// (HIST-01, src/designs/versions.ts).
import { decodeDoc, encodeDoc } from '@xdesign/spec'
import { eq, sql } from 'drizzle-orm'
import type * as Y from 'yjs'

import { getDb } from '../db/index.ts'
import { designDocs, designs, users } from '../db/schema.ts'
import { refreshDesignSummary } from '../designs/summary.ts'
import { versionOnSave } from '../designs/versions.ts'
import { log } from '../log.ts'

// A design's live document is named `design:<designs.id>`.
const prefix = 'design:'

export function docNameOf(designId: string): string {
  return prefix + designId
}

// The design ID in a document name, or null for any other name.
export function designIdOf(documentName: string): string | null {
  const designId = documentName.startsWith(prefix) ? documentName.slice(prefix.length) : ''
  return designId === '' ? null : designId
}

export interface StoredDoc {
  doc: Y.Doc
  // The size of the stored state (state_bytes).
  bytes: number
}

// The stored document of a design, or null when it has none.
export function loadDoc(designId: string): StoredDoc | null {
  const row = getDb()
    .select({ state: designDocs.state, bytes: designDocs.stateBytes })
    .from(designDocs)
    .where(eq(designDocs.designId, designId))
    .get()
  return row ? { doc: decodeDoc(row.state), bytes: row.bytes } : null
}

// Saves the document as a change by `userId`, the last person who changed it (updated_by stays as
// it was without one, or once they are no longer on the site). Returns the size of the state.
export function saveDoc(designId: string, doc: Y.Doc, userId: string | undefined): number {
  const db = getDb()
  const state = Buffer.from(encodeDoc(doc))
  const now = Date.now()
  const person =
    userId === undefined ? undefined : db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get()
  db.transaction(() => {
    db.update(designDocs)
      .set({ state, stateBytes: state.length, savedAt: now })
      .where(eq(designDocs.designId, designId))
      .run()
    // No row once the design is gone.
    const [saved] = db
      .update(designs)
      .set({
        docVersion: sql`${designs.docVersion} + 1`,
        updatedAt: now,
        ...(person ? { updatedBy: person.id } : {}),
      })
      .where(eq(designs.id, designId))
      .returning({ docVersion: designs.docVersion, createdAt: designs.createdAt, updatedBy: designs.updatedBy })
      .all()
    // A document that does not read as a design (development builds check it) keeps the cards'
    // last summary; the document itself is still saved.
    try {
      refreshDesignSummary(designId, doc)
    } catch (error) {
      log.warn({ err: error, designId }, 'the card summary of a live document was not updated')
    }
    if (saved) {
      versionOnSave(designId, { state, ...saved }, now)
    }
  })
  return state.length
}
