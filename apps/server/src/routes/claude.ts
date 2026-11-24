// The Claude link and personal API keys (claudeRoutes of @xdesign/api; docs/plan/06 section 7): a
// design's links made, listed and revoked by its design owner or the site owner; the person's API
// keys on the Account page; the link's public files, made by the server-side export
// (src/claude/export.ts); and the picture cache's upload from a browser export
// (src/claude/pictures.ts). Links and keys are shown once (only their hashes are kept); every use
// of a link is in the activity list. (MCP-01b) Settings' "Claude connections": every person's keys
// and (MCP-03a) connected apps for the site owner, with their "Ask first" switch and "Revoke" or
// "Disconnect". (MCP-03a) The person's connected apps, and the "Allow" page's request
// (src/claude/oauth.ts).
import { createReadStream } from 'node:fs'
import { rm, stat } from 'node:fs/promises'

import {
  pictureFields,
  routes,
  type apiKey,
  type claudeApp,
  type claudeConnection,
  type claudeLink,
  type HttpsView,
} from '@xdesign/api'
import { HOW_TO_READ, StepIdSchema } from '@xdesign/spec'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { nanoid } from 'nanoid'
import type { z } from 'zod'

import { audit } from '../audit.ts'
import { hashToken, newToken } from '../auth/tokens.ts'
import { designMd, exportOf, openQuestionsOf, parseLanguages, pictureKey, specJson } from '../claude/export.ts'
import { answerAppRequest, openAppRequest } from '../claude/oauth.ts'
import { findPicture, pictureViews, replacePictures, type NewPicture } from '../claude/pictures.ts'
import { config } from '../config.ts'
import { getDb } from '../db/index.ts'
import { apiKeys, claudeLinks, designs, oauthGrants, users } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import { control } from '../helper/control.ts'
import { writeTemp } from '../media/store.ts'
import { addRoute, type Register } from '../route.ts'

type ClaudeLink = z.output<typeof claudeLink>
type ApiKey = z.output<typeof apiKey>
type ClaudeApp = z.output<typeof claudeApp>
type ClaudeConnection = z.output<typeof claudeConnection>

const minuteMs = 60 * 1000
// Picture fetches through a link write one activity row per link in this time, not one each.
const pictureAuditMs = 10 * minuteMs
// The picture cache's upload: each PNG at most 10 MB, all of them at most 300 MB.
const pictureMb = 10
const picturesMb = 300

const linkGone = 'This link was revoked or does not exist.'

// The design of a route. The route helper lets the site owner through without a role, so a
// missing design answers 404 here, and so does one in Trash.
function findDesign(designId: string): { id: string } {
  const row = getDb()
    .select({ id: designs.id, deletedAt: designs.deletedAt })
    .from(designs)
    .where(eq(designs.id, designId))
    .get()
  if (!row) {
    throw new ApiError('not_found', 'This design was not found.')
  }
  if (row.deletedAt !== null) {
    throw new ApiError('not_found', 'This design is in Trash.')
  }
  return row
}

function toApiKey(row: typeof apiKeys.$inferSelect): ApiKey {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    askFirst: row.askFirst,
    cannotAsk: row.cannotAsk,
  }
}

// MCP-01b: keys with their people, for Settings' "Claude connections".
function selectKeys() {
  return getDb()
    .select({ key: apiKeys, person: { id: users.id, name: users.name } })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
}

type KeyRow = ReturnType<ReturnType<typeof selectKeys>['all']>[number]

function toConnection(row: KeyRow): ClaudeConnection {
  return { kind: 'key', ...toApiKey(row.key), person: row.person }
}

// MCP-03a: connected apps that work, with their people.
function selectApps() {
  return getDb()
    .select({ app: oauthGrants, person: { id: users.id, name: users.name } })
    .from(oauthGrants)
    .innerJoin(users, eq(users.id, oauthGrants.userId))
}

type AppRow = ReturnType<ReturnType<typeof selectApps>['all']>[number]

function toClaudeApp(row: typeof oauthGrants.$inferSelect): ClaudeApp {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    askFirst: row.askFirst,
    cannotAsk: row.cannotAsk,
  }
}

function toAppConnection(row: AppRow): ClaudeConnection {
  return { kind: 'app', ...toClaudeApp(row.app), person: row.person }
}

