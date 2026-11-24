// Parts and media (docs/plan/03-design-model.md section 2.11). A row part is placed in a keyboard
// as a `part` row, with the same buttons everywhere; a text part is a `part` node in a rich text.
// "Detach" copies the part's buttons or text into the step and removes the reference.
import { z } from 'zod'

import { ButtonIdSchema, IdNameSchema, MediaIdSchema, PartIdSchema } from './ids.ts'
import { RichTextRefSchema } from './texts.ts'

export const PartBaseSchema = z.object({
  id: PartIdSchema,
  idName: IdNameSchema,
  // True once the ID name was edited by hand or exported; until then it follows the name.
  idNameFixed: z.boolean().optional(),
  name: z.string(),
})
export type PartBase = z.infer<typeof PartBaseSchema>

export const RowsPartSchema = PartBaseSchema.extend({
  kind: z.literal('rows'),
  place: z.enum(['inline', 'reply']),
  rows: z.array(z.array(ButtonIdSchema)),
})
export type RowsPart = z.infer<typeof RowsPartSchema>

export const TextPartSchema = PartBaseSchema.extend({ kind: z.literal('text'), text: RichTextRefSchema })
export type TextPart = z.infer<typeof TextPartSchema>

export const PartSchema = z.discriminatedUnion('kind', [RowsPartSchema, TextPartSchema])
export type Part = z.infer<typeof PartSchema>

// The kinds of message content a file can be sent as.
export const MediaKindSchema = z.enum([
  'photo',
  'livePhoto',
  'video',
  'animation',
  'audio',
  'voice',
  'document',
  'videoNote',
  'sticker',
])
export type MediaKind = z.infer<typeof MediaKindSchema>

// An uploaded file; `serverId` is its ID on the xDesign server.
export const MediaItemSchema = z.object({
  id: MediaIdSchema,
  serverId: z.string(),
  kind: MediaKindSchema,
  name: z.string(),
  mime: z.string(),
  bytes: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationMs: z.number().optional(),
})
export type MediaItem = z.infer<typeof MediaItemSchema>
