// Events and actions (docs/plan/08 sections 1, 2 and 7, 03 sections 2.3 and 7.3): the Bot API
// methods of the action step's kinds, the updates of the event start points, the reaction emoji
// a bot may set, and the rules checks E28, E29, W20, W21, I20 and I21 follow. The gift text's
// length, the delete window and the broadcast rates are in limits.ts; refundStarPayment and the
// payment updates are in payments.ts.
import { apiDoc, BOT_API, faqDoc, type Sourced } from './version.ts'

export type ActionMethodRow = Sourced & {
  /** The Bot API method. */
  readonly id: string
  /** The action step's kind that calls it (null: the developer calls it to prepare one). */
  readonly action: 'react' | 'pin' | 'unpin' | 'delete' | 'gift' | 'chatAction' | 'refund' | null
  /** What it does in the design, in plain words. */
  readonly about: string
}

export const ACTION_METHODS = [
  {
    id: 'setMessageReaction',
    action: 'react',
    about: "The bot's reaction on a message: one emoji reaction, is_big for the large animation.",
    source: apiDoc('setmessagereaction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'pinChatMessage',
    action: 'pin',
    about: 'Pins a message the bot sent; in a private chat every message but a service message can be pinned.',
    source: apiDoc('pinchatmessage'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'unpinChatMessage',
    action: 'unpin',
    about: 'Unpins a message, or without message_id the newest pinned message (by sending date).',
    source: apiDoc('unpinchatmessage'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'deleteMessage',
    action: 'delete',
    about: "Deletes a message the bot sent or the user's own message, within 48 hours of sending it.",
    source: apiDoc('deletemessage'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'getAvailableGifts',
    action: null,
    about: 'The gifts a bot can send now, each with its id and price in Stars: where the gift ID comes from.',
    source: apiDoc('getavailablegifts'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'sendGift',
    action: 'gift',
    about: "Sends a gift paid from the bot's Stars: gift_id, text (0 to 128 characters), pay_for_upgrade.",
    source: apiDoc('sendgift'),
    botApi: BOT_API,
    verified: true,
    note: 'The user cannot turn the gift into Stars.',
  },
  {
    id: 'sendChatAction',
    action: 'chatAction',
    about: 'Shows "typing..." or another status under the bot\'s name, for 5 seconds at most.',
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'refundStarPayment',
    action: 'refund',
    about: "Gives back a Stars payment: the user's ID and the payment's telegram_payment_charge_id.",
    source: apiDoc('refundstarpayment'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly ActionMethodRow[]

export type EventUpdateRow = Sourced & {
  /** The update field and the value it is told by. */
  readonly id: string
  /** The start point it starts. */
  readonly trigger: 'userBlocks' | 'userRestarts' | 'subscriptionChanged'
  readonly update: string
  readonly about: string
}

/** The updates of the event start points (the payment ones are in payments.ts). */
export const EVENT_UPDATES = [
  {
    id: 'my_chat_member.kicked',
    trigger: 'userBlocks',
    update: 'my_chat_member',
    about: 'The user blocked the bot: new_chat_member.status is "kicked".',
    source: apiDoc('update'),
    botApi: BOT_API,
    verified: true,
    note: 'In private chats my_chat_member comes only when the user blocks or unblocks the bot.',
  },
  {
    id: 'my_chat_member.member',
    trigger: 'userRestarts',
    update: 'my_chat_member',
    about: 'The user unblocked the bot: new_chat_member.status is "member" again.',
    source: apiDoc('chatmembermember'),
    botApi: BOT_API,
    verified: true,
    note: 'Telegram\'s "Restart" button also sends /start right after it.',
  },
  {
    id: 'subscription',
    trigger: 'subscriptionChanged',
    update: 'subscription',
    about: 'A Stars subscription changed: state "canceled", "active" (turned back on) or "failed" (not paid).',
    since: '10.2',
    source: apiDoc('botsubscriptionupdated'),
    botApi: BOT_API,
    verified: true,
    note: 'It carries the user and the invoice_payload of the subscription.',
  },
] as const satisfies readonly (EventUpdateRow & { since?: string })[]

export type EventRuleRow = Sourced & { readonly id: string; readonly rule: string }

export const EVENT_RULES = [
  {
    id: 'oneReaction',
    rule: 'A bot sets at most one reaction on a message, an emoji of the reaction list; no paid reactions.',
    source: apiDoc('setmessagereaction'),
    botApi: BOT_API,
    verified: true,
    note: 'A custom emoji reaction only when the message already has it, so xDesign offers emoji only.',
  },
  {
    id: 'reactionEmoji',
    rule: 'A reaction emoji is one of the list of ReactionTypeEmoji (REACTION_EMOJI).',
    source: apiDoc('reactiontypeemoji'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'pinNoNotification',
    rule: 'Telegram never notifies about a pin in a private chat (disable_notification changes nothing there).',
    source: apiDoc('pinchatmessage'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'giftEntities',
    rule: 'A gift text keeps only bold, italic, underline, strikethrough, spoiler, custom emoji and date and time; other formatting is dropped.',
    source: apiDoc('sendgift'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'giftFromBalance',
    rule: "A gift is paid from the bot's Stars balance at the price getAvailableGifts gives (and its upgrade too with pay_for_upgrade).",
    source: apiDoc('gift'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'blockedNoSend',
    rule: 'A bot cannot send anything to a user who blocked it (403 Forbidden) until the user restarts it.',
    source: apiDoc('update'),
    botApi: BOT_API,
    verified: false,
    note: 'Telegram does not document the error text; every bot library reports it.',
  },
  {
    id: 'broadcastRate',
    rule: 'Messages the bot sends first to many users go at about 30 per second; paid broadcasts (allow_paid_broadcast) up to 1000 per second for 0.1 Stars each above the free rate.',
    source: faqDoc('my-bot-is-hitting-limits-how-do-i-avoid-this'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'broadcastStarted',
    rule: 'A bot can write only to users who started it and did not block it.',
    source: faqDoc('how-can-i-message-all-of-my-bots-subscribers-at-once'),
    botApi: BOT_API,
    verified: false,
    note: 'Not stated in one sentence anywhere official; a bot never learns of a user who did not start it.',
  },
  {
    id: 'waitsAreTheBots',
    rule: 'Telegram has no delayed sending for bots: the bot itself keeps every wait and reminder, which must survive a restart.',
    source: apiDoc('sendmessage'),
    botApi: BOT_API,
    verified: false,
    note: 'Seen from the methods: none takes a time to send at (limit keptWait).',
  },
] as const satisfies readonly EventRuleRow[]

/** The emoji a bot may react with (ReactionTypeEmoji), as Telegram writes them (no U+FE0F). */
export const REACTION_EMOJI: readonly string[] = [
  '❤ 👍 👎 🔥 🥰 👏 😁 🤔 🤯 😱 🤬 😢 🎉 🤩 🤮 💩 🙏 👌',
  '🕊 🤡 🥱 🥴 😍 🐳 ❤‍🔥 🌚 🌭 💯 🤣 ⚡ 🍌 🏆 💔 🤨 😐 🍓',
  '🍾 💋 🖕 😈 😴 😭 🤓 👻 👨‍💻 👀 🎃 🙈 😇 😨 🤝 ✍ 🤗 🫡',
  '🎅 🎄 ☃ 💅 🤪 🗿 🆒 💘 🙉 🦄 😘 💊 🙊 😎 👾 🤷‍♂ 🤷 🤷‍♀',
  '😡',
]
  .join(' ')
  .split(' ')

const reactions = new Set<string>(REACTION_EMOJI)

/** The reaction as Telegram takes it (an emoji picker's U+FE0F dropped), or undefined when it is not one. */
export function reactionEmoji(emoji: string): string | undefined {
  const bare = emoji.replaceAll('️', '')
  return reactions.has(bare) ? bare : undefined
}
