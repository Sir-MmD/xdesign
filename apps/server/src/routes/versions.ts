// Version history (versionRoutes of @xdesign/api; docs/plan/05 section 7, 04 section 15): the
// History panel's list, a version's plain design (View, Compare, Export), "Name this version",
// renaming and deleting a named version, and restore through the live document
// (restoreLiveDesign in src/live/server.ts). Automatic versions and their thinning are in
// src/designs/versions.ts.
import { routes, type designVersion } from '@xdesign/api'
import { decodeDoc, readDesign } from '@xdesign/spec'
import { and, desc, eq } from 'drizzle-orm'
import type { z } from 'zod'

import { audit } from '../audit.ts'
import { getDb } from '../db/index.ts'
import { designs, users, versions } from '../db/schema.ts'
import { addStoredVersion } from '../designs/versions.ts'
import { ApiError } from '../errors.ts'
import { flushLiveDesign, restoreLiveDesign, sendToDesign } from '../live/server.ts'
import { addRoute, type Register } from '../route.ts'

type DesignVersion = z.output<typeof designVersion>
type DesignRow = typeof designs.$inferSelect

const versionNotFound = 'This version was not found.'

// The design of a route. The route helper lets the site owner through without a role, so a
// missing design answers 404 here, and so does one in Trash.
function findDesign(designId: string): DesignRow {
  const row = getDb().select().from(designs).where(eq(designs.id, designId)).get()
  if (!row) {
    throw new ApiError('not_found', 'This design was not found.')
  }
  if (row.deletedAt !== null) {
    throw new ApiError('not_found', 'This design is in Trash.')
  }
  return row
}

// Versions with the names of the people who made them, without their state.
function selectVersions() {
  return getDb()
    .select({
      id: versions.id,
      kind: versions.kind,
      name: versions.name,
      createdAt: versions.createdAt,
      createdBy: versions.createdBy,
      createdByName: users.name,
      via: versions.via,
      docVersion: versions.docVersion,
    })
    .from(versions)
    .leftJoin(users, eq(users.id, versions.createdBy))
}

type VersionRow = ReturnType<ReturnType<typeof selectVersions>['all']>[number]

function toVersion(row: VersionRow): DesignVersion {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    createdAt: row.createdAt,
    createdBy: row.createdBy === null ? null : { id: row.createdBy, name: row.createdByName ?? '' },
    via: row.via,
    docVersion: row.docVersion,
  }
}

function findVersion(designId: string, versionId: string): VersionRow {
  const row = selectVersions()
    .where(and(eq(versions.designId, designId), eq(versions.id, versionId)))
    .get()
  if (!row) {
    throw new ApiError('not_found', versionNotFound)
  }
  return row
}

function stateOf(versionId: string): Buffer {
  const row = getDb().select({ state: versions.state }).from(versions).where(eq(versions.id, versionId)).get()
  if (!row) {
    throw new ApiError('not_found', versionNotFound)
  }
  return row.state
}

// Names are unique among a design's named versions, ignoring case: the Claude link finds a version
// by its name (docs/plan/05 section 7 item 6).
function checkName(designId: string, name: string, versionId?: string): void {
  const lower = name.toLocaleLowerCase()
  const taken = getDb()
    .select({ id: versions.id, name: versions.name })
    .from(versions)
    .where(and(eq(versions.designId, designId), eq(versions.kind, 'named')))
    .all()
    .some((row) => row.id !== versionId && row.name?.toLocaleLowerCase() === lower)
  if (taken) {
    throw new ApiError('conflict', 'Another version has this name.')
  }
}

export const register: Register = (app) => {
  // Every role sees the history, newest first.
  addRoute(app, routes.versions, ({ params }) => {
    const design = findDesign(params.id)
    const rows = selectVersions()
      .where(eq(versions.designId, design.id))
      .orderBy(desc(versions.createdAt), desc(versions.id))
      .all()
    return { versions: rows.map(toVersion) }
  })

  addRoute(app, routes.version, ({ params }) => {
    const design = findDesign(params.id)
    const row = findVersion(design.id, params.versionId)
    return { version: toVersion(row), design: readDesign(decodeDoc(stateOf(row.id))) }
  })

  // "Name this version": the open document's changes are saved first, so the version is now.
  addRoute(app, routes.nameVersion, async ({ user, params, body }) => {
    const design = findDesign(params.id)
    await flushLiveDesign(design.id)
    checkName(design.id, body.name)
    const id = addStoredVersion(design.id, 'named', body.name, user.id)
    if (id === null) {
      throw new ApiError('not_found', 'This design was not found.')
    }
    audit('version_named', { userId: user.id, designId: design.id, detail: { versionId: id, name: body.name } })
    return { version: toVersion(findVersion(design.id, id)) }
  })

  addRoute(app, routes.renameVersion, ({ user, params, body }) => {
    const design = findDesign(params.id)
    const row = findVersion(design.id, params.versionId)
    if (row.kind !== 'named') {
      throw new ApiError('conflict', 'Only a named version can be renamed.')
    }
    if (body.name !== row.name) {
      checkName(design.id, body.name, row.id)
      getDb().update(versions).set({ name: body.name }).where(eq(versions.id, row.id)).run()
      audit('version_named', {
        userId: user.id,
        designId: design.id,
        detail: { versionId: row.id, name: body.name, from: row.name },
      })
    }
    return { version: toVersion(findVersion(design.id, row.id)) }
  })

  // Only the design owner deletes, and only named versions (the others go by themselves).
  addRoute(app, routes.deleteVersion, ({ user, params }) => {
    const design = findDesign(params.id)
    const row = findVersion(design.id, params.versionId)
    if (row.kind !== 'named') {
      throw new ApiError('conflict', 'Only a named version can be deleted.')
    }
    getDb().delete(versions).where(eq(versions.id, row.id)).run()
    audit('version_deleted', { userId: user.id, designId: design.id, detail: { versionId: row.id, name: row.name } })
    return { ok: true as const }
  })

  // "Restore this version": the restored document keeps the design's current name.
  addRoute(app, routes.restoreVersion, async ({ user, params }) => {
    const design = findDesign(params.id)
    const row = findVersion(design.id, params.versionId)
    const before = await restoreLiveDesign(design.id, {
      state: stateOf(row.id),
      versionName: row.name,
      designName: design.name,
      userId: user.id,
    })
    if (before === null) {
      throw new ApiError('too_large', 'This version is too big to restore.')
    }
    sendToDesign(design.id, { type: 'versionRestored' })
    audit('version_restored', {
      userId: user.id,
      designId: design.id,
      detail: { versionId: row.id, kind: row.kind, name: row.name, createdAt: row.createdAt },
    })
    return { before: toVersion(findVersion(design.id, before)) }
  })
}
