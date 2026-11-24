// Message effects (docs/plan/08 sections 3 and 7 item 7, TG-00 section 4.1): the six free effects
// of the editor's "Message effect" option. Telegram documents message_effect_id but no list of
// IDs, so every ID comes from public bot code and is unverified; a runtime that gets an effect
// refused sends the message without it.
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type EffectRow = Sourced & {
  readonly id: string
  readonly emoji: string
  /** The message_effect_id. */
  readonly effectId: string
  /** Other IDs reported for the same effect: the sources disagree. */
  readonly otherIds?: readonly string[]
}

const REMNASHOP = 'https://github.com/remnashop/remnashop/blob/HEAD/src/core/enums.py'
const NODE_RED = 'https://github.com/guidone/node-red-contrib-chatbot/blob/HEAD/lib/platforms/telegram.js'

export const EFFECTS = [
  {
    id: 'fire',
    emoji: '🔥',
    effectId: '5104841245755180586',
    source: REMNASHOP,
    botApi: BOT_API,
    verified: false,
    note: 'From public bot code (remnashop, node-red-contrib-chatbot, aiogram-3-guide); not in the docs.',
  },
  {
    id: 'thumbsUp',
    emoji: '👍',
    effectId: '5107584321108051014',
    source: NODE_RED,
    botApi: BOT_API,
    verified: false,
    note: 'From public bot code (node-red-contrib-chatbot, a remnawave bot); not in the docs.',
  },
  {
    id: 'thumbsDown',
    emoji: '👎',
    effectId: '5104858069142078462',
    source: NODE_RED,
    botApi: BOT_API,
    verified: false,
    note: 'From public bot code (node-red-contrib-chatbot, a remnawave bot); not in the docs.',
  },
  {
    id: 'heart',
    emoji: '❤️',
    effectId: '5159385139981059251',
    otherIds: ['5044134455711629726'],
    source: REMNASHOP,
    botApi: BOT_API,
    verified: false,
    note: 'Two IDs are reported (remnashop and node-red use this one, a remnawave bot the other): unresolved.',
  },
  {
    id: 'party',
    emoji: '🎉',
    effectId: '5046509860389126442',
    source: REMNASHOP,
    botApi: BOT_API,
    verified: false,
    note: 'From public bot code (remnashop, node-red-contrib-chatbot and many bots); not in the docs.',
  },
  {
    id: 'poop',
    emoji: '💩',
    effectId: '5046589136895476101',
    source: REMNASHOP,
    botApi: BOT_API,
    verified: false,
    note: 'From public bot code (remnashop, node-red-contrib-chatbot, a remnawave bot); not in the docs.',
  },
] as const satisfies readonly EffectRow[]

export type EffectId = (typeof EFFECTS)[number]['id']

export type EffectRuleRow = Sourced & { readonly id: string; readonly rule: string }

export const EFFECT_RULES = [
  {
    id: 'privateChatsOnly',
    rule: 'Message effects work in private chats only.',
    source: apiDoc('sendmessage'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'newMessagesOnly',
    rule: 'Effects play on new messages only: no edit method takes message_effect_id.',
    source: apiDoc('updating-messages'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'notOnPaidMedia',
    rule: 'sendPaidMedia takes no message_effect_id; every other send method of messages.ts does.',
    source: apiDoc('sendpaidmedia'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'learnFromMessage',
    rule: 'An incoming message with an effect carries its ID in effect_id, which confirms an ID.',
    source: apiDoc('message'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly EffectRuleRow[]
