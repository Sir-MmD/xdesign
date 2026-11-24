// Pictures, files and imports for Claude (docs/plan/17 section 13.2, MCP-02b), in place of the
// upload and import routes it cannot send files to (D-657). xdesign_upload_picture keeps a file
// sent as base64 as "Upload a file" keeps one (keepUpload of src/routes/media.ts: the site's
// upload limit, the type checked from the content for its kind, one row per design, file and
// kind), then adds it to the design's files as the editor does, or gives it to a file an import
// left without its upload, as one change by the person (editDesignAs). xdesign_import_design sends
// spec.json to the import route as the person (callRoute), as Import does; the new design's files
// wait for their uploads.
import { Readable } from 'node:stream'

import { hasRole, routes, type UploadKind } from '@xdesign/api'
import { designEdits, readDesign, type Design, type MediaItem, type MediaKind } from '@xdesign/spec'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { getDesignRole } from '../auth/context.ts'
import { ApiError } from '../errors.ts'
import { editDesignAs } from '../live/server.ts'
import { writeTemp } from '../media/store.ts'
import { keepUpload } from '../routes/media.ts'
import { readSettings } from '../settings.ts'
import { callRoute, uploadTool } from './actions.ts'
import { exportOf } from './export.ts'
import { auditKeyUse, type KeyUser } from './keys.ts'

const mb = 1024 * 1024

// Who adds the file in the document; the change reaches the design as the person's.
const fileOrigin = Symbol('claude-file')

export interface UploadArgs {
  design: string
  name: string
  data: string
  kind?: UploadKind | undefined
  file?: string | undefined
}

// A file of the design that an import left without its upload, by its ID or name.
function waitingFile(design: Design, given: string): MediaItem {
  const waiting = Object.values(design.media).filter((item) => item.serverId === '')
  const found = waiting.find((item) => item.id === given) ?? waiting.find((item) => item.name === given)
  if (!found) {
    throw new ApiError('not_found', `This design has no file ${given} waiting for its upload.`)
  }
  return found
}

// Keeps the file for the design and adds it to the design's files (the one it has for that file
// and kind, else a new one), or gives it to the file waiting for it.
export async function uploadPicture(key: KeyUser, args: UploadArgs) {
  const role = getDesignRole(key.id, args.design)
  if (role === null) {
    throw new ApiError('not_found', 'This design was not found.')
  }
  if (!hasRole(role, 'editor')) {
    throw new ApiError('no_access', 'You can open this design but not edit it.')
  }
  const waiting = args.file === undefined ? undefined : waitingFile(exportOf(args.design).design, args.file)
  const kind = waiting?.kind ?? args.kind ?? 'photo'
  const limitMb = readSettings().uploadLimitMb
  // A data URL's head is not part of the file.
  const bytes = Buffer.from(args.data.replace(/^data:[^,]*,/, ''), 'base64')
  if (bytes.length > limitMb * mb) {
    throw new ApiError('too_large', `This file is bigger than ${String(limitMb)} MB.`)
  }
  const row = await keepUpload(args.design, await writeTemp(Readable.from(bytes)), args.name, { kind }, key.id)
  // The bot's profile photo goes up as botPhoto and is a photo or a video among the files.
  const itemKind: MediaKind = kind === 'botPhoto' ? (row.mime.startsWith('video/') ? 'video' : 'photo') : kind
  const edited = await editDesignAs(args.design, key.id, (doc): MediaItem => {
    const { media } = readDesign(doc)
    const edits = designEdits(doc, fileOrigin)
    if (waiting) {
      const item = media[waiting.id]
      if (item?.serverId !== '') {
        throw new ApiError('conflict', 'This file was changed meanwhile. Read the design again.')
      }
      edits.media.setServerId(item.id, row.id)
      return { ...item, serverId: row.id }
    }
    const known = Object.values(media).find((item) => item.serverId === row.id && item.kind === itemKind)
    if (known) {
      return known
    }
    const item = {
      serverId: row.id,
      kind: itemKind,
      name: args.name,
      mime: row.mime,
      bytes: row.bytes,
      ...(row.width === null ? {} : { width: row.width }),
      ...(row.height === null ? {} : { height: row.height }),
      ...(row.durationMs === null ? {} : { durationMs: row.durationMs }),
    }
    return { id: edits.media.add(item), ...item }
  })
  if (edited === null) {
    throw new ApiError('too_large', 'This design is too big to save more changes.')
  }
  auditKeyUse(key, args.design, { tool: uploadTool, file: args.name })
  const file = edited.value
  return {
    design: args.design,
    file: { id: file.id, name: file.name, kind: file.kind, mime: file.mime, bytes: file.bytes },
    note: `Name it in the design edits by its id or name: { "media": "${file.id}" } in a step's content, or file in media.rename and media.remove.`,
  }
}

const imported = z.object({
  design: z.object({ id: z.string(), name: z.string() }),
  files: z.record(z.string(), z.string()),
})

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// spec.json as given: its JSON text, or the object.
function specOf(spec: unknown): unknown {
  if (typeof spec !== 'string') {
    return spec
  }
  try {
    return JSON.parse(spec) as unknown
  } catch {
    throw new ApiError('bad_request', 'This spec.json is not JSON.')
  }
}

// A new design of the person from spec.json, named `name` when it is given, through the import
// route; its files wait for their uploads (xdesign_upload_picture with file).
export async function importSpec(app: FastifyInstance, spec: unknown, name: string | undefined) {
  const read = specOf(spec)
  const sent =
    name !== undefined && isObject(read) && isObject(read.design) ? { ...read, design: { ...read.design, name } } : read
  const answer = imported.parse(await callRoute(app, routes.importDesign, { body: { spec: sent } }))
  const { media } = exportOf(answer.design.id).design
  const files = Object.entries(answer.files).map(([id, path]) => ({
    id,
    name: media[id]?.name ?? path,
    kind: media[id]?.kind,
    path,
  }))
  return {
    design: answer.design,
    ...(files.length > 0 && {
      files,
      note: `These files wait for their uploads: send each with ${uploadTool} (the design, file: its id, a name and its data).`,
    }),
  }
}
