// The fields of a question step (docs/plan/03-design-model.md section 2.8); steps.ts adds the
// common step fields.
import { z } from 'zod'

import { KeyboardSchema } from './buttons.ts'
import { ContentSchema } from './content.ts'
import { StepIdSchema, VarIdSchema } from './ids.ts'
import { OptionsSchema } from './options.ts'
import { LangTextSchema, RichTextRefSchema } from './texts.ts'

// What the bot asks, as a message; its inline buttons ("Skip") have their own targets.
export const PromptSchema = z.object({ content: ContentSchema, keyboard: KeyboardSchema, options: OptionsSchema })
export type Prompt = z.infer<typeof PromptSchema>

// `phone` accepts a shared contact or typed digits; `location` a shared location or venue.
export const ExpectsSchema = z.enum([
  'text',
  'number',
  'email',
  'phone',
  'location',
  'photo',
  'video',
  'file',
  'voice',
  'audio',
  'any',
])
export type Expects = z.infer<typeof ExpectsSchema>

// The checks of an answer (`checks` of the step).
export const AnswerChecksSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  wholeNumber: z.boolean().optional(),
  pattern: z.enum(['email', 'url', 'phone', 'date']).optional(),
  maxFileMb: z.number().optional(),
  fileTypes: z.array(z.string()).optional(),
})
export type AnswerChecks = z.infer<typeof AnswerChecksSchema>

export const WrongAnswerSchema = z.object({
  message: RichTextRefSchema,
  maxTries: z.number().optional(),
  afterMaxTries: StepIdSchema.optional(),
})
export type WrongAnswer = z.infer<typeof WrongAnswerSchema>

// Words that cancel the question, such as "Cancel" or "انصراف".
export const CancelSchema = z.object({ words: LangTextSchema, goTo: StepIdSchema.optional() })
export type Cancel = z.infer<typeof CancelSchema>

export const QuestionFieldsSchema = z.object({
  kind: z.literal('question'),
  prompt: PromptSchema,
  expects: ExpectsSchema,
  checks: AnswerChecksSchema,
  saveTo: VarIdSchema,
  wrongAnswer: WrongAnswerSchema,
  cancel: CancelSchema.optional(),
  // After a valid answer.
  next: StepIdSchema.optional(),
})
export type QuestionFields = z.infer<typeof QuestionFieldsSchema>
