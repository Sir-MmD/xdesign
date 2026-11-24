// The site's members (memberRoutes of @xdesign/api; docs/plan/05 section 1 items 4 and 5): the
// site owner's Members page with disable, enable, remove and turning off two-factor sign-in
// (TFA-01), adding members, setting their passwords and changing their usernames (USER-01b, 18
// section 3.4), and the member search of the Share dialog.
import { routes, type member } from '@xdesign/api'
import { asc, count, eq, isNull } from 'drizzle-orm'
import type { z } from 'zod'

import { audit } from '../audit.ts'
import { emitUserAccessChanged } from '../auth/events.ts'
import { forgetSignInTries } from '../auth/limits.ts'
import { checkNewPassword, hashPassword } from '../auth/passwords.ts'
import { endUserSessions } from '../auth/sessions.ts'
import { turnOffTwoFactor } from '../auth/two-factor.ts'
import { createUser, findUserByUsername, usernameTaken, type UserRow } from '../auth/users.ts'
import { getDb } from '../db/index.ts'
import { designs, users } from '../db/schema.ts'
import { moveDesigns } from '../designs/ownership.ts'
import { ApiError } from '../errors.ts'
import { addRoute, type Register } from '../route.ts'

type Member = z.output<typeof member>

const memberNotFound = 'This member was not found.'
// The Share dialog's search shows this many members at most.
const searchLimit = 20

// The designs each person owns, those in Trash too ("Remove" needs every one moved).
function designCounts(): Map<string, number> {
  const rows = getDb().select({ ownerId: designs.ownerId, n: count() }).from(designs).groupBy(designs.ownerId).all()
  return new Map(rows.map((row) => [row.ownerId, row.n]))
}

function toMember(row: UserRow, designCount: number): Member {
  return {
    id: row.id,
    username: row.username ?? '',
    name: row.name,
    color: row.color,
    isSiteOwner: row.isSiteOwner,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    designCount,
    twoFactor: row.totpSecret !== null,
  }
}

function findMember(userId: string): UserRow {
  const row = getDb().select().from(users).where(eq(users.id, userId)).get()
  if (!row) {
    throw new ApiError('not_found', memberNotFound)
  }
  return row
}

// Who an activity row about a member names, kept also after they are removed.
function about(row: UserRow) {
  return { memberId: row.id, name: row.name, username: row.username }
}

