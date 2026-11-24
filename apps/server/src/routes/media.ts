// Uploads and media files (mediaRoutes of @xdesign/api, docs/plan/02 sections 6 and 8): a file is
// checked by its content for its kind and kept once per server by its SHA-256; it is served only
// after the role check on its design (or for a view link of that design, VIEW-01), with headers
// that keep the browser to the checked type.
import { createReadStream } from 'node:fs'
import { open, rm, stat } from 'node:fs/promises'

import { routes, uploadFields, type UploadKind } from '@xdesign/api'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { nanoid } from 'nanoid'
import type { z } from 'zod'

import { getDb } from '../db/index.ts'
import { designs, media } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import { detectType, headBytes, refusal, type FileType } from '../media/detect.ts'
import { readImageSize, type ImageSize } from '../media/image.ts'
import { keepTemp, mediaPath, writeTemp, type TempFile } from '../media/store.ts'
import { addRoute, type Register } from '../route.ts'
import { readSettings } from '../settings.ts'

type MediaRow = typeof media.$inferSelect

function toMedia(row: MediaRow) {
  return {
    id: row.id,
    // Only the upload route writes rows, with a checked kind.
    kind: row.kind as UploadKind,
    mime: row.mime,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    originalName: row.originalName,
    sha256: row.sha256,
    uploadedAt: row.uploadedAt,
  }
}

interface Form {
  fields: Record<string, unknown>
  file: TempFile | null
  // The file's name on the person's computer.
  name: string | null
}

// Reads the form: its fields and its one file, streamed into a temporary file. A file over the
// limit stops there and answers too_large.
async function readForm(req: FastifyRequest, limitMb: number): Promise<Form> {
  const form: Form = { fields: {}, file: null, name: null }
  const limits = { fileSize: limitMb * 1024 * 1024, files: 1, fields: 10, fieldSize: 1000 }
  try {
    for await (const part of req.parts({ limits })) {
      if (part.type === 'field') {
        form.fields[part.fieldname] = part.value
        continue
      }
      const tooBig = new ApiError('too_large', `This file is bigger than ${String(limitMb)} MB.`)
      part.file.once('limit', () => part.file.destroy(tooBig))
      form.file = await writeTemp(part.file)
      // A part without a name (sent as application/octet-stream) has none, whatever its type says.
      form.name = part.filename ? part.filename.slice(0, 255) : null
      if (part.file.truncated) {
        throw tooBig
      }
    }
  } catch (error) {
    if (form.file) {
      await rm(form.file.path, { force: true })
    }
    throw error
  }
  return form
}

interface Checked {
  type: FileType
  image: ImageSize | null
}

// Detects the file's type from its first bytes, refuses it when the kind does not take it, and
// reads an image's sides.
async function check(file: TempFile, kind: UploadKind): Promise<Checked> {
  if (file.bytes === 0) {
    throw new ApiError('bad_request', 'This file is empty.')
  }
  const handle = await open(file.path)
  try {
    const head = Buffer.alloc(Math.min(headBytes, file.bytes))
    await handle.read(head, 0, head.length, 0)
    const type = detectType(head)
    const problem = refusal(kind, type)
    if (problem) {
      throw new ApiError('bad_request', problem)
    }
    return { type, image: await readImageSize(handle, type, head) }
  } finally {
    await handle.close()
  }
}

// The numbers a row keeps: an image's sides as the server read them; for video and audio the
// browser's probe (audio has no sides); nothing for other files.
function measures({ type, image }: Checked, fields: z.output<typeof uploadFields>) {
  if (type.startsWith('image/')) {
    return { width: image?.width ?? null, height: image?.height ?? null, durationMs: null }
  }
  const durationMs = fields.durationMs ?? null
  if (type.startsWith('video/')) {
    return { width: fields.width ?? null, height: fields.height ?? null, durationMs }
  }
  return { width: null, height: null, durationMs: type.startsWith('audio/') ? durationMs : null }
}

