// Design rows with their documents (docs/plan/02 sections 4 and 5): a new design from SPEC-04's
// newDesignDoc, an imported design from docFromDesign, a copy of a design with its media rows (a
// duplicate, a template saved from a design, a design made from a template), and a new name, each
// written with its design_docs row (the Yjs document as one update) in one transaction.
import { decodeDoc, docFromDesign, encodeDoc, newDesignDoc, readDesign, type Design } from '@xdesign/spec'
import { and, eq, ne, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'

import { pictureKind } from '../claude/pictures.ts'
import { getDb } from '../db/index.ts'
import { designDocs, designs, media } from '../db/schema.ts'
import { summaryOf } from './summary.ts'

export interface NewDesign {
  name: string
  ownerId: string
  defaultLanguage: string
  // Every language of the design, the default one included.
  languages: string[]
}

// What one of the server's templates keeps beside its design row (designs.template_meta, TPL-01).
export interface TemplateMeta {
  description: string
}

function docRow(designId: string, doc: Y.Doc, now: number) {
  const state = Buffer.from(encodeDoc(doc))
  return { designId, state, stateBytes: state.length, savedAt: now }
}

// Inserts the design row (its card's summary read from the document) and its document; with
// `template`, the row is one of the server's templates. Runs inside the caller's transaction.
function insertDesign(id: string, name: string, ownerId: string, doc: Y.Doc, template?: TemplateMeta): void {
  const db = getDb()
  const now = Date.now()
  db.insert(designs)
    .values({
      id,
      name,
      ownerId,
      createdAt: now,
      updatedAt: now,
      updatedBy: ownerId,
      ...summaryOf(readDesign(doc)),
      ...(template && { isTemplate: true, templateMeta: template }),
    })
    .run()
  db.insert(designDocs)
    .values(docRow(id, doc, now))
    .run()
}

// "New design": `/start` and an empty "Main menu"; the creator is the design owner. Returns its ID.
export function createDesign(design: NewDesign): string {
  const id = nanoid()
  const doc = newDesignDoc({
    id,
    name: design.name,
    defaultLanguage: design.defaultLanguage,
    languages: design.languages,
  })
  const db = getDb()
  db.transaction(() => {
    insertDesign(id, design.name, design.ownerId, doc)
  })
  return id
}

// "Import as a new design" (docs/plan/06 section 6): the design fromSpec read, under a new ID and
// owned by `ownerId`. Its media items keep an empty `serverId` until the importer's browser has
// uploaded the files. Returns the new ID, or null when the document's state would be bigger than
// `maxBytes` (live editing refuses bigger documents).
export function importDesign(design: Design, ownerId: string, maxBytes: number): string | null {
  const id = nanoid()
  const doc = docFromDesign({ ...design, id })
  if (encodeDoc(doc).length > maxBytes) {
    return null
  }
  const db = getDb()
  db.transaction(() => {
    insertDesign(id, design.name, ownerId, doc)
  })
  return id
}

// The stored document of a design, or null when it has none.
function readDoc(designId: string): Y.Doc | null {
  const row = getDb()
    .select({ state: designDocs.state })
    .from(designDocs)
    .where(eq(designDocs.designId, designId))
    .get()
  return row ? decodeDoc(row.state) : null
}

// A copy of the stored document under a new design named `copyName`, owned by `ownerId`, without
// sharing; with `template`, the copy is one of the server's templates. The media rows are copied
// with new IDs (the files are kept by their SHA-256, so nothing is copied on disk) and the copy's
// media items point to them; the picture cache is not copied. Returns the copy's ID, or null when
// the design has no document.
export function copyDesign(
  designId: string,
  copyName: string,
  ownerId: string,
  template?: TemplateMeta,
): string | null {
  const doc = readDoc(designId)
  if (!doc) {
    return null
  }
  const db = getDb()
  const id = nanoid()
  const copies = new Map(
    db
      .select()
      .from(media)
      .where(and(eq(media.designId, designId), ne(media.kind, pictureKind)))
      .all()
      .map((row) => [row.id, { ...row, id: nanoid(), designId: id }]),
  )
  // The layout of docs/plan/03 section 3: meta holds the design's ID and name, each media item
  // the server's media ID as `serverId`.
  doc.transact(() => {
    const meta = doc.getMap('meta')
    meta.set('id', id)
    meta.set('name', copyName)
    for (const item of doc.getMap('media').values()) {
      if (!(item instanceof Y.Map)) {
        continue
      }
      const copy = copies.get(String(item.get('serverId')))
      if (copy) {
        item.set('serverId', copy.id)
      }
    }
  })
  db.transaction(() => {
    insertDesign(id, copyName, ownerId, doc, template)
    if (copies.size > 0) {
      db.insert(media)
        .values([...copies.values()])
        .run()
    }
  })
  return id
}

// "Duplicate": a copy named "<name> (copy)".
export function duplicateDesign(designId: string, name: string, ownerId: string): string | null {
  return copyDesign(designId, `${name} (copy)`, ownerId)
}

// "Rename": the row's name and the document's (meta.name), saved as a change by `userId`.
export function renameDesign(designId: string, name: string, userId: string): void {
  const db = getDb()
  const now = Date.now()
  const doc = readDoc(designId)
  doc?.getMap('meta').set('name', name)
  db.transaction(() => {
    if (doc) {
      db.update(designDocs)
        .set(docRow(designId, doc, now))
        .where(eq(designDocs.designId, designId))
        .run()
    }
    db.update(designs)
      .set({ name, updatedAt: now, updatedBy: userId, docVersion: sql`${designs.docVersion} + 1` })
      .where(eq(designs.id, designId))
      .run()
  })
}
