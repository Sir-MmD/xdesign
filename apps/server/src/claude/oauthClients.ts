// The clients of xDesign's OAuth server (docs/plan/17 section 13.5, MCP-03a), as xWriter's: an app
// is known by its Client ID Metadata Document (its client_id is the document's https address, as
// the Claude app and claude.ai send), fetched here and kept as long as its Cache-Control allows
// (5 minutes to a day), or registers itself with Dynamic Client Registration (RFC 7591). The fetch
// reaches only the public internet: an address of this server's own or private network is refused
// before it connects, and the document is at most 16 KB in 5 seconds, from that very address (no
// redirect). Redirect addresses are https, or http to the app's own machine (localhost).
import { lookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'

import { and, count, eq, lt, notInArray } from 'drizzle-orm'

import { hashToken, newToken } from '../auth/tokens.ts'
import { getDb } from '../db/index.ts'
import { oauthClients, oauthGrants } from '../db/schema.ts'
import { version } from '../version.ts'

const minuteMs = 60 * 1000
const hourMs = 60 * minuteMs
const dayMs = 24 * hourMs
// A metadata document's copy: its Cache-Control's max-age within these, an hour without one.
const docDefaultMs = hourMs
const docMinMs = 5 * minuteMs
const docMaxMs = dayMs
const docTimeoutMs = 5000
export const maxDocumentBytes = 16 * 1024

// The clients kept, fetched and registered: once they come within clientsRoom of maxClients, a
// new one first drops those without a connected app that nobody used for an hour.
const maxClients = 2000
const clientsRoom = 100
const idleClientMs = hourMs

const maxUriChars = 2048
const maxNameChars = 100
const maxRedirectUris = 20

// A registered client's ID and secret start with these; the rest is 32 random bytes.
const clientIdPrefix = 'xdcl_'
const clientSecretPrefix = 'xdcs_'

export type ClientRow = typeof oauthClients.$inferSelect
export type AuthMethod = ClientRow['authMethod']

export const grantAuthorizationCode = 'authorization_code'
export const grantRefreshToken = 'refresh_token'

// The error codes of OAuth 2.1 (sections 3.2.4 and 4.1.2.1), RFC 7591 (3.2.2) and RFC 8707.
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_target'
  | 'access_denied'
  | 'server_error'
  | 'temporarily_unavailable'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'

// A refusal of the protocol: its code and the words for the app's developer (error_description).
export class OAuthError extends Error {
  readonly code: OAuthErrorCode

  constructor(code: OAuthErrorCode, description: string) {
    super(description)
    this.code = code
  }
}

const roomGone = 'this site keeps as many clients as it can; try again later'

// A client as a registration or a metadata document describes it.
export interface Registration {
  // Its client_name, cleaned; '' when it gave none.
  name: string
  redirectUris: string[]
  grantTypes: string[]
  authMethod: AuthMethod
}

// One line without control characters, the spaces folded, at most 100 characters.
function cleanName(value: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are what this folds
  const name = value.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim()
  return name.length > maxNameChars ? `${name.slice(0, maxNameChars - 3).trim()}...` : name
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function urlOf(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

// The host of an address, without its port; '' when it has none.
export function hostOf(raw: string): string {
  return urlOf(raw)?.hostname ?? ''
}

// localhost, or a loopback address (127.0.0.0/8, [::1]).
function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(hostname)
}

// Whether a redirect address goes to the app's own machine, where any program can listen.
export function isLoopbackUri(raw: string): boolean {
  const url = urlOf(raw)
  return url !== null && url.protocol === 'http:' && isLoopbackHost(url.hostname)
}

// Why an address cannot be a redirect address, or null: an absolute URL without a fragment or user
// info, https or http to localhost (the MCP specification's Communication Security).
function redirectProblem(raw: string): string | null {
  if (raw === '' || raw.length > maxUriChars || /[#\s]/.test(raw) || raw.includes('\u0000')) {
    return 'a redirect address is empty, too long, or has a fragment or a space'
  }
  const url = urlOf(raw)
  if (url === null || url.host === '' || url.username !== '' || url.password !== '') {
    return 'a redirect address is not an absolute URL with a host and no user'
  }
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname))) {
    return null
  }
  return 'a redirect address must use https, or http to localhost, 127.0.0.1 or [::1]'
}

