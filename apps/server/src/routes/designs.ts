// Designs, Trash, transfer and sharing (designRoutes of @xdesign/api; docs/plan/04 section 3, 05
// sections 2, 3 and 5): the Designs page with its filters and search (every design for the site
// owner), new designs, rename, duplicate, Trash, the site owner's transfer, the Share dialog and
// the import of an export's spec.json.
import { routes, type design, type designCard } from '@xdesign/api'
import { fromSpec } from '@xdesign/spec'
import { and, asc, desc, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { z } from 'zod'

import { audit } from '../audit.ts'
import type { SessionUser } from '../auth/context.ts'
import { emitUserAccessChanged } from '../auth/events.ts'
import { findSiteOwner, type UserRow } from '../auth/users.ts'
import { getDb } from '../db/index.ts'
import { designMembers, designs, users } from '../db/schema.ts'
import { transferDesign } from '../designs/ownership.ts'
import { createDesign, duplicateDesign, importDesign, renameDesign } from '../designs/store.ts'
import { deleteForever } from '../designs/trash.ts'
import { ApiError } from '../errors.ts'
import { maxBytes, recheckDesign, renameLiveDesign } from '../live/server.ts'
import { addRoute, type Register } from '../route.ts'

type Design = z.output<typeof design>
type DesignCard = z.output<typeof designCard>
type DesignRow = typeof designs.$inferSelect

const designNotFound = 'This design was not found.'
const memberNotFound = 'This member was not found.'

// The largest spec.json an import takes; the design it makes must also fit live editing's limit.
const importBodyLimit = 32 * 1024 * 1024

// Who saved the design last, beside its design owner (users).
const editor = alias(users, 'editor')

// Designs with their design owner's and last editor's names, and the person's membership.
function selectDesigns(userId: string) {
  return getDb()
    .select({
      id: designs.id,
      name: designs.name,
      ownerId: designs.ownerId,
      ownerName: users.name,
      createdAt: designs.createdAt,
      updatedAt: designs.updatedAt,
      updatedBy: designs.updatedBy,
      updatedByName: editor.name,
      deletedAt: designs.deletedAt,
      docVersion: designs.docVersion,
      stepCount: designs.stepCount,
      languages: designs.languages,
      memberRole: designMembers.role,
    })
    .from(designs)
    .innerJoin(users, eq(users.id, designs.ownerId))
    .leftJoin(editor, eq(editor.id, designs.updatedBy))
    .leftJoin(designMembers, and(eq(designMembers.designId, designs.id), eq(designMembers.userId, userId)))
}

type ListRow = ReturnType<ReturnType<typeof selectDesigns>['all']>[number]

function toDesign(row: ListRow): Design {
  return {
    id: row.id,
    name: row.name,
    owner: { id: row.ownerId, name: row.ownerName },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy === null ? null : { id: row.updatedBy, name: row.updatedByName ?? '' },
    deletedAt: row.deletedAt,
    docVersion: row.docVersion,
  }
}

function toCard(row: ListRow, user: SessionUser): DesignCard {
  const owner = user.isSiteOwner || row.ownerId === user.id
  return {
    id: row.id,
    name: row.name,
    owner: { id: row.ownerId, name: row.ownerName },
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy === null ? null : { id: row.updatedBy, name: row.updatedByName ?? '' },
    role: owner ? 'owner' : (row.memberRole ?? 'viewer'),
    stepCount: row.stepCount,
    languages: row.languages,
    deletedAt: row.deletedAt,
  }
}

// The editor's header of a design that exists (also the answer of "Use this template").
export function designHeader(designId: string, userId: string): Design {
  const row = selectDesigns(userId).where(eq(designs.id, designId)).get()
  if (!row) {
    throw new ApiError('not_found', designNotFound)
  }
  return toDesign(row)
}

// The design of a route. The route helper lets the site owner through without a role, so a
// missing design (or a template, which only the gallery reaches) answers 404 here; one in Trash
// only on the Trash routes.
export function findDesign(designId: string, trash = false): DesignRow {
  const row = getDb().select().from(designs).where(eq(designs.id, designId)).get()
  if (!row || row.isTemplate) {
    throw new ApiError('not_found', designNotFound)
  }
  if (row.deletedAt !== null && !trash) {
    throw new ApiError('not_found', 'This design is in Trash.')
  }
  return row
}

function findPerson(userId: string): UserRow {
  const row = getDb().select().from(users).where(eq(users.id, userId)).get()
  if (!row) {
    throw new ApiError('not_found', memberNotFound)
  }
  return row
}

// Who an activity row about a member names, kept also after they are removed.
function about(row: Pick<UserRow, 'id' | 'name' | 'username'>) {
  return { memberId: row.id, name: row.name, username: row.username }
}

// Live editing (LIVE-01) checks these people's role on the design again and closes or downgrades
// their connections.
function accessChanged(designId: string, userIds: string[]): void {
  for (const userId of new Set(userIds)) {
    emitUserAccessChanged({ userId, reason: 'designRole', designId })
  }
}

// Everyone who may have the design open: its design owner, its members and the site owner.
function peopleOf(row: DesignRow): string[] {
  const members = getDb()
    .select({ userId: designMembers.userId })
    .from(designMembers)
    .where(eq(designMembers.designId, row.id))
    .all()
  const siteOwner = findSiteOwner()
  return [row.ownerId, ...members.map((member) => member.userId), ...(siteOwner ? [siteOwner.id] : [])]
}

export const register: Register = (app) => {
  // "All" (the site owner: every design; others: their own and those shared with them), "Mine",
  // "Shared with me", "Trash" (their own; the site owner's: all); "Search designs" looks in the
  // names, ignoring case in any script. Templates are in the gallery only.
  addRoute(app, routes.designs, ({ user, query }) => {
    const mine = eq(designs.ownerId, user.id)
    const shared = isNotNull(designMembers.userId)
    const where = {
      all: and(isNull(designs.deletedAt), user.isSiteOwner ? undefined : or(mine, shared)),
      mine: and(isNull(designs.deletedAt), mine),
      shared: and(isNull(designs.deletedAt), shared),
      trash: and(isNotNull(designs.deletedAt), user.isSiteOwner ? undefined : mine),
    }[query.filter]
    const rows = selectDesigns(user.id)
      .where(and(eq(designs.isTemplate, false), where))
      .orderBy(query.filter === 'trash' ? desc(designs.deletedAt) : desc(designs.updatedAt))
      .all()
    const words = query.q?.toLocaleLowerCase() ?? ''
    const found = words ? rows.filter((row) => row.name.toLocaleLowerCase().includes(words)) : rows
    return { designs: found.map((row) => toCard(row, user)) }
  })

  // "New design": every member may create designs; the creator is the design owner.
  addRoute(app, routes.createDesign, ({ user, body }) => {
    const id = createDesign({
      name: body.name,
      ownerId: user.id,
      defaultLanguage: body.defaultLanguage.toLowerCase(),
      languages: body.languages.map((lang) => lang.toLowerCase()),
    })
    audit('design_created', { userId: user.id, designId: id, detail: { name: body.name } })
    return { design: designHeader(id, user.id) }
  })

  // "Import as a new design" (docs/plan/06 section 6): every member may import; the importer is
  // the design owner. fromSpec checks the spec (and migrates older format versions); ID names and
  // texts are kept, every internal ID is new. The files are uploaded by the browser afterwards.
  addRoute(
    app,
    routes.importDesign,
    ({ user, body }) => {
      const result = fromSpec(body.spec)
      if (!result.ok) {
        const [first] = result.problems
        const where = first?.path ? `${first.path} ` : ''
        throw new ApiError(
          'bad_request',
          first ? `This file cannot be imported: ${where}${first.message.replace(/\.$/, '')}.` : undefined,
        )
      }
      // A name the Designs page can show (New design's rule: 1 to 100 characters).
      const name = result.design.name.trim().slice(0, 100) || 'Imported design'
      const id = importDesign({ ...result.design, name }, user.id, maxBytes)
      if (id === null) {
        throw new ApiError('too_large', 'This design is too big to import.')
      }
      audit('design_imported', { userId: user.id, designId: id, detail: { name } })
      return { design: designHeader(id, user.id), files: result.files }
    },
    { bodyLimit: importBodyLimit },
  )

  addRoute(app, routes.design, ({ user, params, role }) => {
    findDesign(params.id)
    return { design: designHeader(params.id, user.id), role }
  })

  addRoute(app, routes.renameDesign, ({ user, params, body }) => {
    const row = findDesign(params.id)
    if (body.name !== row.name) {
      renameDesign(row.id, body.name, user.id)
      renameLiveDesign(row.id, body.name, user.id)
      audit('design_renamed', { userId: user.id, designId: row.id, detail: { from: row.name, to: body.name } })
    }
    return { design: designHeader(row.id, user.id) }
  })

  // Every role may duplicate; the copy is the person's, without the sharing.
  addRoute(app, routes.duplicateDesign, ({ user, params }) => {
    const row = findDesign(params.id)
    const id = duplicateDesign(row.id, row.name, user.id)
    if (id === null) {
      throw new ApiError('not_found', designNotFound)
    }
    audit('design_duplicated', { userId: user.id, designId: id, detail: { fromId: row.id, fromName: row.name } })
    return { design: designHeader(id, user.id) }
  })

  // "Delete": to Trash for 30 days; open editors close (the role is gone outside Trash).
  addRoute(
    app,
    routes.deleteDesign,
    ({ user, params }) => {
      const row = findDesign(params.id, true)
      if (row.deletedAt === null) {
        getDb().update(designs).set({ deletedAt: Date.now() }).where(eq(designs.id, row.id)).run()
        accessChanged(row.id, peopleOf(row))
        // View-only pages of the design close now, not at the next periodic check.
        recheckDesign(row.id)
        audit('design_deleted', { userId: user.id, designId: row.id })
      }
      return { ok: true as const }
    },
    { trash: true },
  )

  addRoute(
    app,
    routes.restoreDesign,
    ({ user, params }) => {
      const row = findDesign(params.id, true)
      if (row.deletedAt !== null) {
        getDb().update(designs).set({ deletedAt: null }).where(eq(designs.id, row.id)).run()
        audit('design_restored', { userId: user.id, designId: row.id })
      }
      return { design: designHeader(row.id, user.id) }
    },
    { trash: true },
  )

  // "Delete forever", only from Trash: the design, its document, sharing and media rows, and the
  // media files no other design uses.
  addRoute(
    app,
    routes.deleteDesignForever,
    ({ user, params }) => {
      const row = findDesign(params.id, true)
      if (row.deletedAt === null) {
        throw new ApiError('conflict', 'This design is not in Trash.')
      }
      deleteForever(row.id)
      audit('design_deleted_forever', { userId: user.id, designId: row.id, detail: { name: row.name } })
      return { ok: true as const }
    },
    { trash: true },
  )

  // The site owner's "Transfer ownership" to another member; the old design owner stays as an
  // Editor.
  addRoute(app, routes.transferDesign, ({ user, params, body }) => {
    const row = findDesign(params.id)
    const target = findPerson(body.userId)
    if (target.id !== row.ownerId) {
      if (target.disabledAt !== null) {
        throw new ApiError('bad_request', 'This member is disabled.')
      }
      const from = findPerson(row.ownerId)
      const db = getDb()
      db.transaction(() => {
        transferDesign(row.id, from.id, target.id, user.id)
      })
      accessChanged(row.id, [from.id, target.id])
      audit('design_transferred', {
        userId: user.id,
        designId: row.id,
        detail: { from: about(from), to: about(target) },
      })
    }
    return { design: designHeader(row.id, user.id) }
  })

  // "People with access": the design owner first as 'owner', then the members in the order added.
  addRoute(app, routes.designMembers, ({ params }) => {
    const row = findDesign(params.id)
    const owner = findPerson(row.ownerId)
    const members = getDb()
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        color: users.color,
        role: designMembers.role,
      })
      .from(designMembers)
      .innerJoin(users, eq(users.id, designMembers.userId))
      .where(eq(designMembers.designId, row.id))
      .orderBy(asc(designMembers.addedAt))
      .all()
      .map((member) => ({ ...member, username: member.username ?? '' }))
    const first = {
      id: owner.id,
      name: owner.name,
      username: owner.username ?? '',
      color: owner.color,
      role: 'owner' as const,
    }
    return { members: [first, ...members] }
  })

  // "Add people" (members of the site only) and a role's drop-down.
  addRoute(app, routes.setDesignMember, ({ user, params, body }) => {
    const row = findDesign(params.id)
    const person = findPerson(params.userId)
    if (person.id === row.ownerId) {
      throw new ApiError('bad_request', 'The design owner cannot be added as a member.')
    }
    const db = getDb()
    const current = db
      .select({ role: designMembers.role })
      .from(designMembers)
      .where(and(eq(designMembers.designId, row.id), eq(designMembers.userId, person.id)))
      .get()
    if (current?.role === body.role) {
      return { ok: true as const }
    }
    if (!current && person.disabledAt !== null) {
      throw new ApiError('bad_request', 'This member is disabled.')
    }
    db.insert(designMembers)
      .values({ designId: row.id, userId: person.id, role: body.role, addedBy: user.id, addedAt: Date.now() })
      .onConflictDoUpdate({ target: [designMembers.designId, designMembers.userId], set: { role: body.role } })
      .run()
    if (current) {
      accessChanged(row.id, [person.id])
      audit('design_member_changed', {
        userId: user.id,
        designId: row.id,
        detail: { ...about(person), role: body.role, before: current.role },
      })
    } else {
      audit('design_member_added', { userId: user.id, designId: row.id, detail: { ...about(person), role: body.role } })
    }
    return { ok: true as const }
  })

  // "Remove" under "People with access": the person's open editor closes.
  addRoute(app, routes.removeDesignMember, ({ user, params }) => {
    const row = findDesign(params.id)
    if (params.userId === row.ownerId) {
      throw new ApiError('bad_request', 'The design owner cannot be removed.')
    }
    const db = getDb()
    const member = db
      .select({ id: users.id, name: users.name, username: users.username, role: designMembers.role })
      .from(designMembers)
      .innerJoin(users, eq(users.id, designMembers.userId))
      .where(and(eq(designMembers.designId, row.id), eq(designMembers.userId, params.userId)))
      .get()
    if (member) {
      db.delete(designMembers)
        .where(and(eq(designMembers.designId, row.id), eq(designMembers.userId, member.id)))
        .run()
      accessChanged(row.id, [member.id])
      audit('design_member_removed', {
        userId: user.id,
        designId: row.id,
        detail: { ...about(member), before: member.role },
      })
    }
    return { ok: true as const }
  })
}