export const register: Register = (app) => {
  addRoute(app, routes.members, () => {
    const counts = designCounts()
    const rows = getDb().select().from(users).orderBy(asc(users.createdAt)).all()
    return { members: rows.map((row) => toMember(row, counts.get(row.id) ?? 0)) }
  })

  // USER-01b "Add member": the account works at once and never expires (Q-57).
  addRoute(
    app,
    routes.addMember,
    async ({ user, body }) => {
      checkNewPassword(body.password)
      const passwordHash = await hashPassword(body.password)
      // Checked once the hash is made, with nothing awaited before the insert, so two adds of
      // one username cannot both pass.
      if (findUserByUsername(body.username)) {
        throw new ApiError('conflict', usernameTaken)
      }
      const row = createUser({ username: body.username, name: body.name, passwordHash })
      audit('member_added', { userId: user.id, detail: about(row) })
      return { member: toMember(row, 0) }
    },
    { confirm: true },
  )

  // By name or username, ignoring case in any script; disabled members are left out.
  addRoute(app, routes.searchMembers, ({ query }) => {
    const words = query.q.toLocaleLowerCase()
    const rows = getDb()
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(isNull(users.disabledAt))
      .all()
      .map((row) => ({ ...row, username: row.username ?? '' }))
    const found = rows
      .filter((row) => row.name.toLocaleLowerCase().includes(words) || row.username.includes(words))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { members: found.slice(0, searchLimit) }
  })

  // "Disable" ends every session at once (and live editing closes the connections); "Enable".
  addRoute(app, routes.updateMember, ({ user, params, body }) => {
    const row = findMember(params.userId)
    if (row.isSiteOwner) {
      throw new ApiError('bad_request', 'The site owner cannot be disabled.')
    }
    if (body.disabled !== (row.disabledAt !== null)) {
      getDb()
        .update(users)
        .set({ disabledAt: body.disabled ? Date.now() : null })
        .where(eq(users.id, row.id))
        .run()
      if (body.disabled) {
        endUserSessions(row.id)
        emitUserAccessChanged({ userId: row.id, reason: 'disabled' })
      }
      audit(body.disabled ? 'member_disabled' : 'member_enabled', { userId: user.id, detail: about(row) })
    }
    return { member: toMember(findMember(row.id), designCounts().get(row.id) ?? 0) }
  })

  // "Remove": once they own no designs, or with "Move their designs to: <member>".
  addRoute(app, routes.removeMember, ({ user, params, body }) => {
    const row = findMember(params.userId)
    if (row.isSiteOwner) {
      throw new ApiError('bad_request', 'The site owner cannot be removed.')
    }
    const owned = designCounts().get(row.id) ?? 0
    const target = body.moveDesignsTo === undefined ? undefined : findMember(body.moveDesignsTo)
    if (target?.id === row.id) {
      throw new ApiError('bad_request', 'Pick another member to move the designs to.')
    }
    if (owned > 0 && !target) {
      throw new ApiError('conflict', 'Move their designs to another member first.')
    }
    const db = getDb()
    const moved = db.transaction(() => {
      const n = target ? moveDesigns(row.id, target.id) : 0
      // Their sessions and design memberships go with them.
      db.delete(users).where(eq(users.id, row.id)).run()
      return n
    })
    emitUserAccessChanged({ userId: row.id, reason: 'removed' })
    if (target && moved > 0) {
      emitUserAccessChanged({ userId: target.id, reason: 'designRole' })
    }
    audit('member_removed', {
      userId: user.id,
      detail: { ...about(row), movedTo: target ? about(target) : null, designsMoved: moved },
    })
    return { ok: true as const }
  })

  // TFA-01: for a member who lost their phone; the site owner turns their own off on the Account
  // page, or with `xdesign admin reset-2fa` on the server.
  addRoute(
    app,
    routes.resetTwoFactor,
    ({ user, params }) => {
      const row = findMember(params.userId)
      if (row.id === user.id) {
        throw new ApiError('bad_request', 'Turn your own two-factor authentication off on your Account page.')
      }
      if (!turnOffTwoFactor(row.id)) {
        throw new ApiError('conflict', 'Two-factor authentication is already off for this member.')
      }
      audit('two_factor_reset', { userId: user.id, detail: about(row) })
      return { member: toMember(findMember(row.id), designCounts().get(row.id) ?? 0) }
    },
    { confirm: true },
  )

  // USER-01b "Set password": they keep it (Q-56). Their sessions end and live editing closes
  // their connections, as "Disable" does; their API keys and connected apps stay. The site owner
  // changes their own on the Account page. USER-02: their username's sign-in limit starts afresh.
  addRoute(
    app,
    routes.setMemberPassword,
    async ({ user, params, body }) => {
      const row = findMember(params.userId)
      if (row.id === user.id) {
        throw new ApiError('bad_request', 'Change your password on the Account page.')
      }
      checkNewPassword(body.password)
      const passwordHash = await hashPassword(body.password)
      // Removed while the hash was made: nobody to set it for.
      const [set] = getDb()
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, row.id))
        .returning({ id: users.id })
        .all()
      if (!set) {
        throw new ApiError('not_found', memberNotFound)
      }
      endUserSessions(row.id)
      if (row.username !== null) {
        forgetSignInTries(row.username)
      }
      audit('password_set', { userId: user.id, detail: about(row) })
      return { ok: true as const }
    },
    { confirm: true },
  )

  // USER-01b "Change username" (Q-71): their password stays and nobody is signed out. The site
  // owner's own works too, as on the Account page.
  addRoute(app, routes.changeUsername, ({ user, params, body }) => {
    const row = findMember(params.userId)
    if (body.username !== row.username) {
      const taken = findUserByUsername(body.username)
      if (taken && taken.id !== row.id) {
        throw new ApiError('conflict', usernameTaken)
      }
      getDb().update(users).set({ username: body.username }).where(eq(users.id, row.id)).run()
      audit('username_changed', {
        userId: user.id,
        detail: { memberId: row.id, name: row.name, from: row.username, to: body.username },
      })
    }
    return { member: toMember(findMember(row.id), designCounts().get(row.id) ?? 0) }
  })
}