// The redirect addresses of a client: 1 to 20, each one checked, once each.
function redirectsOf(value: unknown, code: OAuthErrorCode): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OAuthError(code, 'redirect_uris is missing')
  }
  const uris: string[] = []
  for (const uri of value) {
    const problem = typeof uri === 'string' ? redirectProblem(uri) : 'a redirect address is not a string'
    if (problem !== null) {
      throw new OAuthError(code, problem)
    }
    if (!uris.includes(uri as string)) {
      uris.push(uri as string)
    }
  }
  if (uris.length > maxRedirectUris) {
    throw new OAuthError(code, 'redirect_uris has more addresses than this site keeps')
  }
  return uris
}

function stringsOf(value: unknown, field: string, code: OAuthErrorCode): string[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new OAuthError(code, `${field} is not a list of strings`)
  }
  return value as string[]
}

// The redirect address of a request: the registered one it names exactly, or a loopback one on
// any port (RFC 8252 section 7.3: an app on the person's machine listens on a port of the
// moment); without one, the only registered address. Null when it matches none.
export function matchRedirect(registered: string[], asked: string): string | null {
  if (asked === '') {
    return registered.length === 1 ? (registered[0] ?? null) : null
  }
  if (registered.includes(asked)) {
    return asked
  }
  const url = urlOf(asked)
  if (url === null || !isLoopbackUri(asked) || url.username !== '' || url.hash !== '') {
    return null
  }
  const same = registered.some((uri) => {
    const other = urlOf(uri)
    return (
      other !== null &&
      isLoopbackUri(uri) &&
      other.hostname === url.hostname &&
      other.pathname === url.pathname &&
      other.search === url.search
    )
  })
  return same ? asked : null
}

// A request of Dynamic Client Registration (RFC 7591 sections 2 and 3.1): redirect_uris; the
// method none, client_secret_post or client_secret_basic (the RFC's default); grant types
// authorization_code (the default) and refresh_token; response type code.
export function parseRegistration(body: unknown): Registration {
  if (!isObject(body)) {
    throw new OAuthError('invalid_client_metadata', 'the client metadata is not a JSON object')
  }
  const redirectUris = redirectsOf(body.redirect_uris, 'invalid_redirect_uri')
  const method = body.token_endpoint_auth_method ?? 'client_secret_basic'
  if (method !== 'none' && method !== 'client_secret_post' && method !== 'client_secret_basic') {
    throw new OAuthError(
      'invalid_client_metadata',
      'token_endpoint_auth_method must be none, client_secret_post or client_secret_basic',
    )
  }
  const asked = stringsOf(body.grant_types, 'grant_types', 'invalid_client_metadata')
  const grantTypes = [...new Set(asked.length === 0 ? [grantAuthorizationCode] : asked)]
  if (grantTypes.some((grant) => grant !== grantAuthorizationCode && grant !== grantRefreshToken)) {
    throw new OAuthError('invalid_client_metadata', 'grant_types may hold only authorization_code and refresh_token')
  }
  if (!grantTypes.includes(grantAuthorizationCode)) {
    throw new OAuthError('invalid_client_metadata', 'grant_types must hold authorization_code')
  }
  const responseTypes = stringsOf(body.response_types, 'response_types', 'invalid_client_metadata')
  if (responseTypes.some((type) => type !== 'code')) {
    throw new OAuthError('invalid_client_metadata', 'response_types may hold only code')
  }
  const name = typeof body.client_name === 'string' ? cleanName(body.client_name) : ''
  return { name, redirectUris, grantTypes, authMethod: method }
}

// Whether a client_id is the address of a metadata document rather than an ID made here.
export function isClientIdUrl(clientId: string): boolean {
  return clientId.startsWith('https://')
}

const notDocument = 'the client_id is not the https address of a client metadata document'

// A client_id that is a metadata document's address (the draft's section 3): https on the default
// port, a path other than `/`, no fragment, user info or dot segment, written as browsers write it.
function checkClientIdUrl(raw: string): URL {
  const url = urlOf(raw)
  if (
    raw.length > maxUriChars ||
    url === null ||
    url.href !== raw ||
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== '' ||
    url.pathname === '/'
  ) {
    throw new OAuthError('invalid_client', notDocument)
  }
  return url
}

