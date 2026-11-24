// The Fastify app around the routes: the secret path, request logs, security headers, the error
// format, the Zod compilers of the route helper, and the built SPA with its fallback
// (docs/plan/02-architecture.md sections 7 and 8, 16 section 4).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyBaseLogger, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'

import { registerAuthHooks } from './auth/http.ts'
import { answerOutside, isOutside, rewriteUrlOf } from './basePath.ts'
import type { Config } from './config.ts'
import { errorBody, setErrorHandling } from './errors.ts'
import { refuseNotFromFront } from './front.ts'
import { log } from './log.ts'

// The Content Security Policy of 02 section 8 item 6: everything from the site itself, images and
// media also from blob: and data: addresses, and no framing. Styles may also be inline: TipTap,
// sonner and mermaid add them at run time (scripts stay 'self' only).
const csp = {
  defaultSrc: ["'none'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'blob:', 'data:'],
  mediaSrc: ["'self'", 'blob:', 'data:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
}

// Paths the SPA fallback never answers: the API, the live editing socket, the MCP connector, its
// OAuth endpoints (MCP-03a), and /.well-known/ (an MCP client looking for OAuth there gets a 404,
// not the app's page).
const notSpa = /^\/(?:api|live|mcp|oauth|\.well-known)(?:[/?]|$)/

// The path a request line logs: a route with a secret token in its path logs the pattern instead,
// and so does a view link's token (VIEW-01) in its page's path and in the `view` query of media.
// The OAuth endpoints (MCP-03a) log their path alone, and the "Allow" page hides its request's
// handle. A request under the base path logs its path without the base; one outside it, what it
// asked.
function logUrl(request: FastifyRequest): string {
  const pattern = request.routeOptions.url
  if (pattern?.includes(':token') || pattern?.startsWith('/oauth/')) {
    return pattern
  }
  const url = isOutside(request.raw) ? request.originalUrl : request.url
  return url
    .replace(/^\/v\/[^/?#]+/, '/v/:token')
    .replace(/([?&]view=)[^&#]*/, '$1:token')
    .replace(/^(\/allow-app\?(?:[^#]*&)?request=)[^&#]*/, '$1:token')
}

export async function createApp(config: Config): Promise<FastifyInstance> {
  const logger: FastifyBaseLogger = log
  const app = Fastify({
    loggerInstance: logger,
    // One line per request, written by the onResponse hook below.
    disableRequestLogging: true,
    // Behind the helper's front (the Unix socket, or on Windows TCP with its proxy secret) the
    // client's address and scheme come from the X-Forwarded-For and X-Forwarded-Proto it sets:
    // that one hop is trusted. On TCP without the secret nothing is.
    trustProxy: config.behindFront ? (_address: string, hop: number) => hop === 0 : false,
    // Every route keeps its root path: the base path is taken off before routing.
    rewriteUrl: rewriteUrlOf(config.basePath),
  })
  // Before every other hook: on Windows nothing but the helper's front reaches the app, and nothing
  // outside the base path reaches the site.
  refuseNotFromFront(app, config.proxySecret)
  answerOutside(app)

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  setErrorHandling(app)

  app.addHook('onResponse', (request, reply, done) => {
    request.log.info(
      {
        method: request.method,
        url: logUrl(request),
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
        ip: request.ip,
      },
      'request',
    )
    done()
  })

  await app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives: csp },
    xFrameOptions: { action: 'deny' },
    // HSTS only when HTTPS is on (the hook below).
    strictTransportSecurity: false,
  })
  app.addHook('onRequest', (request, reply, done) => {
    if (request.protocol === 'https') {
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains')
    }
    done()
  })

  // Cookies, the Origin check of changing requests, the renewed session cookie.
  await registerAuthHooks(app, config)
  // Multipart forms (the upload route) are read as a stream by their handler, with its limits.
  await app.register(multipart)

  return app
}

// index.html's own addresses, answered by the fallback below and never by @fastify/static.
const indexPaths = new Set(['/', '/index.html'])

// DESK-01: what a request gets instead of index.html (the desktop app's page for a browser that
// did not enter from the app), or null for index.html.
export type WebGate = (request: FastifyRequest, reply: FastifyReply) => FastifyReply | null

// The built SPA, when there is one: its files, and index.html for any other GET outside the API
// (client-side routes) that the gate lets through. Everything else that matches no route answers
// not_found. index.html goes out with its `<base href>` set to the base path, so one build serves
// any path (the page builds every address from it).
export async function serveWeb(
  app: FastifyInstance,
  webDir: string | undefined,
  basePath: string,
  gate?: WebGate,
): Promise<void> {
  let index = ''
  if (webDir) {
    index = (await readFile(join(webDir, 'index.html'), 'utf8')).replace(
      /<base href="[^"]*"\s*\/?>/,
      `<base href="${basePath}" />`,
    )
    await app.register(fastifyStatic, { root: webDir, allowedPath: (pathname) => !indexPaths.has(pathname) })
  }
  app.setNotFoundHandler((request, reply) => {
    if (webDir && (request.method === 'GET' || request.method === 'HEAD') && !notSpa.test(request.url)) {
      // The cache header @fastify/static gives it.
      return (
        gate?.(request, reply) ??
        reply.type('text/html; charset=utf-8').header('cache-control', 'public, max-age=0').send(index)
      )
    }
    return reply.code(404).send(errorBody('not_found'))
  })
}
