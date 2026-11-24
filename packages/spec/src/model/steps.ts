// The steps: the boxes on the map (docs/plan/03-design-model.md section 2.2), stage 1 kinds, then
// the invoice and the action (stage 2, sections 7.1 and 7.3).
// Arrows are fields of their source (D-08). Every arrow is optional, since a new box has none
// yet; the checks report the missing ones.
import { z } from 'zod'

import { ActionSchema } from './actions.ts'
import { KeyboardSchema } from './buttons.ts'
import { ConditionSchema, RememberActionSchema } from './conditions.ts'
import { ContentSchema } from './content.ts'
import { FrameIdSchema, IdNameSchema, IdSchema, StepIdSchema, type Target, TargetSchema, VarIdSchema } from './ids.ts'
import { CheckoutSchema, InvoiceSchema } from './invoice.ts'
import { OptionsSchema } from './options.ts'
import { QuestionFieldsSchema } from './question.ts'
import { TriggerSchema } from './triggers.ts'

export const StepBaseSchema = z.object({
  id: StepIdSchema,
  idName: IdNameSchema,
  // True once the ID name was edited by hand or exported; until then it follows the title.
  idNameFixed: z.boolean().optional(),
  // The name on the map box.
  title: z.string(),
  // The position on the map.
  x: z.number(),
  y: z.number(),
  // The designer's note for the developer.
  note: z.string().optional(),
  // The section frame it sits in (map only).
  frame: FrameIdSchema.optional(),
})
export type StepBase = z.infer<typeof StepBaseSchema>

export const StartStepSchema = StepBaseSchema.extend({
  kind: z.literal('start'),
  trigger: TriggerSchema,
  next: TargetSchema.optional(),
})
export type StartStep = z.infer<typeof StartStepSchema>

// The bot sends something; `next` goes on without a click ("Then"), every button has its own
// target. `onStop` is "If the user stops it" (the update stopped_message_generation) of a message
// written out like a draft with a stop button (`draftStops`).
export const MessageStepSchema = StepBaseSchema.extend({
  kind: z.literal('message'),
  content: ContentSchema,
  keyboard: KeyboardSchema,
  options: OptionsSchema,
  next: TargetSchema.optional(),
  onStop: TargetSchema.optional(),
})
export type MessageStep = z.infer<typeof MessageStepSchema>

/**
 * Whether a message is written out like a draft with a stop button: a text or rich message
 * with "Write it out like a draft" and "Let the user stop it" (can_stop, RICH-02).
 */
export function draftStops(step: MessageStep): boolean {
  const { content, options } = step
  return options.draft === true && options.draftStop === true && (content.type === 'text' || content.type === 'rich')
}

/** Where a message goes when the user stops its draft: its `onStop` while `draftStops`, else nowhere. */
export function stopTarget(step: MessageStep): Target | undefined {
  return draftStops(step) ? step.onStop : undefined
}

// The bot asks and waits for an answer.
export const QuestionStepSchema = StepBaseSchema.extend(QuestionFieldsSchema.shape)
export type QuestionStep = z.infer<typeof QuestionStepSchema>

export const IfCaseSchema = z.object({
  id: IdSchema,
  label: z.string(),
  when: ConditionSchema,
  goTo: TargetSchema.optional(),
})
export type IfCase = z.infer<typeof IfCaseSchema>

// Choose a way by conditions: a case's `goTo`, or `otherwise`.
export const IfStepSchema = StepBaseSchema.extend({
  kind: z.literal('if'),
  cases: z.array(IfCaseSchema),
  otherwise: TargetSchema.optional(),
})
export type IfStep = z.infer<typeof IfStepSchema>

// Set, clear or change variables.
export const RememberStepSchema = StepBaseSchema.extend({
  kind: z.literal('remember'),
  actions: z.array(RememberActionSchema),
  next: TargetSchema.optional(),
})
export type RememberStep = z.infer<typeof RememberStepSchema>

// Wait before going on; `ifUserActs` is what happens to the wait when the user does something
// meanwhile (`cancel` is the default). A reminder stops waiting only when `stopWhen` holds (with
// `cancel` only): it is checked each time the user does something and when the time is up ("Stop
// waiting" when the user has paid).
export const WaitStepSchema = StepBaseSchema.extend({
  kind: z.literal('wait'),
  amount: z.number(),
  unit: z.enum(['seconds', 'minutes', 'hours', 'days']),
  ifUserActs: z.enum(['cancel', 'keep']),
  stopWhen: ConditionSchema.optional(),
  next: TargetSchema.optional(),
})
export type WaitStep = z.infer<typeof WaitStepSchema>

export const OutcomeSchema = z.object({ id: IdSchema, label: z.string(), goTo: TargetSchema.optional() })
export type Outcome = z.infer<typeof OutcomeSchema>

// A job only the developer can do; a new one has the single outcome "Done".
export const DevStepSchema = StepBaseSchema.extend({
  kind: z.literal('devStep'),
  // Multi-line plain text.
  description: z.string(),
  uses: z.array(VarIdSchema),
  sets: z.array(VarIdSchema),
  outcomes: z.array(OutcomeSchema),
})
export type DevStep = z.infer<typeof DevStepSchema>

// Jump to a step elsewhere on the map (keeps the map tidy).
export const GoToStepSchema = StepBaseSchema.extend({ kind: z.literal('goTo'), target: TargetSchema.optional() })
export type GoToStep = z.infer<typeof GoToStepSchema>

// The conversation ends here; the next message goes to the fallback start point.
export const EndStepSchema = StepBaseSchema.extend({ kind: z.literal('end') })
export type EndStep = z.infer<typeof EndStepSchema>

// A sticky note on the map for the team; no arrows; exported in design.md only.
export const NoteStepSchema = StepBaseSchema.extend({ kind: z.literal('note'), text: z.string(), color: z.string() })
export type NoteStep = z.infer<typeof NoteStepSchema>

// A named section of the map ("Shop", "Support"; the name is the title); steps inside belong to it.
export const FrameStepSchema = StepBaseSchema.extend({
  kind: z.literal('frame'),
  width: z.number(),
  height: z.number(),
  color: z.string(),
})
export type FrameStep = z.infer<typeof FrameStepSchema>

// A payment request (sendInvoice): the keyboard's first button is the pay button; `next` is
// where the user goes once paid (successful_payment).
export const InvoiceStepSchema = StepBaseSchema.extend({
  kind: z.literal('invoice'),
  invoice: InvoiceSchema,
  keyboard: KeyboardSchema,
  options: OptionsSchema,
  checkout: CheckoutSchema.optional(),
  next: TargetSchema.optional(),
})
export type InvoiceStep = z.infer<typeof InvoiceStepSchema>

// A Telegram action without a message (a reaction, a pin, a gift, ...), then `next`.
export const ActionStepSchema = StepBaseSchema.extend({
  kind: z.literal('action'),
  action: ActionSchema,
  next: TargetSchema.optional(),
})
export type ActionStep = z.infer<typeof ActionStepSchema>

export const StepSchema = z.discriminatedUnion('kind', [
  StartStepSchema,
  MessageStepSchema,
  QuestionStepSchema,
  IfStepSchema,
  RememberStepSchema,
  WaitStepSchema,
  DevStepSchema,
  GoToStepSchema,
  EndStepSchema,
  NoteStepSchema,
  FrameStepSchema,
  InvoiceStepSchema,
  ActionStepSchema,
])
export type Step = z.infer<typeof StepSchema>
export type StepKind = Step['kind']
