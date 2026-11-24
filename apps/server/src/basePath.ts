// The secret path (docs/plan/16 section 4): the whole site is served under XD_BASE_PATH, as in
// xWriter. A request under it is routed as if the base were the root (`<base>api/health` is
// `/api/health`, so every route keeps its path); the base without its last slash redirects to it;
// the two OAuth metadata addresses with the path after the well-known name (MCP-03a, RFC 9728 and
// RFC 8414: `/.well-known/oauth-protected-resource/<path>/mcp` and
// `/.well-known/oauth-authorization-server/<path>`, exactly, which only someone who knows the path
// can name) are routed as their addresses under it; every other address answers the empty page,
// which tells a stranger nothing (an empty 404 body would make Chrome show its own error page
// instead).
import type { IncomingMessage } from 'node:http'

import type { FastifyInstance } from 'fastify'

export const emptyPage = '<!doctype html><title></title>'

// The empty page on a raw socket: the answer to a WebSocket upgrade outside the live path.
export const emptyPageResponse =
  'HTTP/1.1 404 Not Found\r\nContent-Type: text/html; charset=utf-8\r\n' +
  `Content-Length: ${String(emptyPage.length)}\r\nConnection: close\r\n\r\n${emptyPage}`

// The requests outside the base path: the address to redirect to, or null for the empty page.
const outside = new WeakMap<IncomingMessage, string | null>()

// Fastify's rewriteUrl: a request under the base path loses the base but its last slash, and so do
// the two metadata addresses (src/routes/oauth.ts names them without the path); any other is marked
// for answerOutside and goes on as `/` (a bad address there is not Fastify's 400). With the base
// `/` every address is under it.
export function rewriteUrlOf(basePath: string): (request: IncomingMessage) => string {
  const bare = basePath.slice(0, -1)
  const metadata = new Map([
    [`/.well-known/oauth-protected-resource${bare}/mcp`, '/.well-known/oauth-protected-resource/mcp'],
    [`/.well-known/oauth-authorization-server${bare}`, '/.well-known/oauth-authorization-server'],
  ])
  return (request) => {
    const url = request.url ?? ''
    if (url.startsWith(basePath)) {
      return url.slice(bare.length)
    }
    const query = url.indexOf('?')
    const path = query === -1 ? url : url.slice(0, query)
    const inner = metadata.get(path)
    if (inner !== undefined) {
      return inner + url.slice(path.length)
    }
    outside.set(request, path === bare ? basePath + url.slice(path.length) : null)
    return '/'
  }
}

// A request outside the base path never reaches the routes: the first onRequest hook answers it.
export function isOutside(request: IncomingMessage): boolean {
  return outside.has(request)
}

// The answers outside the base path: the base without its last slash (its query kept) redirects
// to the base; anything else is the empty page, with no header that names the site.
export function answerOutside(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    const redirect = outside.get(request.raw)
    if (redirect === undefined) {
      done()
      return
    }
    if (redirect !== null) {
      reply.redirect(redirect, 308)
      return
    }
    reply.code(404).type('text/html; charset=utf-8').send(emptyPage)
  })
}
