// The OAuth endpoints of the Claude app and claude.ai (docs/plan/17 section 13.5, MCP-03a), as
// xWriter's: the protected resource's metadata of /mcp (RFC 9728) and the authorization server's
// (RFC 8414), answered below the base path and, with the path after the well-known name, outside
// it (src/basePath.ts); the authorize endpoint, which sends the browser to the "Allow" page; the
// token endpoint (a form, OAuth 2.1 sections 3.2 and 4); and Dynamic Client Registration (RFC
// 7591). They are the protocol's, not routes of @xdesign/api: their answers are OAuth's JSON and
// errors, and the authorize endpoint's refusals before the app's redirect address is known are a
// small page. The token and registration endpoints are called by the apps' servers, without an
// Origin (src/auth/http.ts). Each IP address makes at most 60 requests a minute to the three.
import type { FastifyReply, FastifyRequest } from 'fastify'

import { oauthCalls } from '../auth/limits.ts'
import {
  authorizationServerPath,
  authorize,
  authorizePath,
  exchangeToken,
  issuer,
  mcpResource,
  protectedResourcePath,
  registerPath,
  tokenPath,
  type AuthorizeQuery,
  type TokenRequest,
} from '../claude/oauth.ts'
import {
  grantAuthorizationCode,
  grantRefreshToken,
  maxDocumentBytes,
  OAuthError,
  registerClient,
} from '../claude/oauthClients.ts'
import { ApiError } from '../errors.ts'
import type { Register } from '../route.ts'

// The body of the token and registration endpoints.
const maxBodyBytes = maxDocumentBytes

// An answer of the protocol: never kept by a cache (OAuth 2.1 section 3.2.3).
function sendJson(reply: FastifyReply, status: number, body: unknown): FastifyReply {
  return reply.code(status).header('cache-control', 'no-store').header('pragma', 'no-cache').send(body)
}

// An error of the token or registration endpoint (OAuth 2.1 section 3.2.4, RFC 7591 section 3.2.2).
function sendError(reply: FastifyReply, status: number, error: OAuthError): FastifyReply {
  return sendJson(reply, status, { error: error.code, ...(error.message && { error_description: error.message }) })
}

// The endpoints' own failures (a body that cannot be read, too large, of another type) as
// OAuth's errors.
function protocolErrors(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  const status = error instanceof ApiError ? error.status : ((error as { statusCode?: number }).statusCode ?? 500)
  if (status >= 500) {
    request.log.error({ err: error }, 'request failed')
    void sendError(reply, 500, new OAuthError('server_error', ''))
    return
  }
  const words = error instanceof ApiError ? error.message : 'the request cannot be read'
  void sendError(reply, status, new OAuthError('invalid_request', words))
}

const tooMany = 'too many requests from this address; try again in a minute'

