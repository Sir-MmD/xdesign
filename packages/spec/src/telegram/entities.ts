// Text entities xDesign uses (docs/plan/03 section 5, 08 sections 3 and 7): the MessageEntity
// type of each formatting, its Telegram HTML tag, the rich text mark or node it comes from, and
// the rules for custom emoji and nesting.
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type EntityRow = Sourced & {
  /** The MessageEntity type. */
  readonly id: string
  /** The opening tag in Telegram HTML (parse_mode HTML); attributes as placeholders. */
  readonly html: string
  /** The extra MessageEntity fields it needs. */
  readonly fields: readonly string[]
  /** The mark or node of the rich text schema (03 section 5.1). */
  readonly richText: string
  /** The editor's name. */
  readonly label: string
  readonly since?: string
}

export const ENTITIES = [
  {
    id: 'bold',
    html: '<b>',
    fields: [],
    richText: 'bold',
    label: 'Bold',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'italic',
    html: '<i>',
    fields: [],
    richText: 'italic',
    label: 'Italic',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'underline',
    html: '<u>',
    fields: [],
    richText: 'underline',
    label: 'Underline',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'strikethrough',
    html: '<s>',
    fields: [],
    richText: 'strike',
    label: 'Strikethrough',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'spoiler',
    html: '<tg-spoiler>',
    fields: [],
    richText: 'spoiler',
    label: 'Spoiler',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'code',
    html: '<code>',
    fields: [],
    richText: 'code',
    label: 'Code',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'pre',
    html: '<pre><code class="language-{language}">',
    fields: ['language'],
    richText: 'codeBlock',
    label: 'Code block',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
    note: 'Without a language: <pre> alone.',
  },
  {
    id: 'blockquote',
    html: '<blockquote>',
    fields: [],
    richText: 'blockquote',
    label: 'Quote',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'expandable_blockquote',
    html: '<blockquote expandable>',
    fields: [],
    richText: 'blockquote (expandable)',
    label: 'Expandable quote',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'text_link',
    html: '<a href="{url}">',
    fields: ['url'],
    richText: 'link',
    label: 'Link',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'custom_emoji',
    html: '<tg-emoji emoji-id="{custom_emoji_id}">',
    fields: ['custom_emoji_id'],
    richText: 'customEmoji',
    label: 'Custom emoji',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
    note: 'The tag holds a fallback emoji; see the rule customEmoji.',
  },
  {
    id: 'date_time',
    html: '<tg-time unix="{unix_time}" format="{date_time_format}">',
    fields: ['unix_time', 'date_time_format'],
    richText: 'dateTime',
    label: 'Date and time',
    since: '9.5',
    source: apiDoc('html-style'),
    botApi: BOT_API,
    verified: true,
    note: 'format is optional; the formats are in date-time entity formatting.',
  },
] as const satisfies readonly EntityRow[]

export type EntityType = (typeof ENTITIES)[number]['id']

export type EntityRuleRow = Sourced & { readonly id: string; readonly rule: string; readonly since?: string }

export const ENTITY_RULES = [
  {
    id: 'customEmoji',
    rule:
      'Custom emoji work only for bots with an extra username bought on Fragment, or in messages the ' +
      "bot sends itself to private chats when the bot's owner has Telegram Premium.",
    since: '9.4',
    source: apiDoc('formatting-options'),
    botApi: BOT_API,
    verified: true,
    note: 'The Premium case is new in 9.4; button icons follow the same rule (buttons.ts).',
  },
  {
    id: 'customEmojiFallback',
    rule: 'A custom emoji carries a valid emoji, shown where the custom emoji cannot be.',
    source: apiDoc('formatting-options'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'nesting',
    rule:
      'Entities that share characters nest fully; bold, italic, underline, strikethrough and spoiler ' +
      'nest with any entity except pre and code; quotes do not nest; no other entity contains another.',
    source: apiDoc('formatting-options'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'utf16',
    rule: 'Entity offsets and lengths count UTF-16 code units.',
    source: apiDoc('messageentity'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly EntityRuleRow[]
