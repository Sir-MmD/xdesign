// The helper's front on Windows (docs/plan/18 section 8.2, WIN-02): the app listens on a port of
// 127.0.0.1, which other programs of the machine can reach too, so the front adds the header
// X-Xdesign-Proxy with the secret of this start (XD_PROXY_SECRET) to every request it passes. A
// request without it is answered 403 with an empty body, WebSocket upgrades included, and the
// X-Forwarded headers are trusted only with it (as on the Unix socket, src/app.ts).
import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

import type { FastifyInstance } from 'fastify'

const proxyHeader = 'x-xdesign-proxy'

// The answer on a raw socket: an upgrade without the header.
export const notFromFrontResponse = 'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'

// Whether the request came through the helper's front; always without a proxy secret (the Unix
// socket, `make dev`, the desktop app).
export function fromFront(request: IncomingMessage, secret: string | undefined): boolean {
  if (secret === undefined) {
    return true
  }
  const given = request.headers[proxyHeader]
  if (typeof given !== 'string') {
    return false
  }
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// The first onRequest hook with a proxy secret: a request without it is answered 403 with an empty
// body, and its X-Forwarded headers are dropped so that not even its log line trusts them.
export function refuseNotFromFront(app: FastifyInstance, secret: string | undefined): void {
  if (secret === undefined) {
    return
  }
  app.addHook('onRequest', (request, reply, done) => {
    if (fromFront(request.raw, secret)) {
      done()
      return
    }
    const headers = request.raw.headers
    delete headers['x-forwarded-for']
    delete headers['x-forwarded-proto']
    delete headers['x-forwarded-host']
    reply.code(403).send()
  })
}
