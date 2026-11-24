// Deleting designs for good (docs/plan/05 section 5): "Delete forever" in Trash, and the daily job
// that deletes designs kept in Trash for more than 30 days the same way.
import { rmSync } from 'node:fs'

import { and, eq, isNotNull, lte } from 'drizzle-orm'

import { audit } from '../audit.ts'
import { getDb } from '../db/index.ts'
import { designs, media } from '../db/schema.ts'
import type { Job } from '../jobs.ts'
import { log } from '../log.ts'
import { mediaPath } from '../media/store.ts'

const dayMs = 24 * 60 * 60 * 1000
const keepMs = 30 * dayMs

// Deletes the design with its document, member, media, comment, comment read, version, view link,
// Claude link and picture rows (their foreign keys cascade), then each of its media files that no
// other media row uses.
export function deleteForever(designId: string): void {
  const db = getDb()
  const hashes = db.transaction(() => {
    const rows = db.selectDistinct({ sha256: media.sha256 }).from(media).where(eq(media.designId, designId)).all()
    db.delete(designs).where(eq(designs.id, designId)).run()
    return rows.map((row) => row.sha256)
  })
  removeUnusedFiles(hashes)
}

// Removes each of these media files that no media row uses (after their rows were deleted).
export function removeUnusedFiles(hashes: readonly string[]): void {
  const db = getDb()
  for (const sha256 of new Set(hashes)) {
    if (db.select({ id: media.id }).from(media).where(eq(media.sha256, sha256)).get()) {
      continue
    }
    // Removed right after the look-up, with no await between, so no other request runs between.
    try {
      rmSync(mediaPath(sha256), { force: true })
    } catch (error) {
      log.warn({ err: error, sha256 }, 'a media file could not be removed')
    }
  }
}

// Deletes the designs in Trash for more than 30 days; the activity row names no person.
export function emptyTrash(now: number): number {
  const old = getDb()
    .select({ id: designs.id, name: designs.name })
    .from(designs)
    .where(and(isNotNull(designs.deletedAt), lte(designs.deletedAt, now - keepMs)))
    .all()
  for (const design of old) {
    deleteForever(design.id)
    audit('design_deleted_forever', { designId: design.id, detail: { name: design.name, by: 'trash' } })
  }
  return old.length
}

export const trashJob: Job = {
  name: 'trash',
  everyMs: dayMs,
  run: () => ({ deleted: emptyTrash(Date.now()) }),
}
