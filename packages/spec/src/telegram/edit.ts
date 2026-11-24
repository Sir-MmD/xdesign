// "Edit this message" (docs/plan/08 section 7 item 5, which replaces the table of section 4;
// check E05 follows this file): the edit methods, the rules from one content kind to another
// (first match wins, the last rule catches the rest), the matrix they give, and album items.
import { albumGroup } from './media.ts'
import { MESSAGE_KINDS, type ContentKind } from './messages.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type EditMethodRow = Sourced & {
  readonly id: string
  /** What the method changes, in plain words. */
  readonly changes: string
}

export const EDIT_METHODS = [
  {
    id: 'editMessageText',
    changes: 'The text, entities, link preview and inline keyboard of a text or rich message.',
    source: apiDoc('editmessagetext'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'editMessageCaption',
    changes: 'The caption and inline keyboard; show_caption_above_media only for animation, photo and video.',
    source: apiDoc('editmessagecaption'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'editMessageMedia',
    changes:
      'The file, caption and inline keyboard of an animation, audio, document, live photo, photo or video ' +
      'message; it also replaces a text or rich message with one of those.',
    source: apiDoc('editmessagemedia'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'editMessageReplyMarkup',
    changes: 'Only the inline keyboard.',
    source: apiDoc('editmessagereplymarkup'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'editMessageLiveLocation',
    changes: 'The position of a live location until its live period ends.',
    source: apiDoc('editmessagelivelocation'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'stopMessageLiveLocation',
    changes: 'Stops a live location before its live period ends.',
    source: apiDoc('stopmessagelivelocation'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'stopPoll',
    changes: 'Closes a poll the bot sent.',
    source: apiDoc('stoppoll'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly EditMethodRow[]

export type EditMethod = (typeof EDIT_METHODS)[number]['id']

/** What an edit can change: everything, the caption and buttons, the buttons, album items one by one, nothing. */
export type EditChange = 'all' | 'caption' | 'buttons' | 'items' | 'none'

export type EditRuleRow = Sourced & {
  readonly id: string
  readonly from: 'any' | readonly ContentKind[]
  /** The kinds it can become; 'same': each kind of from into itself. */
  readonly to: 'any' | 'same' | readonly ContentKind[]
  readonly allowed: boolean
  readonly change: EditChange
  readonly method?: EditMethod
}

const FILE_KINDS = ['photo', 'livePhoto', 'video', 'animation', 'audio', 'document'] as const

export const EDIT_RULES = [
  {
    id: 'textToText',
    from: ['text'],
    to: ['text'],
    allowed: true,
    change: 'all',
    method: 'editMessageText',
    source: apiDoc('editmessagetext'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'richToRich',
    from: ['rich'],
    to: ['rich'],
    allowed: true,
    change: 'all',
    method: 'editMessageText',
    source: apiDoc('editmessagetext'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'textRichSwitch',
    from: ['text', 'rich'],
    to: ['text', 'rich'],
    allowed: true,
    change: 'all',
    method: 'editMessageText',
    source: apiDoc('editmessagetext'),
    botApi: BOT_API,
    verified: false,
    note: 'editMessageText takes text or rich_message; turning one kind into the other is not stated.',
  },
  {
    id: 'textToMedia',
    from: ['text', 'rich'],
    to: FILE_KINDS,
    allowed: true,
    change: 'all',
    method: 'editMessageMedia',
    source: apiDoc('editmessagemedia'),
    botApi: BOT_API,
    verified: true,
    note: 'The plan of 9.4 said "not possible"; editMessageMedia replaces a text or a rich message with a media.',
  },
  {
    id: 'mediaSameKind',
    from: FILE_KINDS,
    to: 'same',
    allowed: true,
    change: 'all',
    method: 'editMessageMedia',
    source: apiDoc('editmessagemedia'),
    botApi: BOT_API,
    verified: true,
    note: 'Only the caption: editMessageCaption; only the buttons: editMessageReplyMarkup.',
  },
  {
    id: 'mediaToOtherMedia',
    from: FILE_KINDS,
    to: FILE_KINDS,
    allowed: true,
    change: 'all',
    method: 'editMessageMedia',
    source: apiDoc('editmessagemedia'),
    botApi: BOT_API,
    verified: false,
    note: 'Telegram does not say whether every pairing works outside albums (for example audio into photo).',
  },
  {
    id: 'mediaToText',
    from: FILE_KINDS,
    to: ['text', 'rich'],
    allowed: false,
    change: 'none',
    source: apiDoc('editmessagetext'),
    botApi: BOT_API,
    verified: false,
    note: 'editMessageText edits text, rich and game messages only; not stated for media, an error in practice.',
  },
  {
    id: 'albumItems',
    from: ['album'],
    to: ['album'],
    allowed: true,
    change: 'items',
    method: 'editMessageMedia',
    source: apiDoc('editmessagemedia'),
    botApi: BOT_API,
    verified: true,
    note: 'Never the album as a whole: one item at a time, into a kind of its album group (canEditAlbumItem).',
  },
  {
    id: 'voiceCaption',
    from: ['voice'],
    to: ['voice'],
    allowed: true,
    change: 'caption',
    method: 'editMessageCaption',
    source: apiDoc('editmessagecaption'),
    botApi: BOT_API,
    verified: true,
    note: 'The file cannot change: editMessageMedia does not take voice messages.',
  },
  {
    id: 'paidMediaCaption',
    from: ['paidMedia'],
    to: ['paidMedia'],
    allowed: true,
    change: 'caption',
    method: 'editMessageCaption',
    source: apiDoc('editmessagecaption'),
    botApi: BOT_API,
    verified: false,
    note: 'Not stated for paid media; editMessageMedia does not take it.',
  },
  {
    id: 'locationButtons',
    from: ['location'],
    to: ['location'],
    allowed: true,
    change: 'buttons',
    method: 'editMessageReplyMarkup',
    source: apiDoc('editmessagereplymarkup'),
    botApi: BOT_API,
    verified: true,
    note: 'A live location also moves with editMessageLiveLocation and stops with stopMessageLiveLocation.',
  },
  {
    id: 'pollButtons',
    from: ['poll', 'quiz'],
    to: 'same',
    allowed: true,
    change: 'buttons',
    method: 'editMessageReplyMarkup',
    source: apiDoc('editmessagereplymarkup'),
    botApi: BOT_API,
    verified: true,
    note: 'stopPoll closes it.',
  },
  {
    id: 'buttonsOnly',
    from: ['videoNote', 'sticker', 'venue', 'contact', 'dice', 'invoice'],
    to: 'same',
    allowed: true,
    change: 'buttons',
    method: 'editMessageReplyMarkup',
    source: apiDoc('editmessagereplymarkup'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'notPossible',
    from: 'any',
    to: 'any',
    allowed: false,
    change: 'none',
    source: apiDoc('updating-messages'),
    botApi: BOT_API,
    verified: true,
    note: 'No edit method turns it into that kind: send a new message instead.',
  },
] as const satisfies readonly EditRuleRow[]

const inList = (list: 'any' | readonly ContentKind[], kind: ContentKind) => list === 'any' || list.includes(kind)

/** The rule for editing a message of one kind into another. */
export function editRule(from: ContentKind, to: ContentKind): EditRuleRow {
  const rule = (EDIT_RULES as readonly EditRuleRow[]).find(
    (row) => inList(row.from, from) && (row.to === 'same' ? from === to : inList(row.to, to)),
  )
  if (!rule) throw new Error(`no edit rule from ${from} to ${to}`)
  return rule
}

const KINDS: readonly ContentKind[] = MESSAGE_KINDS.map((kind) => kind.id)

/** Every pair of kinds: EDIT_MATRIX[from][to]. */
export const EDIT_MATRIX = Object.fromEntries(
  KINDS.map((from) => [from, Object.fromEntries(KINDS.map((to) => [to, editRule(from, to)]))]),
) as Readonly<Record<ContentKind, Readonly<Record<ContentKind, EditRuleRow>>>>

/** An album item can be edited into a kind of its own album group only. */
export function canEditAlbumItem(from: ContentKind, to: ContentKind): boolean {
  const group = albumGroup(from)
  return group !== undefined && group === albumGroup(to)
}

export type EditFactRow = Sourced & { readonly id: string; readonly rule: string }

export const EDIT_FACTS = [
  {
    id: 'editableMarkup',
    rule: 'Only a message sent without reply_markup or with an inline keyboard can be edited.',
    source: apiDoc('updating-messages'),
    botApi: BOT_API,
    verified: true,
    note: 'A message sent with a bottom keyboard, a keyboard removal or a forced reply cannot be edited.',
  },
  {
    id: 'inlineKeyboardOnly',
    rule: 'An edit can set only an inline keyboard; a bottom keyboard needs a new message.',
    source: apiDoc('editmessagereplymarkup'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'noTimeLimit',
    rule: "The bot's own messages in a private chat can be edited at any time.",
    source: apiDoc('editmessagetext'),
    botApi: BOT_API,
    verified: false,
    note: 'No limit is stated; the 48-hour limit is only for business messages not sent by the bot.',
  },
] as const satisfies readonly EditFactRow[]
