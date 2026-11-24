// Who may open a live document (docs/plan/02 section 4 item 2, 05 sections 1 and 4): the WebSocket
// upgrade passes AUTH-01's Origin rule and carries a session cookie; each document then needs a
// role on its design (getDesignRole), Commenter and Viewer read-only. After a change of a person's
// access their connections are checked again: closed without a role, connected again read-only
// (or writable) when the role changed that. A view link's socket (VIEW-01, `/live?view=<token>`)
// needs no session: it opens the link's one design read-only while the link works.
import type { IncomingHttpHeaders } from 'node:http'

import cookie from '@fastify/cookie'
import type { Connection } from '@hocuspocus/server'
import { hasRole } from '@xdesign/api'

import { getDesignRole, type SessionUser } from '../auth/context.ts'
import { findSessionUser, sessionCookie } from '../auth/sessions.ts'
import { hashToken } from '../auth/tokens.ts'
import { linkGone, openViewLink, viewLinkWorks } from '../designs/viewLinks.ts'
import { designIdOf } from './docs.ts'
import { viewTokenOf } from './view.ts'

// What a live connection knows of its person, set when its document authenticates: a person
// with the sessions row of the upgrade's cookie, or a view link (VIEW-01) with nobody.
export type LiveContext =
  | { userId: string; sessionId: string; viewLinkId: null; designId: string }
  | { userId: null; sessionId: null; viewLinkId: string; designId: string }

// A refused document or message. Hocuspocus sends `reason` to the editor: as "permission denied"
// for a document that may not open, as the close reason for a closed connection. The message
// stays empty, so Hocuspocus does not print the error.
export class LiveRefusal extends Error {
  readonly reason: string

  constructor(reason: string) {
    super()
    this.reason = reason
  }
}

// The close reason the editor shows when an open design is no longer the person's to open.
const accessLost = { code: 4403, reason: 'You no longer have access to this design.' }

// VIEW-01: the close reason the page of a view link shows once the link was revoked or expired.
const linkLost = { code: 4403, reason: linkGone }

// Hocuspocus's "reset connection" code on the socket: the provider connects again after a moment.
const resetCode = 4205

// The person of a cookie header's `xd_session` (AUTH-01's sessions), or null.
export function sessionUserOfCookie(header: string | null | undefined): SessionUser | null {
  const token = header ? cookie.parse(header)[sessionCookie] : undefined
  return token ? findSessionUser(hashToken(token)) : null
}

// Why an upgrade to `/live` is refused (the HTTP status line), or null when it may go on: it must
// come from the site's own pages (the Origin check of changing requests) with a live session, or
// with a working view link's token in its address (VIEW-01).
export function upgradeRefusal(
  headers: IncomingHttpHeaders,
  url: string | undefined,
  origins: Set<string>,
): string | null {
  if (headers.origin === undefined || !origins.has(headers.origin)) {
    return '403 Forbidden'
  }
  const view = viewTokenOf(url)
  if (view === null ? !sessionUserOfCookie(headers.cookie) : !openViewLink(view)) {
    return '401 Unauthorized'
  }
  return null
}

export interface Admission {
  context: LiveContext
  readOnly: boolean
}

// A document's connection: the session again (it may have ended since the upgrade) and the
// person's role on the design; a design in Trash has none. Throws LiveRefusal "not_signed_in" or
// "no_access". A view link's socket opens its link's design only, read-only.
export function admit(headers: Headers, parameters: URLSearchParams, documentName: string): Admission {
  const designId = designIdOf(documentName)
  const view = parameters.get('view')
  if (view !== null) {
    const link = designId === null ? null : openViewLink(view, designId)
    if (!link) {
      throw new LiveRefusal('no_access')
    }
    return {
      context: { userId: null, sessionId: null, viewLinkId: link.id, designId: link.designId },
      readOnly: true,
    }
  }
  const user = sessionUserOfCookie(headers.get('cookie'))
  if (!user) {
    throw new LiveRefusal('not_signed_in')
  }
  const role = designId === null ? null : getDesignRole(user.id, designId)
  if (designId === null || role === null) {
    throw new LiveRefusal('no_access')
  }
  return {
    context: { userId: user.id, sessionId: user.sessionId, viewLinkId: null, designId },
    readOnly: !hasRole(role, 'editor'),
  }
}

export function contextOf(connection: Connection): LiveContext {
  return connection.context as LiveContext
}

// Checks a connection again: without a session or a role it closes with the reason the editor
// shows; when the role now allows more or less than the connection, the editor connects again
// (read-only at once until then) and authenticates with the new role. A view link's connection
// closes once the link stopped working.
export function recheck(connection: Connection): void {
  const context = contextOf(connection)
  if (context.viewLinkId !== null) {
    if (!viewLinkWorks(context.viewLinkId)) {
      connection.close(linkLost)
    }
    return
  }
  const { userId, sessionId, designId } = context
  const role = findSessionUser(sessionId) ? getDesignRole(userId, designId) : null
  if (role === null) {
    connection.close(accessLost)
    return
  }
  if (!hasRole(role, 'editor') !== connection.readOnly) {
    connection.readOnly = true
    connection.webSocket.close(resetCode, 'role_changed')
  }
}
