// Keyboards (docs/plan/08 sections 1, 3 and 7, 03 section 2.5): the four reply_markup types, the
// options of a keyboard with the editor's names, and the size limits, which Telegram does not
// document (observed values, verified: false).
import type { LimitRow } from './limits.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type KeyboardTypeRow = Sourced & {
  /** The type of the design model's Keyboard (03 section 2.5). */
  readonly id: string
  /** The Bot API object of reply_markup. */
  readonly object: string
  /** The editor's name, for the two that are menu items. */
  readonly label?: string
}

export const KEYBOARD_TYPES = [
  {
    id: 'inline',
    object: 'InlineKeyboardMarkup',
    source: apiDoc('inlinekeyboardmarkup'),
    botApi: BOT_API,
    verified: true,
    note: 'The only markup an edit can set: every editMessage* method takes InlineKeyboardMarkup alone.',
  },
  {
    id: 'reply',
    object: 'ReplyKeyboardMarkup',
    source: apiDoc('replykeyboardmarkup'),
    botApi: BOT_API,
    verified: true,
    note: 'Shown until another keyboard replaces it or ReplyKeyboardRemove removes it.',
  },
  {
    id: 'removeReply',
    object: 'ReplyKeyboardRemove',
    label: 'Remove the bottom keyboard',
    source: apiDoc('replykeyboardremove'),
    botApi: BOT_API,
    verified: true,
    note: 'remove_keyboard: true; the user cannot open it again (one_time_keyboard only hides it).',
  },
  {
    id: 'forceReply',
    object: 'ForceReply',
    label: 'Force a reply',
    source: apiDoc('forcereply'),
    botApi: BOT_API,
    verified: true,
    note: 'force_reply: true, with an optional input_field_placeholder.',
  },
] as const satisfies readonly KeyboardTypeRow[]

export type KeyboardType = (typeof KEYBOARD_TYPES)[number]['id']

export type KeyboardOptionRow = Sourced & {
  /** The Bot API field. */
  readonly id: string
  /** The keyboard types that take it. */
  readonly on: readonly KeyboardType[]
  /** The editor's name (04 section 5.3). */
  readonly label: string
  readonly type: 'Boolean' | 'String'
  /** The value when the field is left out. */
  readonly default?: boolean
  readonly since?: string
}

export const KEYBOARD_OPTIONS = [
  {
    id: 'one_time_keyboard',
    on: ['reply'],
    label: 'Hide after one press',
    type: 'Boolean',
    default: false,
    source: apiDoc('replykeyboardmarkup'),
    botApi: BOT_API,
    verified: true,
    note: 'The keyboard stays available behind a button in the input field.',
  },
  {
    id: 'is_persistent',
    on: ['reply'],
    label: 'Always shown',
    type: 'Boolean',
    default: false,
    source: apiDoc('replykeyboardmarkup'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'resize_keyboard',
    on: ['reply'],
    label: 'Fit to buttons',
    type: 'Boolean',
    default: false,
    source: apiDoc('replykeyboardmarkup'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'input_field_placeholder',
    on: ['reply', 'forceReply'],
    label: 'Hint in the input field',
    type: 'String',
    source: apiDoc('replykeyboardmarkup'),
    botApi: BOT_API,
    verified: true,
    note: 'Limit placeholder.',
  },
  {
    id: 'force_reply',
    on: ['inline', 'reply'],
    label: 'Open the reply field',
    type: 'Boolean',
    default: false,
    since: '10.3',
    source: apiDoc('inlinekeyboardmarkup'),
    botApi: BOT_API,
    verified: true,
    note: 'Shows the reply interface with the keyboard; on an inline keyboard an edit cannot change it.',
  },
] as const satisfies readonly KeyboardOptionRow[]

/** Keyboard sizes: not in any official page, so every row is unverified. */
export const KEYBOARD_SIZE_LIMITS = [
  {
    id: 'inlineButtonsPerRow',
    about: 'Buttons in one row of an inline keyboard',
    max: 8,
    unit: 'buttons',
    source: apiDoc('inlinekeyboardmarkup'),
    botApi: BOT_API,
    verified: false,
    note: 'Observed, not documented; TG-00 found no source.',
  },
  {
    id: 'inlineButtons',
    about: 'Buttons in an inline keyboard',
    max: 100,
    unit: 'buttons',
    source: apiDoc('inlinekeyboardmarkup'),
    botApi: BOT_API,
    verified: false,
    note: 'Observed, not documented; TG-00 found no source.',
  },
  {
    id: 'replyButtonsPerRow',
    about: 'Buttons in one row of a bottom keyboard',
    max: 8,
    unit: 'buttons',
    source: apiDoc('replykeyboardmarkup'),
    botApi: BOT_API,
    verified: false,
    note: 'Unknown: assumed equal to the inline limit, as commonly done.',
  },
  {
    id: 'replyButtons',
    about: 'Buttons in a bottom keyboard',
    max: 100,
    unit: 'buttons',
    source: apiDoc('replykeyboardmarkup'),
    botApi: BOT_API,
    verified: false,
    note: 'Unknown: assumed equal to the inline limit, as commonly done.',
  },
] as const satisfies readonly LimitRow[]
