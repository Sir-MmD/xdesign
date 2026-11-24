// View-only links (viewLinkRoutes of @xdesign/api; docs/plan/05 sections 3 and 8): the design
// owner (and the site owner) makes, lists and revokes them in the Share dialog; the page of a link
// reads its design's header without a session. A link is shown once (only its token's hash is
// kept); revoking it closes its open pages at once.
import { routes, type viewLink, type ViewLinkExpiry } from '@xdesign/api'
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { z } from 'zod'

import { audit } from '../audit.ts'
import { hashToken, newToken } from '../auth/tokens.ts'
import { config } from '../config.ts'
import { getDb } from '../db/index.ts'
import { designs, users, viewLinks } from '../db/schema.ts'
import { linkGone, openViewLink, type ViewLinkRow } from '../designs/viewLinks.ts'
import { ApiError } from '../errors.ts'
import { recheckDesign } from '../live/server.ts'
import { addRoute, type Register } from '../route.ts'

const dayMs = 24 * 60 * 60 * 1000
const expiryMs: Record<ViewLinkExpiry, number | null> = {
  '1d': dayMs,
  '7d': 7 * dayMs,
  '30d': 30 * dayMs,
  never: null,
}

function toViewLink(row: ViewLinkRow): z.output<typeof viewLink> {
  return { id: row.id, createdAt: row.createdAt, expiresAt: row.expiresAt, lastUsedAt: row.lastUsedAt }
}

// The route helper lets the site owner through without a role, so a missing design answers 404
// here, and so does one in Trash (its links do not work there).
function checkDesign(designId: string): void {
  const row = getDb().select({ deletedAt: designs.deletedAt }).from(designs).where(eq(designs.id, designId)).get()
  if (!row) {
    throw new ApiError('not_found', 'This design was not found.')
  }
  if (row.deletedAt !== null) {
    throw new ApiError('not_found', 'This design is in Trash.')
  }
}

export const register: Register = (app) => {
  // The links that still work, newest first.
  addRoute(app, routes.viewLinks, ({ params }) => {
    checkDesign(params.id)
    const now = Date.now()
    const rows = getDb()
      .select()
      .from(viewLinks)
      .where(
        and(
          eq(viewLinks.designId, params.id),
          isNull(viewLinks.revokedAt),
          or(isNull(viewLinks.expiresAt), gt(viewLinks.expiresAt, now)),
        ),
      )
      .orderBy(desc(viewLinks.createdAt))
      .all()
    return { links: rows.map(toViewLink) }
  })

  addRoute(app, routes.createViewLink, ({ user, params, body }) => {
    checkDesign(params.id)
    const token = newToken()
    const now = Date.now()
    const ms = expiryMs[body.expires]
    const row = getDb()
      .insert(viewLinks)
      .values({
        id: nanoid(),
        designId: params.id,
        tokenHash: hashToken(token),
        createdBy: user.id,
        createdAt: now,
        expiresAt: ms === null ? null : now + ms,
      })
      .returning()
      .get()
    audit('view_link_created', {
      userId: user.id,
      designId: params.id,
      detail: { linkId: row.id, expires: body.expires },
    })
    return { link: toViewLink(row), url: `${config.publicUrl}/v/${token}` }
  })

  addRoute(app, routes.revokeViewLink, ({ user, params }) => {
    const row = getDb()
      .select()
      .from(viewLinks)
      .where(and(eq(viewLinks.id, params.linkId), eq(viewLinks.designId, params.id)))
      .get()
    if (!row) {
      throw new ApiError('not_found', 'This link was not found.')
    }
    if (row.revokedAt === null) {
      getDb().update(viewLinks).set({ revokedAt: Date.now() }).where(eq(viewLinks.id, row.id)).run()
      audit('view_link_revoked', { userId: user.id, designId: params.id, detail: { linkId: row.id } })
      // Its open pages show "This link no longer works." at once.
      recheckDesign(params.id)
    }
    return { ok: true as const }
  })

  // The page of a link: the design's name and its design owner's, nobody else's.
  addRoute(app, routes.viewLinkDesign, ({ params }) => {
    const link = openViewLink(params.token)
    const row = link
      ? getDb()
          .select({ id: designs.id, name: designs.name, ownerName: users.name, docVersion: designs.docVersion })
          .from(designs)
          .innerJoin(users, eq(users.id, designs.ownerId))
          .where(eq(designs.id, link.designId))
          .get()
      : undefined
    if (!row) {
      throw new ApiError('not_found', linkGone)
    }
    return { design: row }
  })
}
