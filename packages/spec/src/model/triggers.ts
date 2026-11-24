// What starts a start point (docs/plan/03-design-model.md section 2.3): the stage 1 kinds, then
// the events of stage 2. Every design has exactly one /start command; pressing a bottom-keyboard
// text button is not a start point but the button's own target. No "User reacts" (D-36).
import { z } from 'zod'

import { ConditionSchema } from './conditions.ts'
import { StepIdSchema, VarIdSchema } from './ids.ts'
import { LangTextSchema } from './texts.ts'

// The states of a Stars subscription Telegram reports (BotSubscriptionUpdated, Bot API 10.2).
export const SubscriptionStateSchema = z.enum(['canceled', 'active', 'failed'])
export type SubscriptionState = z.infer<typeof SubscriptionStateSchema>

export const TriggerSchema = z.discriminatedUnion('type', [
  // The command without its slash (`start`); `inMenu` lists it in the bot's commands menu in
  // the order of Bot setup.
  z.object({ type: z.literal('command'), command: z.string(), inMenu: z.boolean(), menuDescription: LangTextSchema }),
  // /start with a payload; `prefix` with `saveRestTo` covers referral links (`ref_123` saves 123).
  z.object({
    type: z.literal('startLink'),
    payload: z.string(),
    match: z.enum(['exact', 'prefix']),
    saveRestTo: VarIdSchema.optional(),
  }),
  // Anything the bot does not expect.
  z.object({ type: z.literal('fallback'), accepts: z.enum(['any', 'text', 'media']) }),
  // Stage 2. A payment the invoice's "Paid" arrow does not take (successful_payment): a
  // subscription paid again, or the first payment of an invoice without that arrow; for one
  // invoice step, or any when left out.
  z.object({ type: z.literal('paymentDone'), invoice: StepIdSchema.optional() }),
  // A payment was refunded (refunded_payment), by the bot or by Telegram.
  z.object({ type: z.literal('refunded'), invoice: StepIdSchema.optional() }),
  // A Stars subscription of an invoice step (any when left out) was canceled, turned back on or
  // could not be paid (the update `subscription`); `state` left out: any of them.
  z.object({
    type: z.literal('subscriptionChanged'),
    invoice: StepIdSchema.optional(),
    state: SubscriptionStateSchema.optional(),
  }),
  // The user blocks the bot, or unblocks it again (my_chat_member: kicked, member). After a block
  // the bot cannot send the user anything.
  z.object({ type: z.literal('userBlocks') }),
  z.object({ type: z.literal('userRestarts') }),
  // The bot writes first: to everyone who started it, or to the users the condition takes (test
  // switches, variables, payments), when `when` says (in words: "Every Monday at 9:00").
  z.object({
    type: z.literal('broadcast'),
    audience: z.union([z.literal('everyone'), ConditionSchema]),
    when: z.string(),
  }),
])
export type Trigger = z.infer<typeof TriggerSchema>
export type TriggerType = Trigger['type']
