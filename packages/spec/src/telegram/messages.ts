// The content kinds of a message (docs/plan/08 sections 1 and 7, 03 section 2.4): the Bot API
// method that sends each one, what it takes, its stage and the editor's name for it.
import type { LimitId } from './limits.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type MessageKindRow = Sourced & {
  readonly id: string
  /** The editor's name for the kind (04 section 5.1). */
  readonly label: string
  readonly method: string
  /** The method takes a caption (an album: one per item). */
  readonly caption: boolean
  /** The reply_markup the method takes: any keyboard, an inline keyboard only, or none. */
  readonly buttons: 'any' | 'inline' | 'none'
  /** has_spoiler (an album: per item). */
  readonly spoiler: boolean
  /** show_caption_above_media (an album: per item). */
  readonly captionAbove: boolean
  /** message_effect_id. */
  readonly effect: boolean
  readonly stage: 1 | 2
  /** The Bot API version that added the kind, when it is newer than 9.4. */
  readonly since?: string
}

export const MESSAGE_KINDS = [
  {
    id: 'text',
    label: 'Text',
    method: 'sendMessage',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendmessage'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'photo',
    label: 'Photo',
    method: 'sendPhoto',
    caption: true,
    buttons: 'any',
    spoiler: true,
    captionAbove: true,
    effect: true,
    stage: 1,
    source: apiDoc('sendphoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'livePhoto',
    label: 'Live photo',
    method: 'sendLivePhoto',
    caption: true,
    buttons: 'any',
    spoiler: true,
    captionAbove: true,
    effect: true,
    stage: 1,
    since: '10.0',
    source: apiDoc('sendlivephoto'),
    botApi: BOT_API,
    verified: true,
    note: 'A video of at most 10 seconds plus a static photo; cannot be sent by URL.',
  },
  {
    id: 'video',
    label: 'Video',
    method: 'sendVideo',
    caption: true,
    buttons: 'any',
    spoiler: true,
    captionAbove: true,
    effect: true,
    stage: 1,
    source: apiDoc('sendvideo'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'animation',
    label: 'GIF',
    method: 'sendAnimation',
    caption: true,
    buttons: 'any',
    spoiler: true,
    captionAbove: true,
    effect: true,
    stage: 1,
    source: apiDoc('sendanimation'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'audio',
    label: 'Audio',
    method: 'sendAudio',
    caption: true,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendaudio'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'voice',
    label: 'Voice',
    method: 'sendVoice',
    caption: true,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'document',
    label: 'File',
    method: 'sendDocument',
    caption: true,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('senddocument'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'videoNote',
    label: 'Round video',
    method: 'sendVideoNote',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendvideonote'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'sticker',
    label: 'Sticker',
    method: 'sendSticker',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendsticker'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'album',
    label: 'Album',
    method: 'sendMediaGroup',
    caption: true,
    buttons: 'none',
    spoiler: true,
    captionAbove: true,
    effect: true,
    stage: 1,
    source: apiDoc('sendmediagroup'),
    botApi: BOT_API,
    verified: true,
    note: 'Caption, spoiler and caption above media are set per item; the album groups are in media.ts.',
  },
  {
    id: 'location',
    label: 'Location',
    method: 'sendLocation',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendlocation'),
    botApi: BOT_API,
    verified: true,
    note: 'A live location takes live_period; it moves with editMessageLiveLocation.',
  },
  {
    id: 'venue',
    label: 'Venue',
    method: 'sendVenue',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendvenue'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'contact',
    label: 'Contact',
    method: 'sendContact',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 1,
    source: apiDoc('sendcontact'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'poll',
    label: 'Poll',
    method: 'sendPoll',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 2,
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'quiz',
    label: 'Quiz',
    method: 'sendPoll',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 2,
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'sendPoll with type quiz; correct_option_ids (several correct options since 9.6).',
  },
  {
    id: 'dice',
    label: 'Dice',
    method: 'sendDice',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 2,
    source: apiDoc('senddice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'paidMedia',
    label: 'Paid media',
    method: 'sendPaidMedia',
    caption: true,
    buttons: 'any',
    spoiler: false,
    captionAbove: true,
    effect: false,
    stage: 2,
    source: apiDoc('sendpaidmedia'),
    botApi: BOT_API,
    verified: true,
    note: 'Private chats are allowed: Stars go to the bot outside channels.',
  },
  {
    id: 'rich',
    label: 'Rich message',
    method: 'sendRichMessage',
    caption: false,
    buttons: 'any',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 2,
    since: '10.1',
    source: apiDoc('sendrichmessage'),
    botApi: BOT_API,
    verified: true,
    note: 'InputRichMessage takes exactly one of html, markdown or blocks; buttons inside since 10.3 (rich.ts).',
  },
  {
    id: 'invoice',
    label: 'Invoice',
    method: 'sendInvoice',
    caption: false,
    buttons: 'inline',
    spoiler: false,
    captionAbove: false,
    effect: true,
    stage: 2,
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'Digital goods and services are sold only in Stars (XTR); a Stars subscription needs createInvoiceLink.',
  },
] as const satisfies readonly MessageKindRow[]

export type ContentKind = (typeof MESSAGE_KINDS)[number]['id']

const kindsById = new Map<string, MessageKindRow>(MESSAGE_KINDS.map((row) => [row.id, row]))

/** The catalog row of a content kind. */
export function messageKind(id: ContentKind): MessageKindRow {
  const row = kindsById.get(id)
  if (!row) throw new Error(`no content kind ${id}`)
  return row
}

export type DiceRow = Sourced & {
  readonly id: string
  readonly emoji: string
  /** The limit row of its values. */
  readonly limit: LimitId
}

/** The dice emoji of sendDice. */
export const DICE = [
  { id: 'dice', emoji: '🎲', limit: 'diceDice', source: apiDoc('dice'), botApi: BOT_API, verified: true },
  { id: 'darts', emoji: '🎯', limit: 'diceDarts', source: apiDoc('dice'), botApi: BOT_API, verified: true },
  { id: 'bowling', emoji: '🎳', limit: 'diceBowling', source: apiDoc('dice'), botApi: BOT_API, verified: true },
  { id: 'basketball', emoji: '🏀', limit: 'diceBasketball', source: apiDoc('dice'), botApi: BOT_API, verified: true },
  { id: 'football', emoji: '⚽', limit: 'diceFootball', source: apiDoc('dice'), botApi: BOT_API, verified: true },
  { id: 'slotMachine', emoji: '🎰', limit: 'diceSlotMachine', source: apiDoc('dice'), botApi: BOT_API, verified: true },
] as const satisfies readonly DiceRow[]
