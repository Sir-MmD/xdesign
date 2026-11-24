// What a message sends (docs/plan/03-design-model.md sections 2.4 and 7.2): the stage 1 kinds,
// then polls, quizzes, dice, paid media and rich messages (stage 2; no checklists, D-36).
// Telegram's limits (albums of 2 to 10 items, caption lengths, poll options, Stars, a rich
// message's blocks) are left to the checks.
import { z } from 'zod'

import { ButtonIdSchema, MediaIdSchema, VarIdSchema } from './ids.ts'
import { LangTextSchema, RichTextRefSchema } from './texts.ts'

// An uploaded file, or a placeholder the developer fills ("product photo").
export const MediaSlotSchema = z.union([
  z.object({ media: MediaIdSchema }),
  z.object({ placeholder: z.object({ description: z.string() }) }),
])
export type MediaSlot = z.infer<typeof MediaSlotSchema>

// The fields polls and quizzes share (sendPoll). The question is a rich text (Telegram keeps only
// its custom emoji), each option a plain text per language. A poll closes after `closeAfterSec`
// (open_period) or at `closeAt` (close_date, Unix time), never both; neither: it stays open.
// Left out, `revote` and the others take Telegram's defaults (revoting: yes for polls, no for
// quizzes). `saveTo`: the variable the user's vote goes in (a poll's option text in the default
// language, a quiz's right or wrong as yes or no), from poll_answer, so not for anonymous polls.
const pollFields = {
  question: RichTextRefSchema,
  options: z.array(LangTextSchema),
  anonymous: z.boolean(),
  multiple: z.boolean(),
  revote: z.boolean().optional(),
  shuffle: z.boolean().optional(),
  hideResults: z.boolean().optional(),
  closeAfterSec: z.number().optional(),
  closeAt: z.number().optional(),
  saveTo: VarIdSchema.optional(),
}

// A block of a rich message (sendRichMessage's InputRichBlock, Bot API 10.1 to 10.3). Blocks are
// one level deep: a quote, a details block and each list item or table cell hold one rich text
// (sent as a paragraph inside). `heading` is a section heading of `size` 1 (largest) to 6; `code`
// is preformatted text; `media` a photo, video, GIF, audio, voice note or file (the file's kind
// decides) with an optional caption; `buttons` a row of 1 to 8 inline buttons of the design's
// `buttons`, inside the message.
export const RichMessageBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['paragraph', 'footer']), text: RichTextRefSchema }),
  z.object({ type: z.literal('heading'), text: RichTextRefSchema, size: z.number() }),
  z.object({ type: z.literal('code'), text: RichTextRefSchema, language: z.string().optional() }),
  z.object({
    type: z.literal('quote'),
    text: RichTextRefSchema,
    credit: RichTextRefSchema.optional(),
    expandable: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean(),
    // `checked` gives the item a checkbox, ticked or not.
    items: z.array(z.object({ text: RichTextRefSchema, checked: z.boolean().optional() })),
  }),
  z.object({
    type: z.literal('table'),
    rows: z.array(z.object({ cells: z.array(z.object({ text: RichTextRefSchema, header: z.boolean().optional() })) })),
    caption: RichTextRefSchema.optional(),
    bordered: z.boolean().optional(),
    striped: z.boolean().optional(),
    compact: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('details'),
    summary: RichTextRefSchema,
    text: RichTextRefSchema,
    open: z.boolean().optional(),
  }),
  z.object({ type: z.literal('divider') }),
  z.object({
    type: z.literal('media'),
    media: MediaSlotSchema,
    caption: RichTextRefSchema.optional(),
    spoiler: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('buttons'),
    ids: z.array(ButtonIdSchema),
    align: z.enum(['left', 'center', 'right']).optional(),
  }),
])
export type RichMessageBlock = z.infer<typeof RichMessageBlockSchema>
export type RichMessageBlockType = RichMessageBlock['type']

export const DiceEmojiSchema = z.enum(['🎲', '🎯', '🏀', '⚽', '🎳', '🎰'])
export type DiceEmoji = z.infer<typeof DiceEmojiSchema>

export const ContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: RichTextRefSchema }),
  z.object({
    type: z.enum(['photo', 'livePhoto', 'video', 'animation']),
    media: MediaSlotSchema,
    caption: RichTextRefSchema.optional(),
    spoiler: z.boolean().optional(),
    captionAbove: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('audio'),
    media: MediaSlotSchema,
    caption: RichTextRefSchema.optional(),
    title: z.string().optional(),
    performer: z.string().optional(),
  }),
  z.object({ type: z.enum(['voice', 'document']), media: MediaSlotSchema, caption: RichTextRefSchema.optional() }),
  // No caption in Telegram.
  z.object({ type: z.enum(['videoNote', 'sticker']), media: MediaSlotSchema }),
  // Photos and videos mixed, or only documents, or only audio.
  z.object({
    type: z.literal('album'),
    items: z.array(
      z.object({ media: MediaSlotSchema, caption: RichTextRefSchema.optional(), spoiler: z.boolean().optional() }),
    ),
  }),
  z.object({
    type: z.literal('location'),
    latitude: z.number(),
    longitude: z.number(),
    livePeriodSec: z.number().optional(),
  }),
  z.object({
    type: z.literal('venue'),
    latitude: z.number(),
    longitude: z.number(),
    title: z.string(),
    address: z.string(),
  }),
  z.object({ type: z.literal('contact'), phone: z.string(), firstName: z.string(), lastName: z.string().optional() }),
  // Stage 2. `addOptions`: the user may add options (not on anonymous polls).
  z.object({ type: z.literal('poll'), ...pollFields, addOptions: z.boolean().optional() }),
  // `correct`: the indexes of the right options, in order (several since Bot API 9.6).
  z.object({
    type: z.literal('quiz'),
    ...pollFields,
    correct: z.array(z.number()),
    explanation: RichTextRefSchema.optional(),
  }),
  // `saveTo`: the variable the value rolled goes in (sendDice's result).
  z.object({ type: z.literal('dice'), emoji: DiceEmojiSchema, saveTo: VarIdSchema.optional() }),
  // 1 to 10 photos, live photos or videos the user unlocks for `stars` Telegram Stars; items
  // are objects like an album's, so a slot is always under `media`.
  z.object({
    type: z.literal('paidMedia'),
    items: z.array(z.object({ media: MediaSlotSchema })),
    stars: z.number(),
    caption: RichTextRefSchema.optional(),
    captionAbove: z.boolean().optional(),
  }),
  // A rich message (sendRichMessage, Bot API 10.1): its blocks in order; `rtl` is is_rtl.
  z.object({ type: z.literal('rich'), blocks: z.array(RichMessageBlockSchema), rtl: z.boolean().optional() }),
])
export type Content = z.infer<typeof ContentSchema>
export type ContentType = Content['type']
