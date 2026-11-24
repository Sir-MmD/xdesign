// Version history (docs/plan/05 section 7): versions hold a design's Yjs state with its
// doc_version. Automatic ones come from live editing's saves (src/live/docs.ts) after 10 minutes
// with changes since the last version, and when the last editor leaves (src/live/server.ts); the
// hourly versions job thins them to one per hour after a day and one per day after a week, and
// deletes them after 90 days. Named versions stay until the design owner deletes them.
import { encodeDoc } from '@xdesign/spec'
import { and, desc, eq, inArray, lt, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type * as Y from 'yjs'

import { callVia } from '../auth/calls.ts'
import { getDb } from '../db/index.ts'
import { designDocs, designs, versions } from '../db/schema.ts'
import type { Job } from '../jobs.ts'

export type VersionKind = (typeof versions.$inferSelect)['kind']

const minuteMs = 60 * 1000
const hourMs = 60 * minuteMs
const dayMs = 24 * hourMs
// An automatic version is made at the first save this long after the last version.
const autoMs = 10 * minuteMs
// Versions other than named ones are deleted after keepMs.
const keepMs = 90 * dayMs
// The thinning job deletes these many rows per statement.
const deleteBatch = 500

export interface NewVersion {
  designId: string
  kind: VersionKind
  name: string | null
  state: Buffer
  docVersion: number
  createdBy: string | null
}

// Inserts a version made now and returns its ID. One made in Claude's call (src/auth/calls.ts)
// names the key it was made through (MCP-01b).
export function insertVersion(version: NewVersion): string {
  const id = nanoid()
  getDb()
    .insert(versions)
    .values({ id, ...version, via: callVia() ?? null, createdAt: Date.now() })
    .run()
  return id
}

function lastVersion(designId: string): { createdAt: number; docVersion: number } | undefined {
  return getDb()
    .select({ createdAt: versions.createdAt, docVersion: versions.docVersion })
    .from(versions)
    .where(eq(versions.designId, designId))
    .orderBy(desc(versions.createdAt))
    .limit(1)
    .get()
}

export interface SavedDoc {
  state: Buffer
  docVersion: number
  // The design's created_at: before its first version, the 10 minutes count from there.
  createdAt: number
  updatedBy: string | null
}

// After a save (in its transaction): an automatic version of the saved state when the last version
// (or the design's creation) is 10 minutes old or more.
export function versionOnSave(designId: string, saved: SavedDoc, now: number): void {
  const since = lastVersion(designId)?.createdAt ?? saved.createdAt
  if (now - since >= autoMs) {
    insertVersion({
      designId,
      kind: 'auto',
      name: null,
      state: saved.state,
      docVersion: saved.docVersion,
      createdBy: saved.updatedBy,
    })
  }
}

// A version of the stored document as it is now, or null when the design has none. The caller
// saves an open document's changes first (flushLiveDesign).
export function addStoredVersion(
  designId: string,
  kind: VersionKind,
  name: string | null,
  userId: string,
): string | null {
  const db = getDb()
  return db.transaction(() => {
    const row = db
      .select({ state: designDocs.state, docVersion: designs.docVersion })
      .from(designDocs)
      .innerJoin(designs, eq(designs.id, designDocs.designId))
      .where(eq(designDocs.designId, designId))
      .get()
    if (!row) {
      return null
    }
    return insertVersion({ designId, kind, name, state: row.state, docVersion: row.docVersion, createdBy: userId })
  })
}

// A version of a document as it is now (an open one may hold changes not saved yet), with the
// design's doc_version.
export function addVersionOf(
  designId: string,
  doc: Y.Doc,
  kind: VersionKind,
  name: string | null,
  userId: string,
): string {
  const row = getDb().select({ docVersion: designs.docVersion }).from(designs).where(eq(designs.id, designId)).get()
  const state = Buffer.from(encodeDoc(doc))
  return insertVersion({ designId, kind, name, state, docVersion: row?.docVersion ?? 0, createdBy: userId })
}

// When the last editor left (their changes are saved): an automatic version of the stored
// document when it changed since the last version.
export function versionOnLeave(designId: string): void {
  const db = getDb()
  db.transaction(() => {
    const row = db
      .select({ state: designDocs.state, docVersion: designs.docVersion, updatedBy: designs.updatedBy })
      .from(designDocs)
      .innerJoin(designs, eq(designs.id, designDocs.designId))
      .where(eq(designDocs.designId, designId))
      .get()
    if (!row || row.docVersion <= (lastVersion(designId)?.docVersion ?? 0)) {
      return
    }
    insertVersion({
      designId,
      kind: 'auto',
      name: null,
      state: row.state,
      docVersion: row.docVersion,
      createdBy: row.updatedBy,
    })
  })
}

// Thinning by UTC hours and days: of the automatic versions older than a day, the newest of each
// hour stays; older than a week, the newest of each day. Every version but the named ones goes
// after 90 days ("Before restore" and restore versions are not thinned). Returns how many went.
export function thinVersions(now: number): number {
  const db = getDb()
  const rows = db
    .select({ id: versions.id, designId: versions.designId, kind: versions.kind, createdAt: versions.createdAt })
    .from(versions)
    .where(and(ne(versions.kind, 'named'), lt(versions.createdAt, now - dayMs)))
    .orderBy(desc(versions.createdAt))
    .all()
  const kept = new Set<string>()
  const gone: string[] = []
  for (const row of rows) {
    if (row.createdAt < now - keepMs) {
      gone.push(row.id)
      continue
    }
    if (row.kind !== 'auto') {
      continue
    }
    const span = row.createdAt < now - 7 * dayMs ? dayMs : hourMs
    const slot = `${row.designId} ${String(span)} ${String(Math.floor(row.createdAt / span))}`
    if (kept.has(slot)) {
      gone.push(row.id)
    } else {
      kept.add(slot)
    }
  }
  for (let at = 0; at < gone.length; at += deleteBatch) {
    db.delete(versions)
      .where(inArray(versions.id, gone.slice(at, at + deleteBatch)))
      .run()
  }
  return gone.length
}

export const versionsJob: Job = {
  name: 'versions',
  everyMs: hourMs,
  run: () => ({ deleted: thinVersions(Date.now()) }),
}
