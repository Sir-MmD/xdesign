// Who is asking: the signed-in person of a request and their role on a design. The route helper
// (src/route.ts) calls both for every route that is not public.
import type { DesignRole, User } from '@xdesign/api'
import { and, eq } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'

import { getDb } from '../db/index.ts'
import { designMembers, designs, users } from '../db/schema.ts'
import { callUserOf } from './calls.ts'
import { sessionUserOf } from './sessions.ts'

export interface SessionUser extends User {
  // The sessions row of the request's cookie ('' for Claude's in-process call).
  sessionId: string
  // "Confirm it's you" holds until this time (null when never confirmed).
  confirmedUntil: number | null
}

// The person signed in with the request's session cookie, or null when there is none, it ended,
// or the person is disabled (src/auth/sessions.ts). A route Claude runs in-process is the request
// of the key's person instead (src/auth/calls.ts), never with a cookie.
export function getSessionUser(req: FastifyRequest): SessionUser | null {
  const called = callUserOf(req)
  return called === undefined ? sessionUserOf(req) : called
}

export interface RoleOptions {
  // A Trash route (delete, restore, delete forever): the only ones that reach a design in Trash.
  trash?: boolean
}

// The person's role on the design (docs/plan/05 section 2): 'owner' for the site owner and the
// design owner, otherwise their design_members role; null without one, when there is no such
// design or person, and for a design in Trash, which only its design owner and the site owner
// reach, on the Trash routes. A template (TPL-01) gives null to everyone: it is only copied. The
// route helper passes the site owner without asking; live editing (LIVE-01) asks for everyone.
export function getDesignRole(userId: string, designId: string, options: RoleOptions = {}): DesignRole | null {
  const row = getDb()
    .select({
      ownerId: designs.ownerId,
      deletedAt: designs.deletedAt,
      isTemplate: designs.isTemplate,
      isSiteOwner: users.isSiteOwner,
      role: designMembers.role,
    })
    .from(designs)
    .innerJoin(users, eq(users.id, userId))
    .leftJoin(designMembers, and(eq(designMembers.designId, designs.id), eq(designMembers.userId, userId)))
    .where(eq(designs.id, designId))
    .get()
  if (!row || row.isTemplate) {
    return null
  }
  const owner = row.isSiteOwner || row.ownerId === userId
  if (row.deletedAt !== null) {
    return options.trash && owner ? 'owner' : null
  }
  return owner ? 'owner' : row.role
}
