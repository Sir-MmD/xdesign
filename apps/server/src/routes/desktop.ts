// The desktop app's way in (docs/plan/18 section 9.3, DESK-01): its window opens
// /api/desktop/enter with the header X-Xdesign-Desktop and the key its shell gave the server
// (XD_DESKTOP_KEY); the right key signs the window in as the app's one person and goes on to the
// designs, anything else gets the page "Open xDesign from its app.". Not a route of @xdesign/api:
// it answers a redirect or a page. Registered only in desktop mode; a server answers 404.
import { createHash, timingSafeEqual } from 'node:crypto'

import type { FastifyRequest } from 'fastify'

import { startSession } from '../auth/sessions.ts'
import { findSiteOwner } from '../auth/users.ts'
import { config, type DesktopConfig } from '../config.ts'
import { sendOpenFromApp } from '../desktop/http.ts'
import type { Register } from '../route.ts'

const enterPath = '/api/desktop/enter'

function digest(text: string): Buffer {
  return createHash('sha256').update(text).digest()
}

// The header against the key, in constant time (their SHA-256, of the same length).
function keyMatches(req: FastifyRequest, desktop: DesktopConfig): boolean {
  const given = req.headers['x-xdesign-desktop']
  return typeof given === 'string' && timingSafeEqual(digest(given), digest(desktop.key))
}

export const register: Register = (app) => {
  const { desktop } = config
  if (desktop === null) {
    return
  }
  // GET only: a HEAD never signs in.
  app.get(enterPath, { exposeHeadRoute: false }, (req, reply) => {
    const person = findSiteOwner()
    if (!keyMatches(req, desktop) || person === undefined) {
      return sendOpenFromApp(reply)
    }
    startSession(req, reply, person.id)
    return reply.header('cache-control', 'no-store').redirect(config.basePath, 302)
  })
}