const appGone = 'This app is not connected.'

// A connected app that works (not ended), with its person.
function findApp(appId: string): AppRow {
  const row = selectApps()
    .where(and(eq(oauthGrants.id, appId), gt(oauthGrants.expiresAt, Date.now())))
    .get()
  if (!row) {
    throw new ApiError('not_found', appGone)
  }
  return row
}

// Ends a connected app: its tokens stop working at once (the Activity row is the caller's).
function disconnect(appId: string): void {
  getDb().delete(oauthGrants).where(eq(oauthGrants.id, appId)).run()
}

// A key that works, with its person.
function findKey(keyId: string): KeyRow {
  const row = selectKeys()
    .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
    .get()
  if (!row) {
    throw new ApiError('not_found', 'This key was not found.')
  }
  return row
}

// What Activity adds to a row about someone else's key or app: whose it is.
function ofPerson(row: KeyRow | AppRow, userId: string): { of?: string } {
  return row.person.id === userId ? {} : { of: row.person.name }
}

// The addresses of a link's files.
function linkUrl(token: string): string {
  return `${config.publicUrl}/api/link/${token}`
}

interface Link {
  id: string
  designId: string
  createdAt: number
}

// The link of a token while it works, on a design that is not in Trash.
function linkOf(token: string): Link {
  const row = getDb()
    .select({
      id: claudeLinks.id,
      designId: claudeLinks.designId,
      createdAt: claudeLinks.createdAt,
      deletedAt: designs.deletedAt,
    })
    .from(claudeLinks)
    .innerJoin(designs, eq(designs.id, claudeLinks.designId))
    .where(and(eq(claudeLinks.tokenHash, hashToken(token)), isNull(claudeLinks.revokedAt)))
    .get()
  if (!row) {
    throw new ApiError('not_found', linkGone)
  }
  if (row.deletedAt !== null) {
    throw new ApiError('not_found', 'This design is in Trash.')
  }
  return row
}

// When each link last wrote an activity row for its pictures.
const pictureAudits = new Map<string, number>()

// A use of the link: its last use, and an activity row naming the link (by its creation time),
// the file and the version and languages asked for.
function useLink(link: Link, file: string, query: { version?: string | undefined; languages?: string | undefined }) {
  const now = Date.now()
  getDb().update(claudeLinks).set({ lastUsedAt: now }).where(eq(claudeLinks.id, link.id)).run()
  if (file === 'pictures') {
    if (now - (pictureAudits.get(link.id) ?? 0) < pictureAuditMs) {
      return
    }
    pictureAudits.set(link.id, now)
    for (const [id, at] of pictureAudits) {
      if (now - at >= pictureAuditMs) {
        pictureAudits.delete(id)
      }
    }
  }
  audit('claude_link_used', {
    designId: link.designId,
    detail: {
      linkId: link.id,
      linkCreatedAt: link.createdAt,
      file,
      ...(query.version !== undefined && { version: query.version }),
      ...(query.languages !== undefined && { languages: query.languages }),
    },
  })
}

// A file of the link: never kept by browsers or proxies (the design changes, the link may go).
function sendText(reply: FastifyReply, type: string, text: string): FastifyReply {
  return reply.header('content-type', `${type}; charset=utf-8`).header('cache-control', 'no-store').send(text)
}

interface PictureForm {
  fields: Record<string, unknown>
  files: NewPicture[]
}

// Reads the picture cache's upload: its fields and its PNG files, each streamed into a temporary
// file under its field name (a step's ID or a Bot setup view, once each). Over a limit it stops
// there and answers too_large.
async function readPictureForm(req: FastifyRequest): Promise<PictureForm> {
  const form: PictureForm = { fields: {}, files: [] }
  const limits = { fileSize: pictureMb * 1024 * 1024, files: 2000, fields: 10, fieldSize: 1000 }
  const tooMany = new ApiError('too_large', `These pictures are bigger than ${String(picturesMb)} MB together.`)
  let total = 0
  try {
    for await (const part of req.parts({ limits })) {
      if (part.type === 'field') {
        form.fields[part.fieldname] = part.value
        continue
      }
      const key = part.fieldname
      if (!StepIdSchema.safeParse(key).success || form.files.some((picture) => picture.key === key)) {
        throw new ApiError('bad_request', 'Each picture is named by its step ID or Bot setup view, once.')
      }
      const tooBig = new ApiError('too_large', `A picture is bigger than ${String(pictureMb)} MB.`)
      part.file.once('limit', () => part.file.destroy(tooBig))
      const file = await writeTemp(part.file)
      form.files.push({ key, file })
      if (part.file.truncated) {
        throw tooBig
      }
      total += file.bytes
      if (total > picturesMb * 1024 * 1024) {
        throw tooMany
      }
    }
  } catch (error) {
    await Promise.all(form.files.map((picture) => rm(picture.file.path, { force: true })))
    throw error
  }
  return form
}

