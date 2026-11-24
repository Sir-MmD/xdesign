// Message options (docs/plan/03-design-model.md section 2.7).
import { z } from 'zod'

// The actions of sendChatAction, with Telegram's names.
export const ChatActionSchema = z.enum([
  'typing',
  'upload_photo',
  'record_video',
  'upload_video',
  'record_voice',
  'upload_voice',
  'upload_document',
  'choose_sticker',
  'find_location',
  'record_video_note',
  'upload_video_note',
])
export type ChatAction = z.infer<typeof ChatActionSchema>

export const LinkPreviewSchema = z.object({
  off: z.boolean(),
  url: z.string().optional(),
  size: z.enum(['auto', 'small', 'large']),
  above: z.boolean(),
})
export type LinkPreview = z.infer<typeof LinkPreviewSchema>

export const OptionsSchema = z.object({
  // Telegram's disable_notification.
  silent: z.boolean().optional(),
  // protect_content: no forwarding or saving.
  protect: z.boolean().optional(),
  linkPreview: LinkPreviewSchema.optional(),
  // A message effect ID from the catalog (08).
  effect: z.string().optional(),
  // "typing..." before sending.
  chatAction: z.object({ action: ChatActionSchema, seconds: z.number() }).optional(),
  // Wait before sending (no other step needed).
  delaySec: z.number().optional(),
  // "Write it out like a draft": the text streams in with sendMessageDraft (a rich message with
  // sendRichMessageDraft) before the message is sent; text and rich messages only.
  draft: z.boolean().optional(),
  // "Let the user stop it" (can_stop, Bot API 10.3): the draft shows a stop button; a message
  // step's `onStop` is where the bot goes on when the user presses it. Message steps only.
  draftStop: z.boolean().optional(),
  // "Keep what was written" (keep_on_stop): a stopped draft stays in the chat for a while.
  draftKeep: z.boolean().optional(),
})
export type Options = z.infer<typeof OptionsSchema>
