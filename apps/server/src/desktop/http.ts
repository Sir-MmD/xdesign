// What every request to the desktop app's server goes through (docs/plan/18 section 9.3, DESK-01):
// the routes of what the app does not have answer 404 not_in_desktop (notInDesktop of
// @xdesign/api, and the OAuth endpoints of the Claude app and claude.ai), and the app's pages open
// only in its own window: a browser without its session gets "Open xDesign from its app.".
import { notInDesktop, routes, type RouteKey } from '@xdesign/api'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { getSessionUser } from '../auth/context.ts'
import {
  authorizationServerPath,
  authorizePath,
  protectedResourcePath,
  registerPath,
  tokenPath,
} from '../claude/oauth.ts'
import { errorBody } from '../errors.ts'

// The refused routes as `<method> <path>`, the path as Fastify matched it; the OAuth endpoints
// (src/routes/oauth.ts) with any method.
const refusedRoutes = new Set(
  (Object.keys(routes) as RouteKey[])
    .filter((key) => notInDesktop(key))
    .map((key) => `${routes[key].method} ${routes[key].path}`),
)
const refusedPaths = new Set([authorizePath, tokenPath, registerPath, protectedResourcePath, authorizationServerPath])

function refused(request: FastifyRequest): boolean {
  const path = request.routeOptions.url
  if (path === undefined) {
    return false
  }
  // A GET route also answers HEAD.
  const method = request.method === 'HEAD' ? 'GET' : request.method
  return refusedPaths.has(path) || refusedRoutes.has(`${method} ${path}`)
}

// Before any route's own checks: a refused route answers the same to everyone.
export function refuseNotInDesktop(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    if (refused(request)) {
      reply.code(404).header('cache-control', 'no-store').send(errorBody('not_in_desktop'))
      return
    }
    done()
  })
}

// The page of a browser that opens the app's address itself, in the site's colors, light or dark
// as the system is (the desktop app's own pages, apps/desktop/src/pages.ts).
const openFromAppPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<title>xDesign</title>
<style>
:root { color-scheme: light dark; --bg: #fafafa; --text: #0a0a0a; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0a0a0a; --text: #fafafa; }
}
html, body { height: 100%; margin: 0; }
body {
  display: grid; place-items: center; background: var(--bg); color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
main { max-width: 36rem; padding: 2rem; text-align: center; }
.logo { display: block; width: 72px; height: 72px; margin: 0 auto 1.25rem; }
p { margin: 0; }
</style>
</head>
<body><main><svg class="logo" viewBox="0 0 512 512" aria-hidden="true"><defs><linearGradient id="xd-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C2642"/><stop offset="1" stop-color="#0F1424"/></linearGradient><linearGradient id="xd-ink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5CD6FF"/><stop offset="1" stop-color="#3B6FF6"/></linearGradient></defs><path d="M128 24H384A104 104 0 0 1 488 128V384A104 104 0 0 1 384 488H128A104 104 0 0 1 24 384V128A104 104 0 0 1 128 24Z" fill="url(#xd-bg)"/><path d="M106 212L190 300M190 212L106 300" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/><path d="M236 150H312A106 106 0 0 1 312 362H286L232 404L236 362Z" fill="url(#xd-ink)"/><circle cx="282" cy="256" r="15" fill="#0F1424"/><circle cx="324" cy="256" r="15" fill="#0F1424"/><circle cx="366" cy="256" r="15" fill="#0F1424"/></svg><p>Open xDesign from its app.</p></main></body>
</html>
`

export function sendOpenFromApp(reply: FastifyReply): FastifyReply {
  return reply.code(403).header('cache-control', 'no-store').type('text/html; charset=utf-8').send(openFromAppPage)
}

// The SPA's index.html (src/app.ts) only for the app's window, which entered with its key.
export function desktopGate(request: FastifyRequest, reply: FastifyReply): FastifyReply | null {
  return getSessionUser(request) === null ? sendOpenFromApp(reply) : null
}