// `<name>.<language>.png`: a step's ID name or a Bot setup view, and a language code.
const pictureFile = /^([a-z][a-z0-9_]{0,47}|[a-z]+(?:-[a-z]+)+)\.([a-z]{2,3}(?:-[a-z0-9]{2,8})*)\.png$/

export const register: Register = (app) => {
  addRoute(app, routes.claudeLinks, ({ params }) => {
    const design = findDesign(params.id)
    const rows = getDb()
      .select({ link: claudeLinks, createdByName: users.name })
      .from(claudeLinks)
      .leftJoin(users, eq(users.id, claudeLinks.createdBy))
      .where(and(eq(claudeLinks.designId, design.id), isNull(claudeLinks.revokedAt)))
      .orderBy(desc(claudeLinks.createdAt))
      .all()
    const links: ClaudeLink[] = rows.map(({ link, createdByName }) => ({
      id: link.id,
      createdAt: link.createdAt,
      createdBy: link.createdBy === null ? null : { id: link.createdBy, name: createdByName ?? '' },
      lastUsedAt: link.lastUsedAt,
    }))
    return { links }
  })

  // "Create link": the addresses carry the token, shown this once.
  addRoute(app, routes.createClaudeLink, ({ user, params }) => {
    const design = findDesign(params.id)
    const token = newToken()
    const row = getDb()
      .insert(claudeLinks)
      .values({
        id: nanoid(),
        designId: design.id,
        tokenHash: hashToken(token),
        createdBy: user.id,
        createdAt: Date.now(),
      })
      .returning()
      .get()
    audit('claude_link_created', { userId: user.id, designId: design.id, detail: { linkId: row.id } })
    const url = linkUrl(token)
    return {
      link: { id: row.id, createdAt: row.createdAt, createdBy: { id: user.id, name: user.name }, lastUsedAt: null },
      urls: { spec: `${url}/spec.json`, doc: `${url}/design.md`, howToRead: `${url}/HOW-TO-READ.md` },
    }
  })

  addRoute(app, routes.revokeClaudeLink, ({ user, params }) => {
    const design = findDesign(params.id)
    const row = getDb()
      .select()
      .from(claudeLinks)
      .where(and(eq(claudeLinks.designId, design.id), eq(claudeLinks.id, params.linkId)))
      .get()
    if (!row) {
      throw new ApiError('not_found', 'This link was not found.')
    }
    if (row.revokedAt === null) {
      getDb().update(claudeLinks).set({ revokedAt: Date.now() }).where(eq(claudeLinks.id, row.id)).run()
      audit('claude_link_revoked', {
        userId: user.id,
        designId: design.id,
        detail: { linkId: row.id, linkCreatedAt: row.createdAt },
      })
    }
    return { ok: true as const }
  })

  addRoute(app, routes.apiKeys, ({ user }) => {
    const rows = getDb()
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt))
      .all()
    return { keys: rows.map(toApiKey) }
  })

  // "Create key": the key is shown this once.
  addRoute(app, routes.createApiKey, ({ user, body }) => {
    const secret = newToken()
    const row = getDb()
      .insert(apiKeys)
      .values({ id: nanoid(), userId: user.id, name: body.name, tokenHash: hashToken(secret), createdAt: Date.now() })
      .returning()
      .get()
    audit('api_key_created', { userId: user.id, detail: { keyId: row.id, name: row.name } })
    return { key: toApiKey(row), secret }
  })

  addRoute(app, routes.revokeApiKey, ({ user, params }) => {
    const row = getDb()
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.userId, user.id)))
      .get()
    if (!row) {
      throw new ApiError('not_found', 'This key was not found.')
    }
    if (row.revokedAt === null) {
      getDb().update(apiKeys).set({ revokedAt: Date.now() }).where(eq(apiKeys.id, row.id)).run()
      audit('api_key_revoked', { userId: user.id, detail: { keyId: row.id, name: row.name } })
    }
    return { ok: true as const }
  })

  // MCP-03a: the Account page's "Connected apps" (docs/plan/17 section 13.6): the person's apps
  // that work, newest first, and whether the site serves its built-in certificate ("The Claude app
  // needs a certificate browsers trust").
  addRoute(app, routes.claudeApps, async ({ user }) => {
    const rows = getDb()
      .select()
      .from(oauthGrants)
      .where(and(eq(oauthGrants.userId, user.id), gt(oauthGrants.expiresAt, Date.now())))
      .orderBy(desc(oauthGrants.createdAt))
      .all()
    let builtInCertificate: boolean | null = null
    try {
      const view = (await control('GET', '/https', { timeoutMs: 5000 })) as HttpsView
      builtInCertificate = view.method === 'builtin'
    } catch {
      // Without the helper (`make dev`) or while it does not answer, the page says nothing of it.
    }
    return { apps: rows.map(toClaudeApp), builtInCertificate }
  })

  // "Disconnect" of the person's own app.
  addRoute(app, routes.disconnectClaudeApp, ({ user, params }) => {
    const row = findApp(params.appId)
    if (row.person.id !== user.id) {
      throw new ApiError('not_found', appGone)
    }
    disconnect(row.app.id)
    audit('claude_app_disconnected', { userId: user.id, detail: { appId: row.app.id, name: row.app.name } })
    return { ok: true as const }
  })

  // The "Allow" page (17 section 13.5): the request of its address, kept for this session.
  addRoute(app, routes.appRequest, ({ user, params }) => ({ request: openAppRequest(params.token, user) }))

  // "Allow": the code goes to the app, which then connects (Activity: "Connected the app ...").
  addRoute(app, routes.allowAppRequest, ({ user, params }) => ({
    redirectTo: answerAppRequest(params.token, user, true),
  }))

  addRoute(app, routes.denyAppRequest, ({ user, params }) => ({
    redirectTo: answerAppRequest(params.token, user, false),
  }))

  // MCP-01b: Settings' "Claude connections" (docs/plan/17 section 13.6), for the site owner:
  // every person's keys and (MCP-03a) connected apps that work, newest first.
  addRoute(app, routes.claudeConnections, () => {
    const keys = selectKeys().where(isNull(apiKeys.revokedAt)).all().map(toConnection)
    const apps = selectApps().where(gt(oauthGrants.expiresAt, Date.now())).all().map(toAppConnection)
    return { connections: [...keys, ...apps].sort((a, b) => b.createdAt - a.createdAt) }
  })

  // "Ask first" on or off (an Activity row), and "can't show questions" set or cleared; both count
  // from the key's (or app's) next call.
  addRoute(app, routes.updateClaudeConnection, ({ user, params, body }) => {
    const { askFirst, cannotAsk } = body
    if (params.kind === 'app') {
      const row = findApp(params.id)
      if (askFirst !== undefined || cannotAsk !== undefined) {
        getDb()
          .update(oauthGrants)
          .set({ ...(askFirst !== undefined && { askFirst }), ...(cannotAsk !== undefined && { cannotAsk }) })
          .where(eq(oauthGrants.id, row.app.id))
          .run()
      }
      if (askFirst !== undefined && askFirst !== row.app.askFirst) {
        audit('ask_first_changed', {
          userId: user.id,
          detail: { kind: 'app', appId: row.app.id, name: row.app.name, on: askFirst, ...ofPerson(row, user.id) },
        })
      }
      return { connection: toAppConnection(findApp(row.app.id)) }
    }
    const row = findKey(params.id)
    if (askFirst !== undefined || cannotAsk !== undefined) {
      getDb()
        .update(apiKeys)
        .set({ ...(askFirst !== undefined && { askFirst }), ...(cannotAsk !== undefined && { cannotAsk }) })
        .where(eq(apiKeys.id, row.key.id))
        .run()
    }
    if (askFirst !== undefined && askFirst !== row.key.askFirst) {
      audit('ask_first_changed', {
        userId: user.id,
        detail: { kind: params.kind, keyId: row.key.id, name: row.key.name, on: askFirst, ...ofPerson(row, user.id) },
      })
    }
    return { connection: toConnection(findKey(row.key.id)) }
  })

  // "Revoke" of anyone's key, or "Disconnect" of anyone's app: it stops working at once.
  addRoute(app, routes.revokeClaudeConnection, ({ user, params }) => {
    if (params.kind === 'app') {
      const connected = findApp(params.id)
      disconnect(connected.app.id)
      audit('claude_app_disconnected', {
        userId: user.id,
        detail: { appId: connected.app.id, name: connected.app.name, ...ofPerson(connected, user.id) },
      })
      return { ok: true as const }
    }
    const row = selectKeys().where(eq(apiKeys.id, params.id)).get()
    if (!row) {
      throw new ApiError('not_found', 'This key was not found.')
    }
    if (row.key.revokedAt === null) {
      getDb().update(apiKeys).set({ revokedAt: Date.now() }).where(eq(apiKeys.id, row.key.id)).run()
      audit('api_key_revoked', {
        userId: user.id,
        detail: { keyId: row.key.id, name: row.key.name, ...ofPerson(row, user.id) },
      })
    }
    return { ok: true as const }
  })

  addRoute(app, routes.uploadPictures, async ({ req, user, params }) => {
    const design = findDesign(params.id)
    const form = await readPictureForm(req)
    try {
      const fields = pictureFields.parse(form.fields)
      if (form.files.length === 0) {
        throw new ApiError('bad_request', 'Send at least one picture.')
      }
      return { pictures: await replacePictures(design.id, fields, form.files, user.id) }
    } finally {
      // Gone already once kept.
      await Promise.all(form.files.map((picture) => rm(picture.file.path, { force: true })))
    }
  })

  addRoute(app, routes.linkSpec, ({ reply, params, query }) => {
    const link = linkOf(params.token)
    const text = specJson(exportOf(link.designId, query.version), parseLanguages(query.languages))
    useLink(link, 'spec.json', query)
    return sendText(reply, 'application/json', text)
  })

  addRoute(app, routes.linkDoc, ({ reply, params, query }) => {
    const link = linkOf(params.token)
    const exp = exportOf(link.designId, query.version)
    const text = designMd(exp, parseLanguages(query.languages), {
      pictures: {
        url: `${linkUrl(params.token)}/pictures`,
        query: exp.versionId === null ? '' : `?version=${exp.versionId}`,
        cacheKey: link.id,
      },
      // The open questions are about the design as it is now, not about a version.
      openQuestions: exp.versionId === null ? openQuestionsOf(link.designId) : [],
    })
    useLink(link, 'design.md', query)
    return sendText(reply, 'text/markdown', text)
  })

  addRoute(app, routes.linkHowToRead, ({ reply, params }) => {
    const link = linkOf(params.token)
    useLink(link, 'HOW-TO-READ.md', {})
    return sendText(reply, 'text/markdown', HOW_TO_READ)
  })

  // A picture of the cache by its name in design.md; the step's ID name is read in the design (or
  // the version) design.md was made from.
  addRoute(app, routes.linkPicture, async ({ reply, params, query }) => {
    const link = linkOf(params.token)
    const match = pictureFile.exec(params.file)
    const [, name = '', lang = ''] = match ?? []
    let key: string | null = null
    if (match) {
      key = pictureViews.has(name) ? name : pictureKey(exportOf(link.designId, query.version).design, name)
    }
    const picture = key === null ? null : findPicture(link.designId, key, lang)
    const size =
      picture === null
        ? null
        : await stat(picture.path).then(
            (stats) => stats.size,
            () => null,
          )
    if (picture === null || size === null) {
      throw new ApiError('not_found', 'This picture is not in the cache. Export the design from xDesign to make it.')
    }
    useLink(link, 'pictures', query)
    return reply
      .header('content-type', 'image/png')
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'no-store')
      .header('x-xdesign-picture-version', String(picture.docVersion))
      .header('content-length', size)
      .send(createReadStream(picture.path))
  })
}
