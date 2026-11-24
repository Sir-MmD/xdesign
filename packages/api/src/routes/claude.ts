// The Claude link and personal API keys (docs/plan/06 section 7): a design's secret read-only
// link, made and revoked in the Share dialog; the Account page's API keys for the MCP connector;
// the link's public files (spec.json, design.md, HOW-TO-READ.md and the pictures); the upload of
// the picture cache that a browser export sends; (MCP-01b) Settings' "Claude connections"; and
// (MCP-03a) the Claude app's "Allow" page and the person's connected apps.
import { z } from 'zod'

import { id, ok, person, time, token } from '../common.ts'
import { defineRoute } from '../route.ts'
import { languageCode } from './designs.ts'

// A Claude link in the Share dialog's list (the link itself is shown once, when made).
export const claudeLink = z.object({
  id,
  createdAt: time,
  // Who made it; null once they are gone.
  createdBy: person.nullable(),
  lastUsedAt: time.nullable(),
})

// The addresses of a new link: spec.json, design.md and HOW-TO-READ.md under
// `https://<domain>/api/link/<token>/`.
export const claudeLinkUrls = z.object({ spec: z.string(), doc: z.string(), howToRead: z.string() })

export const apiKeyName = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.')

// A key on the Account page's "API keys" list (the key itself is shown once, when made).
export const apiKey = z.object({
  id,
  name: apiKeyName,
  createdAt: time,
  lastUsedAt: time.nullable(),
  // MCP-01b (docs/plan/17 section 13.4): "Ask first", on by default, which only the site owner
  // turns off; and whether Claude's app answered a question with a No in under 3 seconds, so its
  // questions go through Claude's own answer with a ticket.
  askFirst: z.boolean(),
  cannotAsk: z.boolean(),
})

// MCP-01b: what a call through Claude comes through: a personal API key, or (MCP-03a) a connected
// app (the Claude app or claude.ai, connected with OAuth).
export const claudeConnectionKind = z.enum(['key', 'app'])
export type ClaudeConnectionKind = z.output<typeof claudeConnectionKind>

// The key or app a change through Claude was made with, as Activity and History name it.
export const claudeVia = z.object({ kind: claudeConnectionKind, id, name: z.string() })

// MCP-03a: a connected app on the Account page's "Connected apps": its name (its own, from its
// metadata document or registration), when it was connected (`createdAt`), its last call or
// refresh, and the switches of an API key.
export const claudeApp = z.object({
  id,
  name: z.string(),
  createdAt: time,
  lastUsedAt: time.nullable(),
  askFirst: z.boolean(),
  cannotAsk: z.boolean(),
})
export type ClaudeApp = z.output<typeof claudeApp>

// A row of Settings' "Claude connections": every person's keys and connected apps, with the
// person.
export const claudeConnection = claudeApp.extend({ kind: claudeConnectionKind, person })
export type ClaudeConnection = z.output<typeof claudeConnection>

// MCP-03a: a request to connect an app, as the "Allow" page shows it: "Allow <app> to use xDesign
// as <person>?"
export const claudeAppRequest = z.object({
  app: z.string(),
  // metadata: the app is known by the client metadata document at its address, whose host
  // (`clientHost`, such as claude.ai) tells who runs it; registered: it registered itself with
  // this site, so its name is its own claim.
  clientKind: z.enum(['metadata', 'registered']),
  clientHost: z.string(),
  // Where the answer goes, and its host.
  redirectUri: z.string(),
  redirectHost: z.string(),
  // The answer goes to the app's own machine (localhost), where any program can listen.
  loopback: z.boolean(),
  // The MCP address the app will use.
  resource: z.string(),
  // When the request ends without an answer (10 minutes after the app asked).
  expiresAt: time,
  // The person the app will act as: the one signed in.
  person,
})
export type ClaudeAppRequest = z.output<typeof claudeAppRequest>

