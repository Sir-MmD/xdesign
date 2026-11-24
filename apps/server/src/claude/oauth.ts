// xDesign as the OAuth 2.1 server of the Claude app and claude.ai (docs/plan/17 section 13.5, D-660,
// MCP-03a), as xWriter's connected apps: an app's client comes from its metadata document or its
// registration (src/claude/oauthClients.ts); the authorize endpoint keeps a request (PKCE with
// S256 only) and sends the browser to the "Allow" page (`<base>allow-app?request=<handle>`, which
// signs in first); "Allow" makes a one-time code of 10 minutes bound to the client, the redirect
// address, the PKCE challenge, the person and the MCP address; the token endpoint exchanges it for
// a connected app (a grant) with an access token of an hour and a refresh token of 30 days that
// works once: each refresh gives a new pair, and a used one that comes back ends the app (OAuth
// 2.1 section 4.3.1), as does a code exchanged twice. Tokens are bound to the `/mcp` address (RFC
// 8707) and there are no scopes: an app does what its person can do, as an API key does, with its
// own "Ask first". Secrets are kept only as SHA-256 hashes. The HTTP side is src/routes/oauth.ts;
// the "Allow" page's and the connected apps' routes are in src/routes/claude.ts.
import { createHash, timingSafeEqual } from 'node:crypto'

import type { User } from '@xdesign/api'
import { and, count, eq, gt, lte } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { nanoid } from 'nanoid'

import { audit } from '../audit.ts'
import type { SessionUser } from '../auth/context.ts'
import { hashToken, newToken } from '../auth/tokens.ts'
import { toUser } from '../auth/users.ts'
import { config } from '../config.ts'
import { getDb } from '../db/index.ts'
import { oauthClients, oauthCodes, oauthGrants, oauthRequests, oauthTokens, users } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import type { Job } from '../jobs.ts'
import { log } from '../log.ts'
import { bearerOf, type KeyUser } from './keys.ts'
import {
  appNameOf,
  clientOf,
  dropUnusedClients,
  grantAuthorizationCode,
  grantRefreshToken,
  hostOf,
  isLoopbackUri,
  matchRedirect,
  OAuthError,
  touchClient,
  type AuthMethod,
  type ClientRow,
} from './oauthClients.ts'

const minuteMs = 60 * 1000
const hourMs = 60 * minuteMs
const dayMs = 24 * hourMs
// The lifetimes of 17 section 13.5, as xWriter's.
const requestMs = 10 * minuteMs
const codeMs = 10 * minuteMs
export const accessMs = hourMs
const refreshMs = 30 * dayMs
// A client without a connected app is dropped this long after its last use.
const unusedClientMs = 7 * dayMs

// The requests waiting for "Allow" at once, and those of one IP address.
const maxWaiting = 500
const maxSenderWaiting = 10
const maxStateChars = 2048

// The secrets' first letters tell what a secret is in a log or a leak; the rest is 32 random
// bytes (base64url, 43 characters).
const accessPrefix = 'xdat_'
const refreshPrefix = 'xdrt_'
const codePrefix = 'xdac_'

// The endpoints, below the base path.
export const authorizePath = '/oauth/authorize'
export const tokenPath = '/oauth/token'
export const registerPath = '/oauth/register'
// The two metadata documents as the routes name them below the base path; outside it, the base
// path goes after the well-known name (src/basePath.ts).
export const protectedResourcePath = '/.well-known/oauth-protected-resource/mcp'
export const authorizationServerPath = '/.well-known/oauth-authorization-server'

// The issuer (RFC 8414): the site's address without the base path's last slash, so its metadata's
// address is `/.well-known/oauth-authorization-server/<path>`, which the helper's front passes on.
export function issuer(): string {
  return config.publicUrl
}

// The MCP address: the protected resource, and what every token is bound to.
export function mcpResource(): string {
  return `${config.publicUrl}/mcp`
}

// The protected resource's metadata address (RFC 9728 section 3.1), named by /mcp's 401.
export function resourceMetadataUrl(): string {
  return `${config.origin}/.well-known/oauth-protected-resource${config.basePath.slice(0, -1)}/mcp`
}

// A resource identifier in its canonical form (RFC 8707 section 2): an http or https URL without a
// query or fragment, scheme and host in lower case, without the default port; null for any other.
function canonicalResource(raw: string): string | null {
  if (raw.includes('#') || raw.includes('?')) {
    return null
  }
  try {
    const url = new URL(raw)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username !== '' || url.password !== '') {
      return null
    }
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return null
  }
}