// A fetched metadata document (the draft's section 4): a JSON object whose client_id is its address,
// with client_name and redirect_uris, no secret and no shared-secret method; its client proves
// itself with its client_id alone.
function parseDocument(clientId: string, body: unknown): Registration {
  const bad = (why: string) => new OAuthError('invalid_client', why)
  if (!isObject(body)) {
    throw bad('the client metadata document is not a JSON object')
  }
  if (body.client_id !== clientId) {
    throw bad('the client_id of the client metadata document is not its address')
  }
  if (body.client_secret !== undefined || body.client_secret_expires_at !== undefined) {
    throw bad('a client metadata document must not carry a client secret')
  }
  const method = body.token_endpoint_auth_method
  if (method !== undefined && method !== 'none' && method !== 'private_key_jwt') {
    throw bad('a client metadata document must not use a shared-secret token_endpoint_auth_method')
  }
  const name = typeof body.client_name === 'string' ? cleanName(body.client_name) : ''
  if (name === '') {
    throw bad('the client metadata document has no client_name')
  }
  const redirectUris = redirectsOf(body.redirect_uris, 'invalid_client')
  const grants = stringsOf(body.grant_types, 'grant_types', 'invalid_client')
  if (grants.length > 0 && !grants.includes(grantAuthorizationCode)) {
    throw bad("the client metadata document's grant_types lack authorization_code")
  }
  const responseTypes = stringsOf(body.response_types, 'response_types', 'invalid_client')
  if (responseTypes.length > 0 && !responseTypes.includes('code')) {
    throw bad("the client metadata document's response_types lack code")
  }
  const grantTypes =
    grants.length === 0 || grants.includes(grantRefreshToken)
      ? [grantAuthorizationCode, grantRefreshToken]
      : [grantAuthorizationCode]
  return { name, redirectUris, grantTypes, authMethod: 'none' }
}

// The addresses a fetch never reaches: this server's own, private, shared, documentation and
// multicast networks.
const notPublic = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const) {
  notPublic.addSubnet(network, prefix, 'ipv4')
}
// No rule for ::ffff:0:0/96: Node's BlockList checks an IPv4-mapped IPv6 address against the IPv4
// networks above by itself, and that rule would match every IPv4 address (claude.ai's too).
for (const [network, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  notPublic.addSubnet(network, prefix, 'ipv6')
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  return family !== 0 && !notPublic.check(address, family === 6 ? 'ipv6' : 'ipv4')
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

// The DNS lookup of a fetch: every address of the name must be public, else the fetch fails before
// it connects (and it connects only to the addresses checked here).
function publicLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '')
      return
    }
    const [first] = addresses
    if (first === undefined || addresses.some((found) => !isPublicAddress(found.address))) {
      callback(Object.assign(new Error(`${hostname} is not on the public internet`), { code: 'ENOTFOUND' }), '')
      return
    }
    if (options.all === true) {
      callback(null, addresses)
    } else {
      callback(null, first.address, first.family)
    }
  })
}

// How long a document's copy is kept, from its Cache-Control.
function cacheLife(cacheControl: string | undefined): number {
  let life = docDefaultMs
  for (const part of (cacheControl ?? '').toLowerCase().split(',')) {
    const directive = part.trim()
    if (directive === 'no-store' || directive === 'no-cache') {
      return docMinMs
    }
    const maxAge = /^max-age="?(\d+)"?$/.exec(directive)
    if (maxAge) {
      life = Number(maxAge[1]) * 1000
    }
  }
  return Math.min(Math.max(life, docMinMs), docMaxMs)
}

interface Fetched {
  body: unknown
  lifeMs: number
}

// GETs a metadata document: an answer 200 of at most 16 KB within 5 seconds, from a public
// address. A failure is never kept (the draft's section 4.4).
function fetchDocument(url: URL): Promise<Fetched> {
  const failed = (why: string) =>
    new OAuthError('invalid_client', `the client metadata document could not be fetched: ${why}`)
  // An address in the URL is not looked up: it is checked here.
  const literal = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(literal) !== 0 && !isPublicAddress(literal)) {
    return Promise.reject(failed('its address is not on the public internet'))
  }
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        headers: { accept: 'application/json', 'user-agent': `xDesign/${version}` },
        lookup: publicLookup,
        signal: AbortSignal.timeout(docTimeoutMs),
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          reject(failed(`it answered ${String(res.statusCode)} instead of 200`))
          return
        }
        if (Number(res.headers['content-length'] ?? 0) > maxDocumentBytes) {
          res.destroy()
          reject(failed('it is larger than 16 KB'))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxDocumentBytes) {
            res.destroy()
            reject(failed('it is larger than 16 KB'))
            return
          }
          chunks.push(chunk)
        })
        res.on('error', () => {
          reject(failed('the answer broke off'))
        })
        res.on('end', () => {
          let body: unknown
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            reject(new OAuthError('invalid_client', 'the client metadata document is not valid JSON'))
            return
          }
          resolve({ body, lifeMs: cacheLife(res.headers['cache-control']) })
        })
      },
    )
    req.on('error', (error) => {
      reject(failed(error.name === 'AbortError' || error.name === 'TimeoutError' ? 'it took too long' : error.message))
    })
    req.end()
  })
}