// The handle of the "Allow" page's address (`<base>allow-app?request=<handle>`).
const appRequestParams = z.object({ token })

const connectionParams = z.object({ kind: claudeConnectionKind, id })

// `?version=<name or id>` (a version of the History panel; a named one by its name, ignoring
// case) and `?languages=en,fa` (the default language is always in).
export const linkQuery = z.object({
  version: z.string().trim().min(1).max(100).optional(),
  languages: z.string().max(500).optional(),
})

// The picture cache's upload: a multipart form with these fields, and one PNG file per picture
// whose field name is its step's ID or `bot-profile`, `empty-chat` or `commands-menu`.
export const pictureFields = z.object({
  // The design's docVersion the pictures were made from.
  docVersion: z.coerce.number().int().nonnegative(),
  language: languageCode,
  // The phone look and theme, as the export dialog names them ("web-light").
  look: z.string().regex(/^[\w-]{1,50}$/, 'Not a look.'),
})

const designParams = z.object({ id })
const linkParams = z.object({ token })

export const claudeRoutes = {
  // The design's links that work, newest first.
  claudeLinks: defineRoute({
    key: 'claudeLinks',
    method: 'GET',
    path: '/api/designs/:id/claude-links',
    params: designParams,
    response: z.object({ links: z.array(claudeLink) }),
    auth: { design: 'owner' },
  }),
  // "Create link": the addresses are shown once; only the token's hash is kept.
  createClaudeLink: defineRoute({
    key: 'createClaudeLink',
    method: 'POST',
    path: '/api/designs/:id/claude-links',
    params: designParams,
    response: z.object({ link: claudeLink, urls: claudeLinkUrls }),
    auth: { design: 'owner' },
  }),
  revokeClaudeLink: defineRoute({
    key: 'revokeClaudeLink',
    method: 'DELETE',
    path: '/api/designs/:id/claude-links/:linkId',
    params: z.object({ id, linkId: id }),
    response: ok,
    auth: { design: 'owner' },
  }),
  // The person's keys that work, newest first.
  apiKeys: defineRoute({
    key: 'apiKeys',
    method: 'GET',
    path: '/api/me/api-keys',
    response: z.object({ keys: z.array(apiKey) }),
    auth: 'member',
  }),
  // "Create key": the key is shown once; only its hash is kept.
  createApiKey: defineRoute({
    key: 'createApiKey',
    method: 'POST',
    path: '/api/me/api-keys',
    body: z.object({ name: apiKeyName }),
    response: z.object({ key: apiKey, secret: z.string() }),
    auth: 'member',
  }),
  revokeApiKey: defineRoute({
    key: 'revokeApiKey',
    method: 'DELETE',
    path: '/api/me/api-keys/:keyId',
    params: z.object({ keyId: id }),
    response: ok,
    auth: 'member',
  }),
  // MCP-03a: the person's connected apps, newest first, and whether the site serves its built-in
  // certificate, which the Claude app cannot trust (null when it cannot be read: `make dev`).
  claudeApps: defineRoute({
    key: 'claudeApps',
    method: 'GET',
    path: '/api/me/claude-apps',
    response: z.object({ apps: z.array(claudeApp), builtInCertificate: z.boolean().nullable() }),
    auth: 'member',
  }),
  // "Disconnect" of the person's own app: its tokens stop working at once.
  disconnectClaudeApp: defineRoute({
    key: 'disconnectClaudeApp',
    method: 'DELETE',
    path: '/api/me/claude-apps/:appId',
    params: z.object({ appId: id }),
    response: ok,
    auth: 'member',
  }),
  // The "Allow" page: the request of its address. The first session that reads it keeps it: for
  // any other, and once it ended or was answered, 404.
  appRequest: defineRoute({
    key: 'appRequest',
    method: 'GET',
    path: '/api/claude/app-requests/:token',
    params: appRequestParams,
    response: z.object({ request: claudeAppRequest }),
    auth: 'member',
  }),
  // "Allow": the answer is the app's address with a one-time code, for the browser to open.
  allowAppRequest: defineRoute({
    key: 'allowAppRequest',
    method: 'POST',
    path: '/api/claude/app-requests/:token/allow',
    params: appRequestParams,
    response: z.object({ redirectTo: z.string() }),
    auth: 'member',
  }),
  // "Deny": the answer is the app's address with access_denied, for the browser to open.
  denyAppRequest: defineRoute({
    key: 'denyAppRequest',
    method: 'POST',
    path: '/api/claude/app-requests/:token/deny',
    params: appRequestParams,
    response: z.object({ redirectTo: z.string() }),
    auth: 'member',
  }),
  // MCP-01b: Settings' "Claude connections", every person's keys that work and (MCP-03a) connected
  // apps, newest first.
  claudeConnections: defineRoute({
    key: 'claudeConnections',
    method: 'GET',
    path: '/api/claude/connections',
    response: z.object({ connections: z.array(claudeConnection) }),
    auth: 'siteOwner',
  }),
  // The switch "Ask first" of anyone's key or app; `cannotAsk: false` lets Claude's app ask in the
  // chat again.
  updateClaudeConnection: defineRoute({
    key: 'updateClaudeConnection',
    method: 'PATCH',
    path: '/api/claude/connections/:kind/:id',
    params: connectionParams,
    body: z.object({ askFirst: z.boolean().optional(), cannotAsk: z.boolean().optional() }),
    response: z.object({ connection: claudeConnection }),
    auth: 'siteOwner',
  }),
  // "Revoke" of anyone's key, or "Disconnect" of anyone's app, in Settings.
  revokeClaudeConnection: defineRoute({
    key: 'revokeClaudeConnection',
    method: 'DELETE',
    path: '/api/claude/connections/:kind/:id',
    params: connectionParams,
    response: ok,
    auth: 'siteOwner',
  }),
  // The picture cache of a browser export (`pictureFields` and the PNG files): it replaces the
  // design's pictures. Everyone who can export sends it.
  uploadPictures: defineRoute({
    key: 'uploadPictures',
    method: 'POST',
    path: '/api/designs/:id/pictures',
    params: designParams,
    multipart: true,
    response: z.object({ pictures: z.number().int() }),
    auth: { design: 'viewer' },
  }),
  // The link's files, without a session (the token is the access). spec.json as the export
  // writes it (bot-spec.schema.json describes it).
  linkSpec: defineRoute({
    key: 'linkSpec',
    method: 'GET',
    path: '/api/link/:token/spec.json',
    params: linkParams,
    query: linkQuery,
    response: z.unknown(),
    auth: 'public',
  }),
  // design.md (text/markdown), its pictures pointing at the link's `pictures/`.
  linkDoc: defineRoute({
    key: 'linkDoc',
    method: 'GET',
    path: '/api/link/:token/design.md',
    params: linkParams,
    query: linkQuery,
    response: z.string(),
    auth: 'public',
  }),
  // The builders' guide (text/markdown).
  linkHowToRead: defineRoute({
    key: 'linkHowToRead',
    method: 'GET',
    path: '/api/link/:token/HOW-TO-READ.md',
    params: linkParams,
    response: z.string(),
    auth: 'public',
  }),
  // A picture of the cache, `<step ID name>.<language>.png` as in the export's pictures/, with
  // the header X-Xdesign-Picture-Version (the docVersion it was made from). design.md of a
  // version adds its `?version=`, so the step's ID name is read in that version.
  linkPicture: defineRoute({
    key: 'linkPicture',
    method: 'GET',
    path: '/api/link/:token/pictures/:file',
    params: z.object({ token, file: z.string().min(1).max(200) }),
    query: linkQuery.pick({ version: true }),
    response: z.instanceof(Uint8Array),
    auth: 'public',
  }),
}