// Counts the request in its IP address's limit; true once it is over.
function overLimit(req: FastifyRequest): boolean {
  try {
    oauthCalls.take(`ip:${req.ip}`)
    return false
  } catch {
    return true
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`)
}

// A small page with one line: the authorize endpoint's answer when it cannot send the browser on.
function sendPage(reply: FastifyReply, status: number, text: string): FastifyReply {
  const page =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex">' +
    `<title>xDesign</title></head><body><p>${escapeHtml(text)}</p></body></html>`
  return reply.code(status).header('cache-control', 'no-store').type('text/html; charset=utf-8').send(page)
}

// The client's credentials of an Authorization: Basic header (RFC 6749 section 2.3.1: each part
// form-encoded first), or null when it cannot be read.
function basicOf(header: string): { id: string; secret: string } | null {
  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header)
  const decoded = Buffer.from(match?.[1] ?? '', 'base64').toString('utf8')
  const colon = decoded.indexOf(':')
  if (!match || colon < 0) {
    return null
  }
  try {
    const part = (text: string) => decodeURIComponent(text.replaceAll('+', ' '))
    return { id: part(decoded.slice(0, colon)), secret: part(decoded.slice(colon + 1)) }
  } catch {
    return null
  }
}

interface TokenForm {
  input: TokenRequest
  basic: boolean
}

// The token request of a form, with the client's proof: its client_id alone, its secret in the
// form (client_secret_post), or Authorization: Basic (client_secret_basic).
function tokenFormOf(form: URLSearchParams, authorization: string | undefined): TokenForm | OAuthError {
  // A parameter comes once (RFC 6749 section 3.2), except resource (RFC 8707 section 2).
  const repeated = [...new Set(form.keys())].find((name) => name !== 'resource' && form.getAll(name).length > 1)
  if (repeated !== undefined) {
    return new OAuthError('invalid_request', `${repeated} came more than once`)
  }
  const input: TokenRequest = {
    grantType: form.get('grant_type') ?? '',
    code: form.get('code') ?? '',
    codeVerifier: form.get('code_verifier') ?? '',
    redirectUri: form.get('redirect_uri') ?? '',
    refreshToken: form.get('refresh_token') ?? '',
    resources: form.getAll('resource'),
    clientId: form.get('client_id') ?? '',
    clientSecret: '',
    method: 'none',
  }
  if (authorization !== undefined && /^Basic\s/i.test(authorization)) {
    const basic = basicOf(authorization)
    if (basic === null || form.has('client_secret') || (input.clientId !== '' && input.clientId !== basic.id)) {
      return new OAuthError(
        'invalid_request',
        'the client proves itself in more than one way, or its Basic header cannot be read',
      )
    }
    // A client that names itself in Basic without a secret proves nothing more than its client_id.
    const method = basic.secret === '' ? 'none' : 'client_secret_basic'
    return { input: { ...input, clientId: basic.id, clientSecret: basic.secret, method }, basic: true }
  }
  if (form.has('client_secret')) {
    return {
      input: { ...input, clientSecret: form.get('client_secret') ?? '', method: 'client_secret_post' },
      basic: false,
    }
  }
  return { input, basic: false }
}

export const register: Register = (app) => {
  app.get(protectedResourcePath, (_req, reply) =>
    sendJson(reply, 200, {
      resource: mcpResource(),
      authorization_servers: [issuer()],
      bearer_methods_supported: ['header'],
    }),
  )

  // No scopes: an app does what its person can do. client_id_metadata_document_supported makes the
  // Claude app and claude.ai send their metadata documents; others may register.
  app.get(authorizationServerPath, (_req, reply) => {
    const base = issuer()
    return sendJson(reply, 200, {
      issuer: base,
      authorization_endpoint: base + authorizePath,
      token_endpoint: base + tokenPath,
      registration_endpoint: base + registerPath,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: [grantAuthorizationCode, grantRefreshToken],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    })
  })

  // GET only: a HEAD (a prefetch, a link checker) keeps no request.
  app.get(authorizePath, { exposeHeadRoute: false }, async (req, reply) => {
    if (overLimit(req)) {
      return sendPage(reply, 429, 'Too many requests to connect an app from this address. Try again in a minute.')
    }
    let location: string
    try {
      location = await authorize(req.query as AuthorizeQuery, req.ip)
    } catch (error) {
      if (error instanceof OAuthError) {
        return sendPage(reply, 400, `This request to connect an app cannot go on: ${error.message}.`)
      }
      req.log.error({ err: error }, 'an OAuth authorize request failed')
      return sendPage(reply, 500, 'xDesign could not take this request to connect an app. Try again in a moment.')
    }
    return reply.header('cache-control', 'no-store').redirect(location, 303)
  })

  // The token endpoint reads a form, in a scope of its own so no other route does.
  void app.register((scope, _options, done) => {
    scope.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: maxBodyBytes },
      (_req, body, parsed) => {
        parsed(null, new URLSearchParams(body as string))
      },
    )
    scope.post(tokenPath, { bodyLimit: maxBodyBytes, errorHandler: protocolErrors }, (req, reply) => {
      if (overLimit(req)) {
        return sendError(reply, 429, new OAuthError('temporarily_unavailable', tooMany))
      }
      if (!(req.body instanceof URLSearchParams)) {
        return sendError(
          reply,
          400,
          new OAuthError('invalid_request', 'the body must be application/x-www-form-urlencoded'),
        )
      }
      const form = tokenFormOf(req.body, req.headers.authorization)
      if (form instanceof OAuthError) {
        return sendError(reply, 400, form)
      }
      try {
        const tokens = exchangeToken(form.input)
        return sendJson(reply, 200, {
          access_token: tokens.accessToken,
          token_type: 'Bearer',
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
        })
      } catch (error) {
        if (!(error instanceof OAuthError)) {
          throw error
        }
        if (error.code !== 'invalid_client') {
          return sendError(reply, 400, error)
        }
        if (form.basic) {
          reply.header('www-authenticate', 'Basic realm="xDesign"')
        }
        return sendError(reply, 401, error)
      }
    })
    done()
  })

  app.post(registerPath, { bodyLimit: maxBodyBytes, errorHandler: protocolErrors }, (req, reply) => {
    if (overLimit(req)) {
      return sendError(reply, 429, new OAuthError('temporarily_unavailable', tooMany))
    }
    try {
      const client = registerClient(req.body)
      return sendJson(reply, 201, {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.issuedAt / 1000),
        ...(client.secret !== null && { client_secret: client.secret, client_secret_expires_at: 0 }),
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: ['code'],
        token_endpoint_auth_method: client.authMethod,
        ...(client.name !== '' && { client_name: client.name }),
      })
    } catch (error) {
      if (!(error instanceof OAuthError)) {
        throw error
      }
      if (error.code === 'temporarily_unavailable') {
        reply.header('retry-after', '3600')
        return sendError(reply, 503, error)
      }
      return sendError(reply, 400, error)
    }
  })
}