// Whether one more client may be kept; near the bound, the idle ones without an app go first.
function roomForClient(): boolean {
  const db = getDb()
  const kept = () => db.select({ n: count() }).from(oauthClients).get()?.n ?? 0
  if (kept() < maxClients - clientsRoom) {
    return true
  }
  dropUnusedClients(Date.now() - idleClientMs)
  return kept() < maxClients
}

// Drops the clients without a connected app that nobody used since `before`; their waiting
// requests and codes go with them. Answers how many.
export function dropUnusedClients(before: number): number {
  const db = getDb()
  return db
    .delete(oauthClients)
    .where(
      and(
        lt(oauthClients.usedAt, before),
        notInArray(oauthClients.id, db.select({ id: oauthGrants.clientId }).from(oauthGrants)),
      ),
    )
    .run().changes
}

// The client of a client_id: a registered one as kept, or a metadata document's copy, fetched
// again once it is no longer fresh. One that cannot be used is refused with invalid_client.
export async function clientOf(clientId: string): Promise<ClientRow> {
  const db = getDb()
  const row = db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).get()
  if (!isClientIdUrl(clientId)) {
    if (!row || row.kind !== 'registered') {
      throw new OAuthError('invalid_client', 'the client_id is not registered with this site')
    }
    return row
  }
  const url = checkClientIdUrl(clientId)
  const now = Date.now()
  if (row && row.freshUntil !== null && row.freshUntil > now) {
    return row
  }
  const fetched = await fetchDocument(url)
  const registration = parseDocument(clientId, fetched.body)
  if (!row && !roomForClient()) {
    throw new OAuthError('temporarily_unavailable', roomGone)
  }
  const kept = {
    kind: 'metadata' as const,
    name: registration.name,
    redirectUris: registration.redirectUris,
    authMethod: registration.authMethod,
    secretHash: null,
    usedAt: now,
    freshUntil: now + fetched.lifeMs,
  }
  return db
    .insert(oauthClients)
    .values({ id: clientId, createdAt: now, ...kept })
    .onConflictDoUpdate({ target: oauthClients.id, set: kept })
    .returning()
    .get()
}

// A client of Dynamic Client Registration, as RFC 7591 section 3.2.1 answers it.
export interface Registered extends Registration {
  clientId: string
  // A confidential client's secret, shown this once; null for a public client.
  secret: string | null
  issuedAt: number
}

// Registers a client from its request (RFC 7591 section 3.1).
export function registerClient(body: unknown): Registered {
  const registration = parseRegistration(body)
  if (!roomForClient()) {
    throw new OAuthError('temporarily_unavailable', roomGone)
  }
  const now = Date.now()
  const clientId = clientIdPrefix + newToken()
  const secret = registration.authMethod === 'none' ? null : clientSecretPrefix + newToken()
  getDb()
    .insert(oauthClients)
    .values({
      id: clientId,
      kind: 'registered',
      name: registration.name,
      redirectUris: registration.redirectUris,
      authMethod: registration.authMethod,
      secretHash: secret === null ? null : hashToken(secret),
      createdAt: now,
      usedAt: now,
      freshUntil: null,
    })
    .run()
  return { ...registration, clientId, secret, issuedAt: now }
}

// The client's last use: a client without an app is dropped 7 days after it.
export function touchClient(clientId: string): void {
  getDb().update(oauthClients).set({ usedAt: Date.now() }).where(eq(oauthClients.id, clientId)).run()
}

// The name the pages and Activity show for a client: its own, else its document's host, else
// "app at <the host of its first redirect address>".
export function appNameOf(client: ClientRow): string {
  if (client.name !== '') {
    return client.name
  }
  if (client.kind === 'metadata') {
    return hostOf(client.id) || 'app'
  }
  const host = hostOf(client.redirectUris[0] ?? '')
  return host === '' ? 'app' : `app at ${host}`
}