function sameResource(a: string, b: string): boolean {
  const canonical = canonicalResource(a)
  return canonical !== null && canonical === canonicalResource(b)
}

// Whether a PKCE code challenge is one of S256: the base64url of a SHA-256 hash, 43 characters.
function validChallenge(challenge: string): boolean {
  return /^[\w-]{43}$/.test(challenge)
}

// Whether the verifier answers the challenge with S256 (OAuth 2.1 section 4.1.1): 43 to 128
// unreserved characters whose BASE64URL(SHA256(verifier)) is the challenge.
function verifyPkce(challenge: string, verifier: string): boolean {
  if (!/^[\w.~-]{43,128}$/.test(verifier)) {
    return false
  }
  const answer = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const expected = Buffer.from(challenge)
  return answer.length === expected.length && timingSafeEqual(answer, expected)
}

// A state sent back as it came: at most 2048 characters without control characters.
function validState(state: string): boolean {
  // eslint-disable-next-line no-control-regex -- control characters are what this refuses
  return state.length <= maxStateChars && !/[\u0000-\u001f\u007f]/.test(state)
}

// The redirect address with these parameters added to its query (empty ones left out).
function redirectWith(uri: string, params: Record<string, string>): string {
  const url = new URL(uri)
  for (const [name, value] of Object.entries(params)) {
    if (value !== '') {
      url.searchParams.append(name, value)
    }
  }
  return url.href
}

// The query of a request to the authorize endpoint, as Fastify parsed it.
export type AuthorizeQuery = Record<string, string | string[] | undefined>

// Checks a request of the authorize endpoint (OAuth 2.1 section 4.1.1, RFC 8707 section 2.1) and
// keeps it for the "Allow" page: the client, the redirect address (exact, or a loopback one on any
// port), response_type code, PKCE with S256, the resource (the MCP address) and the state. Answers
// where the browser goes: the "Allow" page, or the app's redirect address with the error once the
// client and its address were checked; before that a refusal throws, for a page of its own.
export async function authorize(query: AuthorizeQuery, ip: string): Promise<string> {
  // A parameter comes once (RFC 6749 section 3.1), except resource (RFC 8707 section 2).
  const repeated = Object.keys(query).find((name) => Array.isArray(query[name]) && name !== 'resource')
  if (repeated !== undefined) {
    throw new OAuthError('invalid_request', `the parameter ${repeated} came more than once`)
  }
  const one = (name: string): string => {
    const value = query[name]
    return typeof value === 'string' ? value : ''
  }
  const clientId = one('client_id')
  if (clientId === '') {
    throw new OAuthError('invalid_request', 'client_id is missing')
  }
  const client = await clientOf(clientId)
  const redirect = matchRedirect(client.redirectUris, one('redirect_uri'))
  if (redirect === null) {
    throw new OAuthError('invalid_request', 'redirect_uri is missing or is not one the client registered')
  }
  const state = validState(one('state')) ? one('state') : ''
  const reject = (error: string, description: string): string =>
    redirectWith(redirect, { error, error_description: description, state, iss: issuer() })
  if (state !== one('state')) {
    return reject('invalid_request', 'state is too long or has control characters')
  }
  if (one('response_type') !== 'code') {
    return reject('unsupported_response_type', 'response_type must be code')
  }
  if (one('code_challenge_method') !== 'S256') {
    return reject('invalid_request', 'PKCE with code_challenge_method S256 is required')
  }
  if (!validChallenge(one('code_challenge'))) {
    return reject('invalid_request', 'code_challenge is not an S256 challenge')
  }
  const resource = mcpResource()
  const asked = [query.resource ?? []].flat()
  if (asked.some((value) => !sameResource(value, resource))) {
    return reject('invalid_target', `resource must be this site's MCP address, ${resource}`)
  }
  const db = getDb()
  const now = Date.now()
  const waiting = (where = gt(oauthRequests.expiresAt, now)) =>
    db.select({ n: count() }).from(oauthRequests).where(where).get()?.n ?? 0
  if (waiting(and(gt(oauthRequests.expiresAt, now), eq(oauthRequests.ip, ip))) >= maxSenderWaiting) {
    return reject('temporarily_unavailable', 'too many requests from this address wait for an answer; try again later')
  }
  if (waiting() >= maxWaiting) {
    return reject('temporarily_unavailable', 'too many requests wait for an answer; try again later')
  }
  const handle = newToken()
  db.insert(oauthRequests)
    .values({
      id: nanoid(),
      handleHash: hashToken(handle),
      clientId: client.id,
      redirectUri: redirect,
      state: state === '' ? null : state,
      codeChallenge: one('code_challenge'),
      resource,
      ip,
      createdAt: now,
      expiresAt: now + requestMs,
    })
    .run()
  touchClient(client.id)
  return `${config.basePath}allow-app?${new URLSearchParams({ request: handle }).toString()}`
}

