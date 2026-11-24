// Media of a design (docs/plan/02 sections 6 and 8, 04 section 5.4): uploads and the files.
import { z } from 'zod'

import { id, time, token } from '../common.ts'
import { defineRoute } from '../route.ts'

// The kinds a file is uploaded for: the content kinds of the Telegram catalog (MediaKind of
// @xdesign/spec) and the bot's profile photo. Each takes its own file types.
export const uploadKinds = [
  'photo',
  'livePhoto',
  'video',
  'animation',
  'audio',
  'voice',
  'document',
  'videoNote',
  'sticker',
  'botPhoto',
] as const
export const uploadKind = z.enum(uploadKinds)
export type UploadKind = z.output<typeof uploadKind>

// The form fields beside the file. The numbers come from the browser's probe: the server reads
// the sides of images itself and keeps the numbers only for video and audio.
export const uploadFields = z.object({
  kind: uploadKind,
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  durationMs: z.coerce.number().int().nonnegative().optional(),
})

export const media = z.object({
  id,
  // The kind the file was checked for.
  kind: uploadKind,
  mime: z.string(),
  bytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  originalName: z.string().nullable(),
  sha256: z.string(),
  uploadedAt: time,
})

export const mediaRoutes = {
  // "Upload a file": a multipart form with `uploadFields` and one file; type and size are checked
  // from the content. The same file uploaded again for the same design and kind answers its row.
  uploadMedia: defineRoute({
    key: 'uploadMedia',
    method: 'POST',
    path: '/api/designs/:id/media',
    params: z.object({ id }),
    multipart: true,
    response: z.object({ media }),
    auth: { design: 'editor' },
  }),
  // The file itself (not JSON; pages use the path as a source). The role is checked on the
  // media's design: the server finds it from `:mediaId`. The page of a view-only link has no
  // session and sends its token as `view` instead (VIEW-01): it opens that design's files only.
  mediaFile: defineRoute({
    key: 'mediaFile',
    method: 'GET',
    path: '/api/media/:mediaId',
    params: z.object({ mediaId: id }),
    query: z.object({ view: token.optional() }),
    response: z.instanceof(Uint8Array),
    auth: { design: 'viewer' },
  }),
}
