// What an action step does (docs/plan/03-design-model.md section 7.3, stage 2): a Telegram action
// without a message. A step an action names is one that sent a message (a message, a question's
// prompt or an invoice): the action acts on the message it sent last. A new action has no step
// or invoice yet; the checks report the missing ones.
import { z } from 'zod'

import { StepIdSchema } from './ids.ts'
import { ChatActionSchema } from './options.ts'
import { RichTextRefSchema } from './texts.ts'

export const ActionSchema = z.discriminatedUnion('type', [
  // Sets the bot's reaction (setMessageReaction): one of Telegram's reaction emoji, on the message
  // a step sent last or on the user's last message (`userMessage`); `big` plays it large.
  z.object({
    type: z.literal('react'),
    emoji: z.string(),
    onStep: z.union([z.literal('userMessage'), StepIdSchema]).optional(),
    big: z.boolean().optional(),
  }),
  // Pins the message a step sent last (pinChatMessage); Telegram never notifies about a pin in a
  // private chat, so there is no "silent".
  z.object({ type: z.literal('pin'), step: StepIdSchema.optional() }),
  // Unpins the message a step sent last, or (left out) the newest pinned message (unpinChatMessage).
  z.object({ type: z.literal('unpin'), step: StepIdSchema.optional() }),
  // Deletes the message a step sent last (deleteMessage, within 48 hours of sending it).
  z.object({ type: z.literal('delete'), step: StepIdSchema.optional() }),
  // Sends the user a gift from the bot's Stars (sendGift): which gift in words (the developer
  // finds its ID with getAvailableGifts), a text that comes with it, and whether the bot also
  // pays for its upgrade.
  z.object({
    type: z.literal('gift'),
    giftDescription: z.string(),
    text: RichTextRefSchema.optional(),
    payForUpgrade: z.boolean().optional(),
  }),
  // Shows "typing..." or another chat action (sendChatAction), for 5 seconds at most or until the
  // bot's next message.
  z.object({ type: z.literal('chatAction'), action: ChatActionSchema }),
  // Gives back the user's Stars payment of an invoice step (refundStarPayment).
  z.object({ type: z.literal('refund'), invoice: StepIdSchema.optional() }),
])
export type Action = z.infer<typeof ActionSchema>
export type ActionType = Action['type']
