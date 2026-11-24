// Conditions of "If" boxes and remember actions (docs/plan/03-design-model.md section 2.10).
import { z } from 'zod'

import { LangSchema, StepIdSchema, SwitchIdSchema, VarIdSchema } from './ids.ts'

// A value to compare with or to remember: typed text, a number, yes or no, or another variable.
export const ValueSchema = z.union([z.string(), z.number(), z.boolean(), z.object({ var: VarIdSchema })])
export type Value = z.infer<typeof ValueSchema>

export const ConditionItemSchema = z.union([
  z.object({
    var: VarIdSchema,
    op: z.enum(['isSet', 'isEmpty', 'equals', 'notEquals', 'contains', 'startsWith', 'gt', 'gte', 'lt', 'lte']),
    value: ValueSchema.optional(),
  }),
  z.object({ switch: SwitchIdSchema, is: z.union([z.boolean(), z.string()]) }),
  // The user's language is one of these.
  z.object({ language: z.array(LangSchema) }),
  // The user is a member of a channel or a chat the bot is in (@channel or a chat ID).
  z.object({ memberOf: z.string() }),
  // Stage 2: the user paid this invoice step (and it was not refunded), or its subscription is
  // active.
  z.object({ hasPaid: StepIdSchema }),
  z.object({ subscribed: StepIdSchema }),
])
export type ConditionItem = z.infer<typeof ConditionItemSchema>

export const ConditionSchema = z.union([
  z.object({ all: z.array(ConditionItemSchema) }),
  z.object({ any: z.array(ConditionItemSchema) }),
])
export type Condition = z.infer<typeof ConditionSchema>

export const RememberActionSchema = z.object({
  var: VarIdSchema,
  op: z.enum(['set', 'clear', 'add', 'subtract', 'append']),
  value: ValueSchema.optional(),
})
export type RememberAction = z.infer<typeof RememberActionSchema>
