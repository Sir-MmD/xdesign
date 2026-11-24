// Keyboards and buttons (docs/plan/03-design-model.md section 2.5), stage 1 kinds. Buttons live in
// the design's `buttons`; keyboards and row parts list them by ID, so a button is one button
// wherever it shows. Left out on purpose (D-11): web_app, switch_inline_query*, callback_game.
import { z } from 'zod'

import { RememberActionSchema } from './conditions.ts'
import { ButtonIdSchema, IdNameSchema, PartIdSchema, StepIdSchema, TargetSchema, VarIdSchema } from './ids.ts'
import { LangTextSchema } from './texts.ts'

// The button colors of D-10.
export const LookSchema = z.enum(['default', 'primary', 'success', 'danger'])
export type Look = z.infer<typeof LookSchema>

export const ButtonBaseSchema = z.object({
  id: ButtonIdSchema,
  idName: IdNameSchema,
  // True once the ID name was edited by hand or exported; until then it follows the label.
  idNameFixed: z.boolean().optional(),
  label: LangTextSchema,
  look: LookSchema,
  icon: z.object({ customEmojiId: z.string(), fallback: z.string() }).optional(),
})
export type ButtonBase = z.infer<typeof ButtonBaseSchema>

export const InlineActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('goTo'),
    // `stay` keeps the message: a popup alone, or with `remember`, or both.
    target: z.union([z.literal('stay'), TargetSchema]).optional(),
    // edit (the default, D-12) edits the clicked message into the target step; new sends the
    // target as a new message; replace deletes the clicked message and sends the target.
    show: z.enum(['edit', 'new', 'replace']),
    popup: z.object({ kind: z.enum(['toast', 'alert']), text: LangTextSchema }).optional(),
    remember: z.array(RememberActionSchema).optional(),
  }),
  // The URL may contain {variables}.
  z.object({ type: z.literal('url'), url: z.string() }),
  z.object({ type: z.literal('copyText'), text: LangTextSchema }),
  z.object({ type: z.literal('loginUrl'), url: z.string(), requestWriteAccess: z.boolean() }),
  // Opens the payment sheet of an invoice (stage 2): only as the first button of an invoice step.
  z.object({ type: z.literal('pay') }),
])
export type InlineAction = z.infer<typeof InlineActionSchema>

export const InlineButtonSchema = ButtonBaseSchema.extend({
  place: z.literal('inline'),
  // Shown but does nothing (Bot API 10.3).
  disabled: z.boolean().optional(),
  action: InlineActionSchema,
})
export type InlineButton = z.infer<typeof InlineButtonSchema>

export const ReplyActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    goTo: TargetSchema.optional(),
    remember: z.array(RememberActionSchema).optional(),
  }),
  z.object({ type: z.literal('sharePhone'), goTo: StepIdSchema.optional(), saveTo: VarIdSchema.optional() }),
  z.object({ type: z.literal('shareLocation'), goTo: StepIdSchema.optional(), saveTo: VarIdSchema.optional() }),
  z.object({
    type: z.literal('pickUsers'),
    max: z.number(),
    bots: z.boolean().optional(),
    premium: z.boolean().optional(),
    askName: z.boolean(),
    askUsername: z.boolean(),
    askPhoto: z.boolean(),
    goTo: StepIdSchema.optional(),
    saveTo: VarIdSchema.optional(),
  }),
  z.object({
    type: z.literal('pickChat'),
    channel: z.boolean(),
    forum: z.boolean().optional(),
    hasUsername: z.boolean().optional(),
    userIsOwner: z.boolean().optional(),
    botIsMember: z.boolean().optional(),
    askTitle: z.boolean(),
    askUsername: z.boolean(),
    askPhoto: z.boolean(),
    goTo: StepIdSchema.optional(),
    saveTo: VarIdSchema.optional(),
  }),
  z.object({
    type: z.literal('createPoll'),
    pollType: z.enum(['any', 'regular', 'quiz']),
    goTo: StepIdSchema.optional(),
    saveTo: VarIdSchema.optional(),
  }),
])
export type ReplyAction = z.infer<typeof ReplyActionSchema>

export const ReplyButtonSchema = ButtonBaseSchema.extend({ place: z.literal('reply'), action: ReplyActionSchema })
export type ReplyButton = z.infer<typeof ReplyButtonSchema>

export const ButtonSchema = z.discriminatedUnion('place', [InlineButtonSchema, ReplyButtonSchema])
export type Button = z.infer<typeof ButtonSchema>

// A row of buttons, or a row part placed in the keyboard.
export const RowSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('buttons'), ids: z.array(ButtonIdSchema) }),
  z.object({ type: z.literal('part'), part: PartIdSchema }),
])
export type Row = z.infer<typeof RowSchema>

// `openReplyField` is force_reply in the markup (Bot API 10.3); null is no keyboard.
export const KeyboardSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('inline'), rows: z.array(RowSchema), openReplyField: z.boolean().optional() }),
    z.object({
      type: z.literal('reply'),
      rows: z.array(RowSchema),
      oneTime: z.boolean(),
      persistent: z.boolean(),
      resize: z.boolean(),
      placeholder: LangTextSchema.optional(),
      openReplyField: z.boolean().optional(),
    }),
    z.object({ type: z.literal('removeReply') }),
    z.object({ type: z.literal('forceReply'), placeholder: LangTextSchema.optional() }),
  ])
  .nullable()
export type Keyboard = z.infer<typeof KeyboardSchema>
