// View-only links (docs/plan/05 sections 3 and 8): made, listed and revoked in the Share dialog by
// the design owner (and the site owner); opened without an account on the page `/v/<token>`.
import { z } from 'zod'

import { id, ok, time, token } from '../common.ts'
import { defineRoute } from '../route.ts'

// "Create link"'s expiry choices.
export const viewLinkExpiries = ['1d', '7d', '30d', 'never'] as const
export const viewLinkExpiry = z.enum(viewLinkExpiries)
export type ViewLinkExpiry = z.output<typeof viewLinkExpiry>

// A link that still works, as the Share dialog lists it.
export const viewLink = z.object({
  id,
  createdAt: time,
  // Null for a link that never expires.
  expiresAt: time.nullable(),
  lastUsedAt: time.nullable(),
})

// What the page of a link shows: no names of people but the design owner's.
export const viewedDesign = z.object({
  id,
  name: z.string(),
  ownerName: z.string(),
  // The export's document version (EXP-02).
  docVersion: z.number().int(),
})

const designParams = z.object({ id })

export const viewLinkRoutes = {
  viewLinks: defineRoute({
    key: 'viewLinks',
    method: 'GET',
    path: '/api/designs/:id/view-links',
    params: designParams,
    response: z.object({ links: z.array(viewLink) }),
    auth: { design: 'owner' },
  }),
  // The link is shown once: only its token's hash is kept.
  createViewLink: defineRoute({
    key: 'createViewLink',
    method: 'POST',
    path: '/api/designs/:id/view-links',
    params: designParams,
    body: z.object({ expires: viewLinkExpiry }),
    response: z.object({ link: viewLink, url: z.string() }),
    auth: { design: 'owner' },
  }),
  revokeViewLink: defineRoute({
    key: 'revokeViewLink',
    method: 'DELETE',
    path: '/api/designs/:id/view-links/:linkId',
    params: z.object({ id, linkId: id }),
    response: ok,
    auth: { design: 'owner' },
  }),
  // The page of a link: the design's header. A link that was revoked or expired (or whose design
  // is in Trash) answers not_found with "This link no longer works. ...".
  viewLinkDesign: defineRoute({
    key: 'viewLinkDesign',
    method: 'GET',
    path: '/api/view/:token',
    params: z.object({ token }),
    response: z.object({ design: viewedDesign }),
    auth: 'public',
  }),
}
