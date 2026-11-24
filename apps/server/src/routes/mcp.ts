// The MCP connector's address (docs/plan/06 section 7.2, 17 section 13.4): `/mcp`, the Streamable
// HTTP transport of @modelcontextprotocol/sdk with sessions (MCP-01a), so the server can ask the
// person in the middle of a call (MCP-01b). `POST` with an initialize request starts a session
// with a server of its tools (src/claude/mcp.ts) and answers its ID in `Mcp-Session-Id`; the
// session's other requests send it back: `POST` for calls (answered as a stream of events), `GET`
// for the server's own stream, `DELETE` to end it. A session belongs to the key (or connected app)
// that started it, and ends after an hour without calls. Every request carries a personal API key
// or (MCP-03a) a connected app's access token as `Authorization: Bearer <key>`, never a cookie;
// without a working one it answers 401 before the body is read, with the address of the protected
// resource's metadata where the Claude app finds how to connect (RFC 9728 section 5.1), and a body
// too large for a file within the site's upload limit (MCP-02b) 413. The Origin check of
// src/auth/http.ts lets requests without an Origin through here.
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import type { Via } from '../auth/calls.ts'
import { bearerOf, keyUserOf, type KeyUser } from '../claude/keys.ts'
import { mcpServer, type Caller } from '../claude/mcp.ts'
import { appUserOf, resourceMetadataUrl } from '../claude/oauth.ts'
import { config } from '../config.ts'
import { ApiError } from '../errors.ts'
import type { Register } from '../route.ts'
import { readSettings } from '../settings.ts'

const path = '/mcp'

const minuteMs = 60 * 1000
// A session without calls for this long ends.
const sessionIdleMs = 60 * minuteMs
const sweepMs = 5 * minuteMs
// A key (or app) keeps at most this many sessions: a new one ends its oldest.
const maxKeySessions = 10

const mb = 1024 * 1024
// A call's body (MCP-02b): a file sent as base64 within the site's upload limit (a third bigger),
// or spec.json up to the import route's 32 MB, with room for the rest of the call; never more
// than a JSON text Node reads whole.
const importBytes = 32 * mb
const maxBodyBytes = 511 * mb

function bodyLimit(): number {
  const file = Math.ceil((readSettings().uploadLimitMb * mb * 4) / 3)
  return Math.min(Math.max(file, importBytes) + mb, maxBodyBytes)
}

// The headers the transport reads; the request's body is the one Fastify parsed.
const passedHeaders = ['accept', 'content-type', 'mcp-protocol-version', 'mcp-session-id', 'last-event-id']

function webRequest(req: FastifyRequest): Request {
  const headers = new Headers()
  for (const name of passedHeaders) {
    const value = req.headers[name]
    if (value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
  }
  return new Request(new URL(req.url, 'http://localhost'), { method: req.method, headers })
}

interface Session {
  server: McpServer
  transport: WebStandardStreamableHTTPServerTransport
  caller: Caller
  startedAt: number
  // The last call (POST).
  usedAt: number
}

const sessions = new Map<string, Session>()

function endSession(session: Session): void {
  void session.server.close()
}

// Ends the sessions without calls for an hour.
function sweep(): void {
  const now = Date.now()
  for (const session of sessions.values()) {
    if (now - session.usedAt > sessionIdleMs) {
      endSession(session)
    }
  }
}

function sameVia(a: Via, b: Via): boolean {
  return a.kind === b.kind && a.id === b.id
}

// A new session's server and transport; it is kept once its initialize request gave it an ID.
async function startSession(key: KeyUser, app: FastifyInstance): Promise<Session> {
  const now = Date.now()
  const caller: Caller = { key }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      const own = [...sessions.values()]
        .filter((other) => sameVia(other.caller.key.via, key.via))
        .sort((a, b) => a.startedAt - b.startedAt)
      for (const old of own.slice(0, Math.max(0, own.length - maxKeySessions + 1))) {
        endSession(old)
      }
      sessions.set(id, session)
    },
  })
  const server = mcpServer(caller, app)
  const session: Session = { server, transport, caller, startedAt: now, usedAt: now }
  transport.onclose = () => {
    if (transport.sessionId !== undefined) {
      sessions.delete(transport.sessionId)
    }
  }
  await server.connect(transport)
  return session
}