// Keeps an upload of a design: its fields read, its type checked from its content for its kind,
// the file kept by its hash and its row made. The temporary file is gone afterwards. Claude's
// xdesign_upload_picture keeps its files here too (src/claude/files.ts, MCP-02b).
export async function keepUpload(
  designId: string,
  file: TempFile,
  name: string | null,
  formFields: Record<string, unknown>,
  userId: string,
) {
  try {
    const fields = uploadFields.parse(formFields)
    const checked = await check(file, fields.kind)
    await keepTemp(file)
    const db = getDb()
    // One row per design, file and kind: the same upload again answers the row it made. The
    // look-up and the insert run in one go (better-sqlite3 is synchronous).
    const same = db
      .select()
      .from(media)
      .where(and(eq(media.designId, designId), eq(media.sha256, file.sha256), eq(media.kind, fields.kind)))
      .get()
    const row =
      same ??
      db
        .insert(media)
        .values({
          id: nanoid(),
          designId,
          sha256: file.sha256,
          kind: fields.kind,
          mime: checked.type,
          bytes: file.bytes,
          ...measures(checked, fields),
          originalName: name,
          uploadedBy: userId,
          uploadedAt: Date.now(),
        })
        .returning()
        .get()
    return toMedia(row)
  } finally {
    // Gone already once kept.
    await rm(file.path, { force: true })
  }
}

// The design of a media file, for the role check; null when there is no such file.
function designOfMedia(mediaId: string): string | null {
  const row = getDb().select({ designId: media.designId }).from(media).where(eq(media.id, mediaId)).get()
  return row?.designId ?? null
}

// Media the phone shows opens in the page; a file (document) downloads, under its own name.
function disposition(row: MediaRow): string {
  if (row.kind !== 'document') {
    return 'inline'
  }
  if (!row.originalName) {
    return 'attachment'
  }
  // RFC 5987: percent-encoded UTF-8, with the characters encodeURIComponent leaves encoded too.
  const name = encodeURIComponent(row.originalName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename*=UTF-8''${name}`
}

interface ByteRange {
  start: number
  end: number
}

// The one byte range a `Range: bytes=` header asks for (both ends included); null sends the whole
// file (no header, several ranges, or one that is not valid), 'unsatisfiable' starts past the end.
function readRange(header: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null
  const [, from = '', to = ''] = match ?? []
  if (!match || (from === '' && to === '')) {
    return null
  }
  if (from === '') {
    // The last `to` bytes.
    const length = Number(to)
    return length === 0 ? 'unsatisfiable' : { start: Math.max(0, size - length), end: size - 1 }
  }
  const start = Number(from)
  const end = to === '' ? size - 1 : Math.min(Number(to), size - 1)
  if (start >= size) {
    return 'unsatisfiable'
  }
  return end < start ? null : { start, end }
}

export const register: Register = (app) => {
  addRoute(app, routes.uploadMedia, async ({ req, params, user }) => {
    const design = getDb()
      .select({ id: designs.id })
      .from(designs)
      .where(and(eq(designs.id, params.id), isNull(designs.deletedAt)))
      .get()
    if (!design) {
      throw new ApiError('not_found')
    }
    const form = await readForm(req, readSettings().uploadLimitMb)
    const { file } = form
    if (!file) {
      throw new ApiError('bad_request', 'Choose a file to upload.')
    }
    return { media: await keepUpload(design.id, file, form.name, form.fields, user.id) }
  })

  addRoute(
    app,
    routes.mediaFile,
    async ({ req, reply, params }) => {
      const row = getDb().select().from(media).where(eq(media.id, params.mediaId)).get()
      if (!row) {
        throw new ApiError('not_found')
      }
      const path = mediaPath(row.sha256)
      const size = await stat(path).then(
        (stats) => stats.size,
        () => null,
      )
      if (size === null) {
        throw new ApiError('not_found')
      }
      const range = readRange(req.headers.range, size)
      if (range === 'unsatisfiable') {
        return reply
          .code(416)
          .header('content-range', `bytes */${String(size)}`)
          .send()
      }
      const { start, end } = range ?? { start: 0, end: size - 1 }
      if (range) {
        reply.code(206).header('content-range', `bytes ${String(start)}-${String(end)}/${String(size)}`)
      }
      return (
        reply
          .header('content-type', row.mime === 'text/plain' ? 'text/plain; charset=utf-8' : row.mime)
          .header('x-content-type-options', 'nosniff')
          .header('content-disposition', disposition(row))
          // The address names one content for good (content-addressed): the browser keeps it.
          .header('cache-control', 'private, max-age=31536000, immutable')
          .header('accept-ranges', 'bytes')
          .header('content-length', end - start + 1)
          .send(createReadStream(path, { start, end }))
      )
    },
    { designOf: ({ mediaId }) => (mediaId ? designOfMedia(mediaId) : null), viewLink: true },
  )
}