const requestGone = 'This request to connect an app has ended or is not yours. Start again from the app.'

function selectRequest(handle: string) {
  return getDb()
    .select({ request: oauthRequests, client: oauthClients })
    .from(oauthRequests)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthRequests.clientId))
    .where(and(eq(oauthRequests.handleHash, hashToken(handle)), gt(oauthRequests.expiresAt, Date.now())))
}

type RequestRow = ReturnType<ReturnType<typeof selectRequest>['get']>

// The waiting request of a handle, bound to the person's session: the first "Allow" page that
// opens it binds it, and every other session finds nothing.
function requestFor(handle: string, user: SessionUser): NonNullable<RequestRow> {
  const row = selectRequest(handle).get()
  if (!row || (row.request.sessionId !== null && row.request.sessionId !== user.sessionId)) {
    throw new ApiError('not_found', requestGone)
  }
  if (row.request.sessionId === null) {
    getDb()
      .update(oauthRequests)
      .set({ userId: user.id, sessionId: user.sessionId })
      .where(eq(oauthRequests.id, row.request.id))
      .run()
  }
  return row
}

// The "Allow" page's view of a request: "Allow <app> to use xDesign as <person>?"
export interface AppRequestView {
  app: string
  clientKind: ClientRow['kind']
  clientHost: string
  redirectUri: string
  redirectHost: string
  loopback: boolean
  resource: string
  expiresAt: number
  person: { id: string; name: string }
}

// Opens a request for the "Allow" page (and binds it to the session).
export function openAppRequest(handle: string, user: SessionUser): AppRequestView {
  const { request, client } = requestFor(handle, user)
  return {
    app: appNameOf(client),
    clientKind: client.kind,
    clientHost: client.kind === 'metadata' ? hostOf(client.id) : '',
    redirectUri: request.redirectUri,
    redirectHost: hostOf(request.redirectUri),
    loopback: isLoopbackUri(request.redirectUri),
    resource: request.resource,
    expiresAt: request.expiresAt,
    person: { id: user.id, name: user.name },
  }
}

// The person's answer: "Allow" makes the one-time code; "Deny" answers access_denied. Either ends
// the request; the answer is where the browser goes, the app's redirect address.
export function answerAppRequest(handle: string, user: SessionUser, allow: boolean): string {
  const db = getDb()
  return db.transaction(() => {
    const { request } = requestFor(handle, user)
    db.delete(oauthRequests).where(eq(oauthRequests.id, request.id)).run()
    const params = { state: request.state ?? '', iss: issuer() }
    if (!allow) {
      return redirectWith(request.redirectUri, {
        error: 'access_denied',
        error_description: 'The person denied the request.',
        ...params,
      })
    }
    const now = Date.now()
    const code = codePrefix + newToken()
    db.insert(oauthCodes)
      .values({
        hash: hashToken(code),
        clientId: request.clientId,
        userId: user.id,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        resource: request.resource,
        createdAt: now,
        expiresAt: now + codeMs,
      })
      .run()
    return redirectWith(request.redirectUri, { code, ...params })
  })
}

// A request of the token endpoint (OAuth 2.1 sections 3.2.2, 4.1.3 and 4.3) with the client's
// proof: its client_id alone (none), or its secret in the form or in Authorization: Basic.
export interface TokenRequest {
  grantType: string
  code: string
  codeVerifier: string
  redirectUri: string
  refreshToken: string
  resources: string[]
  clientId: string
  clientSecret: string
  method: AuthMethod
}

// The answer of the token endpoint (OAuth 2.1 section 3.2.3).
export interface Tokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

