// View-only links (docs/plan/05 section 8): a link opens its one design read-only without an
// account (the page, the live connection, the media files) while it is not revoked or expired and
// its design is not in Trash. Every use moves its last use, at most once a minute.
import { and, eq, isNull, type SQL } from 'drizzle-orm'

import { hashToken } from '../auth/tokens.ts'
import { getDb } from '../db/index.ts'
import { designs, viewLinks } from '../db/schema.ts'

export type ViewLinkRow = typeof viewLinks.$inferSelect

// What the page shows, and the live connection's close reason, once a link stopped working.
export const linkGone = 'This link no longer works. Ask the person who sent it for a new one.'

const useMs = 60 * 1000

export function linkWorks(row: ViewLinkRow, now: number): boolean {
  return row.revokedAt === null && (row.expiresAt === null || row.expiresAt > now)
}

// The link with its design, when the design is not in Trash.
function findLink(where: SQL): ViewLinkRow | null {
  const row = getDb()
    .select({ link: viewLinks })
    .from(viewLinks)
    .innerJoin(designs, and(eq(designs.id, viewLinks.designId), isNull(designs.deletedAt)))
    .where(where)
    .get()
  return row && linkWorks(row.link, Date.now()) ? row.link : null
}

// The working link of a token (of `designId` when given), its use noted; null otherwise.
export function openViewLink(token: string, designId?: string): ViewLinkRow | null {
  const link = findLink(eq(viewLinks.tokenHash, hashToken(token)))
  if (!link || (designId !== undefined && link.designId !== designId)) {
    return null
  }
  const now = Date.now()
  if (link.lastUsedAt === null || link.lastUsedAt <= now - useMs) {
    getDb().update(viewLinks).set({ lastUsedAt: now }).where(eq(viewLinks.id, link.id)).run()
  }
  return link
}

// Whether a link still opens its design: live editing checks its connections again with it.
export function viewLinkWorks(linkId: string): boolean {
  return findLink(eq(viewLinks.id, linkId)) !== null
}
