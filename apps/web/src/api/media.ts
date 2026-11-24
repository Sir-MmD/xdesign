// The address of an uploaded file (MEDIA-01's mediaFile route, docs/plan/02 section 6). The page
// of a view-only link (VIEW-01) has no session: while it is open its files carry the link's token,
// which opens that one design's files only.
import { routes } from '@xdesign/api'

import { routeUrl } from './client'

let viewToken: string | undefined

/** The token of the view-only link whose page is open (its route sets it before rendering), or undefined. */
export function setViewToken(token: string | undefined): void {
  viewToken = token
}

/** The address of an uploaded file by its ID on the server. */
export function mediaUrl(serverId: string): string {
  return routeUrl(routes.mediaFile, { params: { mediaId: serverId }, query: { view: viewToken } })
}
