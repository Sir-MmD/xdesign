// IDs, ID names and languages of the plain model (docs/plan/03-design-model.md sections 2 and 4).
// Every ID is a random nanoid; the schema accepts any short URL-safe string, so fixtures can use
// readable IDs. The ID types are plain strings, named for what they point at.
import { z } from 'zod'

import { ID_NAME_PATTERN } from '../names/id-name.ts'

export const IdSchema = z
  .string()
  .regex(/^[\w-]{1,64}$/, 'should be an ID: up to 64 of A to Z, a to z, 0 to 9, _ and -')
export type Id = z.infer<typeof IdSchema>

// `back` and `stay` are special targets, never step IDs.
export const StepIdSchema = IdSchema.refine((id) => id !== 'back' && id !== 'stay', 'should not be back or stay')
export type StepId = z.infer<typeof StepIdSchema>
export const ButtonIdSchema = IdSchema
export type ButtonId = z.infer<typeof ButtonIdSchema>
export const VarIdSchema = IdSchema
export type VarId = z.infer<typeof VarIdSchema>
export const SwitchIdSchema = IdSchema
export type SwitchId = z.infer<typeof SwitchIdSchema>
export const PartIdSchema = IdSchema
export type PartId = z.infer<typeof PartIdSchema>
export const MediaIdSchema = IdSchema
export type MediaId = z.infer<typeof MediaIdSchema>
// A rich text's ID ties it to its Yjs fragments (texts in section 3).
export const TextIdSchema = IdSchema
export type TextId = z.infer<typeof TextIdSchema>
// A frame is a step of kind `frame`.
export const FrameIdSchema = StepIdSchema
export type FrameId = z.infer<typeof FrameIdSchema>

// Where an arrow goes: a step, or `back` ("the message step the user came from").
export const TargetSchema = z.union([z.literal('back'), StepIdSchema])
export type Target = z.infer<typeof TargetSchema>

export const IdNameSchema = z
  .string()
  .regex(ID_NAME_PATTERN, 'should be an ID name: a letter a to z, then up to 47 of a to z, 0 to 9 and _')
export type IdName = z.infer<typeof IdNameSchema>

// A language code as Telegram sends it in `language_code`: an IETF tag such as en, fa or pt-br.
export const LangSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/, 'should be a language code such as en or pt-br')
export type Lang = z.infer<typeof LangSchema>
