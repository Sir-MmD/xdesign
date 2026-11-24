// The design: one bot (docs/plan/03-design-model.md section 2.1). The schema checks the shape and
// what every reader relies on: the default language is in the list, and each item of a
// collection is stored under its own ID. Everything else (arrows into missing steps, Telegram's
// limits, unique ID names) is for the checks.
import { z } from 'zod'

import { BotSetupSchema } from './bot.ts'
import { ButtonSchema } from './buttons.ts'
import {
  ButtonIdSchema,
  IdSchema,
  LangSchema,
  MediaIdSchema,
  PartIdSchema,
  StepIdSchema,
  SwitchIdSchema,
  VarIdSchema,
} from './ids.ts'
import { MediaItemSchema, PartSchema } from './parts.ts'
import { StepSchema } from './steps.ts'
import { TestSwitchSchema, VariableSchema } from './variables.ts'

export const LanguagesSchema = z.object({ default: LangSchema, list: z.array(LangSchema).min(1) })
export type Languages = z.infer<typeof LanguagesSchema>

const collections = ['steps', 'buttons', 'variables', 'switches', 'parts', 'media'] as const

export const DesignSchema = z
  .object({
    formatVersion: z.literal(1),
    id: IdSchema,
    name: z.string(),
    languages: LanguagesSchema,
    bot: BotSetupSchema,
    steps: z.record(StepIdSchema, StepSchema),
    buttons: z.record(ButtonIdSchema, ButtonSchema),
    variables: z.record(VarIdSchema, VariableSchema),
    switches: z.record(SwitchIdSchema, TestSwitchSchema),
    parts: z.record(PartIdSchema, PartSchema),
    media: z.record(MediaIdSchema, MediaItemSchema),
    // The checks marked "Ignore here" (04 section 9) by key,
    // `<code>:<stepId>[:<buttonId>][:<language>]` (issueKey in checks/issues.ts); errors cannot be
    // ignored.
    ignoredChecks: z.array(z.string()).optional(),
    // The texts "Copy the default language into empty cells" filled (04 section 10), by key
    // (`textKey` in ydoc/texts.ts) with the fingerprint of the words copied: such a text shows as
    // not translated while it still has them. Not exported.
    copiedTexts: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((design, ctx) => {
    const { list } = design.languages
    if (!list.includes(design.languages.default)) {
      ctx.addIssue({
        code: 'custom',
        path: ['languages', 'default'],
        message: 'should be one of the languages in the list',
      })
    }
    if (new Set(list).size !== list.length) {
      ctx.addIssue({ code: 'custom', path: ['languages', 'list'], message: 'has a language more than once' })
    }
    for (const collection of collections) {
      const items: Record<string, { id: string }> = design[collection]
      for (const [key, item] of Object.entries(items)) {
        if (item.id !== key) {
          ctx.addIssue({
            code: 'custom',
            path: [collection, key, 'id'],
            message: `should be ${key}, the key it is under`,
          })
        }
      }
    }
  })
export type Design = z.infer<typeof DesignSchema>

// A problem of a value that is not a design: where (`steps.k3x.trigger.type`, empty for the
// whole value) and what, in plain words ("is missing").
export type DesignProblem = { path: string; message: string }
export type DesignResult = { ok: true; design: Design } | { ok: false; problems: DesignProblem[] }

/** Reads an unknown value (an import, a fixture) as a design, or lists its problems. */
export function validateDesign(x: unknown): DesignResult {
  const result = DesignSchema.safeParse(x, { error: plainMessage })
  if (result.success) return { ok: true, design: result.data }
  return {
    ok: false,
    problems: result.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
  }
}

const typeWords: Partial<Record<string, string>> = {
  string: 'a text',
  number: 'a number',
  boolean: 'true or false',
  array: 'a list',
  object: 'an object',
  record: 'an object',
}

// Zod's issues in plain words. The schemas' own messages (IDs, ID names, languages) come first.
// The import of an export (fromSpec) uses it too.
export function plainMessage(issue: z.core.$ZodRawIssue): string {
  const quote = (value: unknown) => (typeof value === 'string' ? `"${value}"` : String(value))
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? 'is missing' : `should be ${typeWords[issue.expected] ?? issue.expected}`
    case 'invalid_value':
      return `should be ${issue.values.map(quote).join(' or ')}`
    case 'invalid_union': {
      // A discriminated union names its choices; a plain one only says that none fits.
      const options: unknown[] = Array.isArray(issue.options) ? issue.options : []
      return options.length > 0
        ? `should be one of ${options.map(quote).join(', ')}`
        : 'does not match any of the allowed forms'
    }
    case 'too_small':
      return issue.origin === 'array'
        ? `should have at least ${String(issue.minimum)} items`
        : `should be at least ${String(issue.minimum)}`
    case 'too_big':
      return issue.origin === 'array'
        ? `should have at most ${String(issue.maximum)} items`
        : `should be at most ${String(issue.maximum)}`
    case 'invalid_format':
      return 'is not in the right form'
    case 'invalid_key':
      return 'is not a valid key'
    default:
      return 'is not valid'
  }
}
