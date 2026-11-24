// Bot setup (docs/plan/03-design-model.md section 2.9). Telegram's lengths (name up to 64
// characters, about up to 120, description up to 512) are left to the checks.
import { z } from 'zod'

import { MediaSlotSchema } from './content.ts'
import { StepIdSchema } from './ids.ts'
import { LangTextSchema } from './texts.ts'

export const BotSetupSchema = z.object({
  // The bot's username without the @, for the start links of the docs; t.me/yourbot without it.
  username: z.string().optional(),
  name: LangTextSchema,
  // The short description.
  about: LangTextSchema,
  // "What can this bot do?"
  description: LangTextSchema,
  photo: MediaSlotSchema.optional(),
  menuButton: z.enum(['commands', 'default']),
  // The start points of type command, in menu order.
  commandOrder: z.array(StepIdSchema),
})
export type BotSetup = z.infer<typeof BotSetupSchema>