// The session a request names, when it is the key's; the transport answers a request without one.
function sessionOf(req: FastifyRequest, key: KeyUser): Session | null | undefined {
  const id = req.headers['mcp-session-id']
  if (typeof id !== 'string') {
    return undefined
  }
  const session = sessions.get(id)
  return session && sameVia(session.caller.key.via, key.via) ? session : null
}

// The transport's answer as Fastify's reply: a stream of events stays open as long as the
// transport writes to it.
async function sendAnswer(reply: FastifyReply, answer: Response): Promise<FastifyReply> {
  reply.code(answer.status)
  answer.headers.forEach((value, name) => {
    reply.header(name, value)
  })
  if (!answer.headers.has('cache-control')) {
    reply.header('cache-control', 'no-store')
  }
  if (answer.body === null) {
    return reply.send()
  }
  if (answer.headers.get('content-type')?.startsWith('text/event-stream') === true) {
    return reply.send(Readable.fromWeb(answer.body))
  }
  return reply.send(await answer.text())
}

// A session ID that is not (or no longer) the key's: the client starts a new session.
function sessionGone(reply: FastifyReply): FastifyReply {
  return reply
    .code(404)
    .header('cache-control', 'no-store')
    .send({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: null })
}

const keys = new WeakMap<FastifyRequest, KeyUser>()

function keyOf(req: FastifyRequest): KeyUser {
  const key = keys.get(req)
  if (!key) {
    throw new ApiError('not_signed_in')
  }
  return key
}

export const register: Register = (app) => {
  const timer = setInterval(sweep, sweepMs)
  timer.unref()
  // Before the requests in flight are waited for: a session's open streams would hold them.
  app.addHook('preClose', async () => {
    clearInterval(timer)
    await Promise.all([...sessions.values()].map((session) => session.server.close()))
  })

  app.route({
    method: ['POST', 'GET', 'DELETE'],
    url: path,
    bodyLimit: maxBodyBytes,
    onRequest: (req, reply, done) => {
      // DESK-01: the desktop app takes API keys only, without the OAuth endpoints' address.
      const key = keyUserOf(req) ?? (config.desktop ? null : appUserOf(req))
      if (key === null) {
        // RFC 6750 section 3 with RFC 9728's resource_metadata.
        const wrong = bearerOf(req) === null ? '' : ', error="invalid_token"'
        const metadata = config.desktop ? '' : `, resource_metadata="${resourceMetadataUrl()}"`
        reply.header('www-authenticate', `Bearer realm="xDesign"${wrong}${metadata}`)
        done(new ApiError('not_signed_in', 'Send a working API key: Authorization: Bearer <key>.'))
        return
      }
      if (Number(req.headers['content-length'] ?? 0) > bodyLimit()) {
        const limitMb = String(readSettings().uploadLimitMb)
        done(new ApiError('too_large', `This call is too large: a file sent to xDesign is at most ${limitMb} MB.`))
        return
      }
      keys.set(req, key)
      done()
    },
    handler: async (req, reply) => {
      const key = keyOf(req)
      const found = sessionOf(req, key)
      if (found === null) {
        return sessionGone(reply)
      }
      // Without a session ID only an initialize request is answered: it starts a session.
      const session = found ?? (req.method === 'POST' ? await startSession(key, app) : null)
      if (session === null) {
        return reply
          .code(400)
          .header('cache-control', 'no-store')
          .send({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: Mcp-Session-Id header is required' },
            id: null,
          })
      }
      session.caller.key = key
      if (req.method === 'POST') {
        session.usedAt = Date.now()
      }
      const answer = await session.transport.handleRequest(webRequest(req), { parsedBody: req.body })
      if (found === undefined && session.transport.sessionId === undefined) {
        // Not an initialize request: the session never started.
        endSession(session)
      }
      return sendAnswer(reply, answer)
    },
  })
}
