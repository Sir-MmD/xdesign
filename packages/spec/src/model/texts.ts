// Plain and rich texts of the plain model (docs/plan/03-design-model.md sections 2.1 and 5). A
// language without a text yet is left out.
import { z } from 'zod'

import { RichDocSchema } from '../text/schema.ts'
import { LangSchema, TextIdSchema } from './ids.ts'

// A plain text per language: labels, names, popups.
export const LangTextSchema = z.partialRecord(LangSchema, z.string())
export type LangText = z.infer<typeof LangTextSchema>

// A rich text per language: TipTap JSON (section 5.1).
export const RichTextSchema = z.partialRecord(LangSchema, RichDocSchema)
export type RichText = z.infer<typeof RichTextSchema>

// A rich text where the model uses one: `id` ties it to its Yjs fragments (section 3), `doc`
// holds the documents, so readers need nothing else.
export const RichTextRefSchema = z.object({ id: TextIdSchema, doc: RichTextSchema })
export type RichTextRef = z.infer<typeof RichTextRefSchema>
