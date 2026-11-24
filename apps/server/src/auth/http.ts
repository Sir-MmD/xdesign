// What every request goes through for accounts (docs/plan/02-architecture.md sections 7 and 8):
// the cookie parser, the Origin check of changing requests (CSRF), and the renewed session
// cookie on the way out.
import cookie from '@fastify/cookie'
import type { FastifyInstance } from 'fastify'

import type { Config } from '../config.ts'
import { ApiError } from '../errors.ts'
import { renewSessionCookie } from './sessions.ts'

// Vite's addresses in `make dev`: the browser talks to Vite, which proxies /api to the server.
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']

// Requests that change nothing carry no Origin check.
const safeMethods = new Set(['GET', 'HEAD'])

// The MCP connector (CL-02) is called by programs with an API key, never a session cookie: no
// Origin is needed there, but one that is sent must still be the site's (the MCP spec's check
// against DNS rebinding). So are the OAuth token and registration endpoints (MCP-03a), which the
// Claude app's servers call.
const mcpPath = /^\/(?:mcp|oauth\/token|oauth\/register)(?:[/?]|$)/

// The site's own pages: XD_PUBLIC_URL's origin, and Vite's in `make dev`. Live editing's WebSocket
// upgrades (src/live/) must come from them too.
export function siteOrigins(config: Config): Set<string> {
  return new Set([config.origin, ...(config.dev ? devOrigins : [])])
}

export async function registerAuthHooks(app: FastifyInstance, config: Config): Promise<void> {
  await app.register(cookie)

  // Every other request must come from the site's own pages.
  const origins = siteOrigins(config)
  app.addHook('onRequest', (request, _reply, done) => {
    const origin = request.headers.origin
    const checked = !safeMethods.has(request.method) && !(origin === undefined && mcpPath.test(request.url))
    if (checked && (origin === undefined || !origins.has(origin))) {
      done(new ApiError('bad_origin'))
      return
    }
    done()
  })

  app.addHook('onSend', (request, reply, payload, done) => {
    renewSessionCookie(request, reply)
    done(null, payload)
  })
}
