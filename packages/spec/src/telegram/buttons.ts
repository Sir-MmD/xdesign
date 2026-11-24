// Buttons (docs/plan/08 sections 1, 3 and 7, 03 section 2.5, 04 section 5.3): the inline and the
// reply button kinds with their Bot API fields and limits, the four looks, and the rules every
// button follows. Excluded on purpose (D-11): web_app, switch_inline_query*, callback_game,
// request_managed_bot.
import type { LimitId } from './limits.ts'
import { apiDoc, BOT_API, changelogDoc, type Sourced } from './version.ts'

export type ButtonKindRow = Sourced & {
  readonly id: string
  readonly place: 'inline' | 'reply'
  /** The Bot API field that gives the button its type ('text' for a plain reply button). */
  readonly field: string
  /** The field's Bot API type. */
  readonly type: string
  /** The fields of that type xDesign sets. */
  readonly fields: readonly string[]
  readonly limits: readonly LimitId[]
  /** The URL schemes a link may use. */
  readonly schemes?: readonly string[]
  /** The editor's name: a "When pressed" choice, or the disabled switch (04 section 5.3). */
  readonly label: string
  readonly stage: 1 | 2
  readonly since?: string
}

export const BUTTON_KINDS = [
  // Inline buttons: exactly one type field each.
  {
    id: 'callback',
    place: 'inline',
    field: 'callback_data',
    type: 'String',
    fields: [],
    limits: ['callbackData'],
    label: 'Go to a step',
    stage: 1,
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'The bot must answer every press with answerCallbackQuery (limit popupText).',
  },
  {
    id: 'url',
    place: 'inline',
    field: 'url',
    type: 'String',
    fields: [],
    limits: [],
    schemes: ['http', 'https', 'tg'],
    label: 'Open a link',
    stage: 1,
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'tg://user?id=<user_id> mentions a user if their privacy settings allow it.',
  },
  {
    id: 'copy_text',
    place: 'inline',
    field: 'copy_text',
    type: 'CopyTextButton',
    fields: ['text'],
    limits: ['copyText'],
    label: 'Copy text',
    stage: 1,
    source: apiDoc('copytextbutton'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'login_url',
    place: 'inline',
    field: 'login_url',
    type: 'LoginUrl',
    fields: ['url', 'forward_text', 'bot_username', 'request_write_access'],
    limits: [],
    schemes: ['https'],
    label: 'Log in on a website',
    stage: 1,
    source: apiDoc('loginurl'),
    botApi: BOT_API,
    verified: true,
    note: "The URL's domain must be the one linked with the bot (BotFather /setdomain); the site must check the hash.",
  },
  {
    id: 'pay',
    place: 'inline',
    field: 'pay',
    type: 'Boolean',
    fields: [],
    limits: [],
    label: 'Pay',
    stage: 2,
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'Invoices only, always the first button of the first row; ⭐ and XTR in its text show a Star icon.',
  },
  {
    id: 'disabled',
    place: 'inline',
    field: 'disabled',
    type: 'DisabledButton',
    fields: [],
    limits: [],
    label: 'Disabled (does nothing)',
    stage: 1,
    since: '10.3',
    source: apiDoc('disabledbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'Its own type field: a disabled button sends nothing, so it has no other action.',
  },

  // Reply buttons: at most one type field each; the request buttons work in private chats only.
  {
    id: 'text',
    place: 'reply',
    field: 'text',
    type: 'String',
    fields: [],
    limits: [],
    label: 'Sends its text',
    stage: 1,
    source: apiDoc('keyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'With no type field, pressing it sends its text as a message.',
  },
  {
    id: 'request_contact',
    place: 'reply',
    field: 'request_contact',
    type: 'Boolean',
    fields: [],
    limits: [],
    label: 'Share phone number',
    stage: 1,
    source: apiDoc('keyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'The phone number arrives as a contact message.',
  },
  {
    id: 'request_location',
    place: 'reply',
    field: 'request_location',
    type: 'Boolean',
    fields: [],
    limits: [],
    label: 'Share location',
    stage: 1,
    source: apiDoc('keyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'The location arrives as a location message.',
  },
  {
    id: 'request_users',
    place: 'reply',
    field: 'request_users',
    type: 'KeyboardButtonRequestUsers',
    fields: [
      'request_id',
      'user_is_bot',
      'user_is_premium',
      'max_quantity',
      'request_name',
      'request_username',
      'request_photo',
    ],
    limits: ['pickUsers'],
    label: 'Pick users',
    stage: 1,
    source: apiDoc('keyboardbuttonrequestusers'),
    botApi: BOT_API,
    verified: true,
    note: 'request_id is a signed 32-bit number unique within the message; the answer is a users_shared message.',
  },
  {
    id: 'request_chat',
    place: 'reply',
    field: 'request_chat',
    type: 'KeyboardButtonRequestChat',
    fields: [
      'request_id',
      'chat_is_channel',
      'chat_is_forum',
      'chat_has_username',
      'chat_is_created',
      'bot_is_member',
      'request_title',
      'request_username',
      'request_photo',
    ],
    limits: [],
    label: 'Pick a group or channel',
    stage: 1,
    source: apiDoc('keyboardbuttonrequestchat'),
    botApi: BOT_API,
    verified: true,
    note: 'chat_is_channel is required; the answer is a chat_shared message.',
  },
  {
    id: 'request_poll',
    place: 'reply',
    field: 'request_poll',
    type: 'KeyboardButtonPollType',
    fields: ['type'],
    limits: [],
    label: 'Create a poll',
    stage: 1,
    source: apiDoc('keyboardbuttonpolltype'),
    botApi: BOT_API,
    verified: true,
    note: 'type quiz or regular, or left out for any poll.',
  },
] as const satisfies readonly ButtonKindRow[]

export type ButtonKind = (typeof BUTTON_KINDS)[number]['id']

export type LookRow = Sourced & {
  /** The design model's Look (03 section 2.5). */
  readonly id: string
  /** The value of the button's style field; null: the field is left out. */
  readonly style: 'primary' | 'success' | 'danger' | null
  /** Telegram's color name; null: the app's own style. */
  readonly color: 'blue' | 'green' | 'red' | null
  /** The editor's swatch name (04 section 5.3). */
  readonly label: string
}

export const LOOKS = [
  {
    id: 'default',
    style: null,
    color: null,
    label: 'Default',
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'primary',
    style: 'primary',
    color: 'blue',
    label: 'Blue',
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'success',
    style: 'success',
    color: 'green',
    label: 'Green',
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'danger',
    style: 'danger',
    color: 'red',
    label: 'Red',
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly LookRow[]

export type Look = (typeof LOOKS)[number]['id']

export type ButtonRuleRow = Sourced & { readonly id: string; readonly rule: string; readonly since?: string }

export const BUTTON_RULES = [
  {
    id: 'inlineOneType',
    rule: 'An inline button has exactly one field besides text, icon_custom_emoji_id and style.',
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'replyOneType',
    rule: 'A reply button has at most one field besides text, icon_custom_emoji_id and style.',
    source: apiDoc('keyboardbutton'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'styleBothPlaces',
    rule: 'style and icon_custom_emoji_id exist on inline and reply buttons alike.',
    since: '9.4',
    source: apiDoc('keyboardbutton'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'styleShownByNewApps',
    rule: 'Telegram apps released before Bot API 9.4 (2026-02-09) show every look as the default.',
    since: '9.4',
    source: changelogDoc('february-9-2026'),
    botApi: BOT_API,
    verified: false,
    note: 'Telegram does not say which app versions show style; only the release date of 9.4 is known.',
  },
  {
    id: 'iconCustomEmoji',
    rule:
      'icon_custom_emoji_id works only for bots with an extra username bought on Fragment, or in ' +
      "messages the bot sends itself when the bot's owner has Telegram Premium.",
    since: '9.4',
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'The same rule as custom emoji in texts (entities.ts); the exporter tells the owner.',
  },
  {
    id: 'callbackWithoutMessage',
    rule: 'A callback query may carry inline_message_id instead of message (callback_query_mode of setMySettings).',
    since: '10.5',
    source: apiDoc('callbackquery'),
    botApi: BOT_API,
    verified: true,
    note: 'A bot must not assume callback_query.message (HOW-TO-READ.md says so to builders).',
  },
  {
    id: 'loginDomain',
    rule: "A login link's domain must be the domain linked with the bot in BotFather (/setdomain).",
    source: apiDoc('loginurl'),
    botApi: BOT_API,
    verified: true,
    note: 'The features page still names /setdomain; the login page now describes "Allowed URLs" in BotFather.',
  },
] as const satisfies readonly ButtonRuleRow[]