function sameHash(a: string | null, b: string): boolean {
  return a !== null && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// The client of a token request once it proved itself as it registered.
function provenClient(input: TokenRequest): ClientRow {
  if (input.clientId === '') {
    throw new OAuthError('invalid_client', 'client_id is missing')
  }
  const client = getDb().select().from(oauthClients).where(eq(oauthClients.id, input.clientId)).get()
  const proven =
    client !== undefined &&
    client.authMethod === input.method &&
    (client.authMethod === 'none' || sameHash(client.secretHash, hashToken(input.clientSecret)))
  if (!proven) {
    throw new OAuthError('invalid_client', 'the client is unknown or did not prove itself as it registered')
  }
  touchClient(client.id)
  return client
}

// A new access token and refresh token of the grant.
function issue(grantId: string, now: number): Tokens {
  const accessToken = accessPrefix + newToken()
  const refreshToken = refreshPrefix + newToken()
  getDb()
    .insert(oauthTokens)
    .values([
      { hash: hashToken(accessToken), grantId, kind: 'access', createdAt: now, expiresAt: now + accessMs },
      { hash: hashToken(refreshToken), grantId, kind: 'refresh', createdAt: now, expiresAt: now + refreshMs },
    ])
    .run()
  return { accessToken, refreshToken, expiresIn: accessMs / 1000 }
}

type GrantRow = typeof oauthGrants.$inferSelect

// Ends a connected app with its tokens at once, because one of its secrets came back after its
// use: the server cannot tell who sent it, so the app connects again.
function endReused(grantId: string, why: string): GrantRow | undefined {
  const grant = getDb().delete(oauthGrants).where(eq(oauthGrants.id, grantId)).returning().get()
  if (grant) {
    log.warn({ appId: grant.id, app: grant.name, reason: why }, 'a connected app was disconnected')
  }
  return grant
}

function auditReused(grant: GrantRow | undefined): void {
  if (grant) {
    audit('claude_app_disconnected', {
      userId: grant.userId,
      detail: { appId: grant.id, name: grant.name, reason: 'reused' },
    })
  }
}

type Outcome = { tokens: Tokens; grant?: GrantRow } | { error: OAuthError; ended?: GrantRow | undefined }

// A one-time code for the first tokens of a new connected app (OAuth 2.1 section 4.1.3): this
// client's code within its 10 minutes, the PKCE verifier, the same redirect address and resource
// when sent, and its person still enabled. A code that comes back after its exchange (with the
// right verifier) ends the app it made.
function exchangeCode(client: ClientRow, input: TokenRequest): Tokens {
  const invalid = (why: string) => ({ error: new OAuthError('invalid_grant', why) })
  const db = getDb()
  const outcome = db.transaction((): Outcome => {
    const now = Date.now()
    const code = input.code.startsWith(codePrefix)
      ? db
          .select()
          .from(oauthCodes)
          .where(eq(oauthCodes.hash, hashToken(input.code)))
          .get()
      : undefined
    if (!code) {
      return invalid('the code is not valid')
    }
    if (code.clientId !== client.id) {
      return invalid('the code was issued to another client')
    }
    if (!verifyPkce(code.codeChallenge, input.codeVerifier)) {
      return invalid('code_verifier does not match the code_challenge')
    }
    if (code.usedAt !== null) {
      if (code.grantId === null) {
        return invalid('the code was used already')
      }
      return {
        ...invalid('the code was used already, so the app is disconnected'),
        ended: endReused(code.grantId, 'its code was exchanged a second time'),
      }
    }
    if (code.expiresAt <= now) {
      return invalid('the code has ended')
    }
    if (input.redirectUri !== '' && input.redirectUri !== code.redirectUri) {
      return invalid('redirect_uri is not the one of the authorization request')
    }
    if (input.resources.some((resource) => !sameResource(resource, code.resource))) {
      return { error: new OAuthError('invalid_target', 'resource is not the one of the authorization request') }
    }
    const person = db.select({ disabledAt: users.disabledAt }).from(users).where(eq(users.id, code.userId)).get()
    if (!person || person.disabledAt !== null) {
      return invalid('the person who allowed the app is disabled or removed')
    }
    const grant = db
      .insert(oauthGrants)
      .values({
        id: nanoid(),
        userId: code.userId,
        clientId: client.id,
        name: appNameOf(client),
        resource: code.resource,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: now + refreshMs,
      })
      .returning()
      .get()
    const tokens = issue(grant.id, now)
    db.update(oauthCodes).set({ usedAt: now, grantId: grant.id }).where(eq(oauthCodes.hash, code.hash)).run()
    return { tokens, grant }
  })
  if ('error' in outcome) {
    auditReused(outcome.ended)
    throw outcome.error
  }
  if (outcome.grant) {
    const { grant } = outcome
    audit('claude_app_connected', {
      userId: grant.userId,
      detail: { appId: grant.id, name: grant.name, client: hostOf(client.id) || hostOf(client.redirectUris[0] ?? '') },
    })
  }
  return outcome.tokens
}

// A refresh token for the next pair (OAuth 2.1 sections 4.3 and 4.3.1): this client's, never used
// and not ended, its person still enabled, the app bound to this site's MCP address. A used one
// that comes back ends the app at once.
function refresh(client: ClientRow, input: TokenRequest): Tokens {
  const invalid = (why: string) => ({ error: new OAuthError('invalid_grant', why) })
  const db = getDb()
  const outcome = db.transaction((): Outcome => {
    const now = Date.now()
    const row = input.refreshToken.startsWith(refreshPrefix)
      ? db
          .select({ token: oauthTokens, grant: oauthGrants, disabledAt: users.disabledAt })
          .from(oauthTokens)
          .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
          .innerJoin(users, eq(users.id, oauthGrants.userId))
          .where(and(eq(oauthTokens.hash, hashToken(input.refreshToken)), eq(oauthTokens.kind, 'refresh')))
          .get()
      : undefined
    if (!row) {
      return invalid('the refresh token is not valid')
    }
    const { token, grant } = row
    if (grant.clientId !== client.id) {
      return invalid('the refresh token was issued to another client')
    }
    if (token.usedAt !== null) {
      return {
        ...invalid('the refresh token was used already, so the app is disconnected'),
        ended: endReused(grant.id, 'a used refresh token came back'),
      }
    }
    if (token.expiresAt <= now) {
      return invalid('the refresh token has ended')
    }
    if (row.disabledAt !== null) {
      return invalid('the person the app acts as is disabled')
    }
    if (!sameResource(grant.resource, mcpResource())) {
      return invalid("the site's address changed: connect the app again")
    }
    if (input.resources.some((resource) => !sameResource(resource, grant.resource))) {
      return { error: new OAuthError('invalid_target', "resource is not the one of the app's grant") }
    }
    db.update(oauthTokens).set({ usedAt: now }).where(eq(oauthTokens.hash, token.hash)).run()
    const tokens = issue(grant.id, now)
    db.update(oauthGrants)
      .set({ expiresAt: now + refreshMs, lastUsedAt: now })
      .where(eq(oauthGrants.id, grant.id))
      .run()
    return { tokens }
  })
  if ('error' in outcome) {
    auditReused(outcome.ended)
    throw outcome.error
  }
  return outcome.tokens
}

// Answers the token endpoint: the client's proof, then the exchange of a code or a refresh token.
export function exchangeToken(input: TokenRequest): Tokens {
  if (input.grantType !== grantAuthorizationCode && input.grantType !== grantRefreshToken) {
    throw input.grantType === ''
      ? new OAuthError('invalid_request', 'grant_type is missing')
      : new OAuthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token')
  }
  const client = provenClient(input)
  return input.grantType === grantAuthorizationCode ? exchangeCode(client, input) : refresh(client, input)
}

// The person of an MCP request's access token: one that has not ended, of a connected app bound to
// this site's MCP address whose person is enabled; null for anything else. A use is the app's
// last use.
export function appUserOf(req: FastifyRequest): KeyUser | null {
  const token = bearerOf(req)
  if (token === null || !token.startsWith(accessPrefix)) {
    return null
  }
  const db = getDb()
  const now = Date.now()
  const row = db
    .select({ grant: oauthGrants, user: users })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .innerJoin(users, eq(users.id, oauthGrants.userId))
    .where(and(eq(oauthTokens.hash, hashToken(token)), eq(oauthTokens.kind, 'access'), gt(oauthTokens.expiresAt, now)))
    .get()
  if (!row || row.user.disabledAt !== null || !sameResource(row.grant.resource, mcpResource())) {
    return null
  }
  db.update(oauthGrants).set({ lastUsedAt: now }).where(eq(oauthGrants.id, row.grant.id)).run()
  const user: User = toUser(row.user)
  return {
    ...user,
    via: { kind: 'app', id: row.grant.id, name: row.grant.name },
    askFirst: row.grant.askFirst,
    cannotAsk: row.grant.cannotAsk,
  }
}

// Drops what ended: requests, codes, tokens, the apps unused for 30 days, and the clients without
// an app that nobody used for 7 days.
export const oauthJob: Job = {
  name: 'oauth',
  everyMs: hourMs,
  run: () => {
    const db = getDb()
    const now = Date.now()
    const requests = db.delete(oauthRequests).where(lte(oauthRequests.expiresAt, now)).run().changes
    const codes = db.delete(oauthCodes).where(lte(oauthCodes.expiresAt, now)).run().changes
    const tokens = db.delete(oauthTokens).where(lte(oauthTokens.expiresAt, now)).run().changes
    const apps = db.delete(oauthGrants).where(lte(oauthGrants.expiresAt, now)).run().changes
    const clients = dropUnusedClients(now - unusedClientMs)
    return { requests, codes, tokens, apps, clients }
  },
}
