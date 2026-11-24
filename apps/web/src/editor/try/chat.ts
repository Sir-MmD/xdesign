// The engine's state as PRV-02's chat draws it (docs/plan/04 section 8): the entries in order
// (deleted messages left out), each bot message's content with its texts already in the tester's
// language, its inline buttons as buttons of a design of the chat's own (their labels filled in
// by the engine), the bottom keyboard and the input field's placeholder as the engine keeps them,
// and the user's messages in words. A poll or quiz carries the tester's vote, paid media whether
// it was bought (MSG-03). A rich message's buttons inside go in the chat's design like the
// keyboard's; a message written out like a draft shows only its written part, without its
// keyboard, while it is written (RICH-01), and a stopped draft that stays what was written then
// (RICH-02). An invoice is its card (a subscription's message with its link), and its open
// payment sheet is drawn by the chat (PAY-02). The bot's reactions sit on their messages, a gift
// is its card, and the pinned message shows in the bar under the top bar (EVT-02).
import type {
  ChatDesign,
  ChatEntry,
  ChatOptions,
  MessageButton,
  MessageContent,
  RichDoc,
  RichMessageBlockIn,
  TgChatAction,
  TgPaymentSheet,
} from '@xdesign/preview'
import {
  type ChatAction,
  type Design,
  plainText,
  type SimBotEntry,
  type SimContent,
  type SimInlineButton,
  type SimRichBlock,
  type SimSent,
  type SimState,
  telegram,
} from '@xdesign/spec'

export type TryChat = {
  entries: ChatEntry[]
  /** The engine's entry of each row, by the row's key (its index). */
  rows: SimBotEntry[]
  design: ChatDesign
  bottom: NonNullable<ChatOptions['bottom']>
  /** The pinned message's text in words (the newest pinned), for the bar under the top bar. */
  pinned: string | undefined
}

/** The chat for a state in the tester's language; `keyboardOpen` is the bottom keyboard shown or folded. */
/** A message the bot writes out like a draft in Try it: its entry and the part written, 0 to 1. */
export type Writing = { entryId: string; part: number }

export function tryChat(
  state: SimState,
  design: Design,
  lang: string,
  keyboardOpen: boolean,
  writing?: Writing,
): TryChat {
  const entries: ChatEntry[] = []
  const rows: SimBotEntry[] = []
  const buttons: Record<string, MessageButton> = {}
  for (const entry of state.chat) {
    if (entry.from === 'user') {
      entries.push({ type: 'user', text: sentText(entry.sent), reaction: entry.reaction?.emoji })
      continue
    }
    if (entry.deleted) continue
    rows[entries.length] = entry
    const now = writing?.entryId === entry.id ? writing.part : entry.stopped
    const lines = now === undefined ? (entry.keyboard ?? []).filter((line) => line.length > 0) : []
    const inside = entry.content.type === 'rich' ? entry.content.blocks : []
    const insideButtons = inside.flatMap((block) => (block.type === 'buttons' ? block.buttons : []))
    for (const button of [...lines.flat(), ...insideButtons]) {
      buttons[buttonKey(entry.id, button.id)] = inlineButton(button, lang)
    }
    const content = now === undefined ? entry.content : written(entry.content, now)
    entries.push({
      type: 'bot',
      message: {
        content: messageContent(content, lang, (id) => buttonKey(entry.id, id)),
        keyboard:
          lines.length > 0
            ? {
                type: 'inline',
                rows: lines.map((line) => ({
                  type: 'buttons',
                  ids: line.map((button) => buttonKey(entry.id, button.id)),
                })),
              }
            : null,
        sent: { vote: entry.vote, paid: entry.paid },
      },
      reaction: entry.reaction?.emoji,
    })
  }
  const keyboard = state.bottomKeyboard
  return {
    entries,
    rows,
    design: { ...design, buttons },
    bottom: {
      keyboard: keyboard
        ? {
            rows: keyboard.rows.map((line) =>
              line.map((button) => ({
                text: button.label,
                style: button.look === 'default' ? 'none' : button.look,
                ...(button.icon ? { icon: button.icon.customEmojiId, icon_alt: button.icon.fallback } : {}),
              })),
            ),
            resize: keyboard.resize,
            persistent: keyboard.persistent,
            open: keyboardOpen,
          }
        : undefined,
      placeholder: state.placeholder ?? undefined,
    },
    pinned: pinnedText(state),
  }
}

/** The newest pinned message in words: a text's, a gift's description, else its kind with its caption or title. */
function pinnedText(state: SimState): string | undefined {
  const id = state.pinned.at(-1)
  const entry = id === undefined ? undefined : state.chat.find((item) => item.id === id)
  if (entry?.from !== 'bot' || entry.deleted) return undefined
  const { content } = entry
  const words = (doc: Parameters<typeof plainText>[0] | null | undefined) =>
    doc
      ? plainText(
          doc,
          () => '',
          () => '',
        ).trim()
      : ''
  switch (content.type) {
    case 'text':
      return words(content.text)
    case 'gift':
      return `🎁 ${content.description}`
    case 'invoice':
      return content.title
    case 'poll':
    case 'quiz':
      return `📊 ${words(content.question)}`
    default: {
      const caption = 'caption' in content ? words(content.caption) : ''
      const kind = telegram.messageKind(content.type).label
      return caption === '' ? kind : `${kind}, ${caption}`
    }
  }
}

/** The inline button at a line and place of a row's message, as the chat drew it. */
export function pressedInline(chat: TryChat, row: string, line: number, place: number) {
  const entry = chat.rows[Number(row)]
  const button = entry?.keyboard?.filter((item) => item.length > 0)[line]?.[place]
  return entry && button ? { entryId: entry.id, buttonId: button.id } : undefined
}

/** The button inside a row's rich message at a button row (among its button rows) and place (RICH-02). */
export function pressedInside(chat: TryChat, row: string, line: number, place: number) {
  const entry = chat.rows[Number(row)]
  const blocks = entry?.content.type === 'rich' ? entry.content.blocks : []
  const lines = blocks.flatMap((block) => (block.type === 'buttons' ? [block.buttons] : []))
  const button = lines[line]?.[place]
  return entry && button ? { entryId: entry.id, buttonId: button.id } : undefined
}

function buttonKey(entryId: string, buttonId: string): string {
  return `${entryId}:${buttonId}`
}

// The engine's button as a design button of the chat: its filled-in label in the tester's
// language, its look and icon, and what it does (a link's address, a copied text).
function inlineButton(button: SimInlineButton, lang: string): MessageButton {
  const base = { place: 'inline' as const, label: { [lang]: button.label }, look: button.look, icon: button.icon }
  switch (button.action) {
    case 'url':
    case 'loginUrl':
      return { ...base, action: { type: button.action, url: button.value ?? '' } }
    case 'copyText':
      return { ...base, action: { type: 'copyText', text: { [lang]: button.value ?? '' } } }
    case 'goTo':
      return { ...base, action: { type: 'goTo' } }
    case 'pay':
      return { ...base, action: { type: 'pay' } }
  }
}

// The part of a text or rich message written so far: a text's first characters (without their
// formatting until it is sent), a rich message's first blocks.
function written(content: SimContent, part: number): SimContent {
  if (content.type === 'text') {
    const plain = plainText(
      content.text,
      () => '',
      () => '',
    )
    const lines = plain.slice(0, Math.round(plain.length * part)).split('\n')
    const paragraphs = lines.map((line) => ({
      type: 'paragraph' as const,
      ...(line === '' ? {} : { content: [{ type: 'text' as const, text: line }] }),
    }))
    return { ...content, text: { type: 'doc', content: paragraphs } }
  }
  if (content.type === 'rich') {
    return { ...content, blocks: content.blocks.slice(0, Math.max(1, Math.ceil(content.blocks.length * part))) }
  }
  return content
}

// A resolved content as the chat's message content: each document as the text of the language;
// a rich message's buttons by their keys in the chat's design.
function messageContent(content: SimContent, lang: string, key: (id: string) => string): MessageContent {
  const text = (doc: RichDoc) => ({ doc: { [lang]: doc } })
  switch (content.type) {
    case 'text':
      return { type: 'text', text: text(content.text) }
    case 'album':
      return {
        type: 'album',
        items: content.items.map((item) => ({ media: item.media, caption: item.caption && text(item.caption) })),
      }
    case 'videoNote':
    case 'sticker':
      return { type: content.type, media: content.media }
    case 'location':
    case 'venue':
    case 'contact':
      return { type: content.type }
    case 'poll':
    case 'quiz':
      return {
        type: content.type,
        question: text(content.question),
        options: content.options.map((option) => ({ [lang]: option })),
        anonymous: content.anonymous,
        multiple: content.multiple,
        correct: content.type === 'quiz' ? content.correct : undefined,
      }
    case 'dice':
      return { type: content.type, emoji: content.emoji }
    case 'paidMedia':
      return {
        type: content.type,
        items: content.items,
        stars: content.stars,
        caption: content.caption && text(content.caption),
      }
    case 'rich':
      return { type: 'rich', blocks: content.blocks.map((block) => richBlock(block, text, key)), rtl: content.rtl }
    case 'invoice':
      return {
        type: 'invoice',
        title: { [lang]: content.title },
        description: { [lang]: content.description },
        photo: content.photo,
        price: telegram.priceText(content.currency, content.total),
        link: content.subscription !== undefined,
      }
    // Stage 2 (EVT-02): a gift's card with its text.
    case 'gift':
      return { type: 'gift', description: content.description, text: content.text ? text(content.text) : undefined }
    default:
      return { type: content.type, media: content.media, caption: content.caption && text(content.caption) }
  }
}

/**
 * The payment sheet open on an invoice (the engine's `payment`): its texts in the tester's
 * language, the prices as Telegram writes them, what it asks for and the shipping options with the
 * total each makes.
 */
export function paymentSheet(
  state: SimState,
  mediaUrl: (id: string) => string | undefined,
): TgPaymentSheet | undefined {
  const entry = state.payment ? state.chat.find((item) => item.id === state.payment?.entryId) : undefined
  if (entry?.from !== 'bot' || entry.content.type !== 'invoice') return undefined
  const { title, description, photo, currency, prices, total, subscription, physical, shipping } = entry.content
  const price = (amount: number) => telegram.priceText(currency, amount)
  const asks = physical
    ? [
        physical.needName && 'Name',
        physical.needPhone && 'Phone number',
        physical.needEmail && 'Email',
        physical.needAddress && 'Shipping address',
      ].filter((ask) => ask !== false)
    : []
  return {
    stars: telegram.isStars(currency),
    title,
    description,
    photoUrl: photo && 'media' in photo ? mediaUrl(photo.media) : undefined,
    lines: prices.map((line) => ({ label: line.label, price: price(line.amount) })),
    total: price(total),
    every: subscription ? `every ${String(subscription.periodDays)} days` : undefined,
    asks,
    shipping: shipping?.map((option) => ({
      id: option.id,
      title: option.title,
      price: price(option.amount),
      total: price(total + option.amount),
    })),
  }
}

// A rich message's block with each document as the text of the language; a button row by its
// buttons' keys (the phone draws them from the chat's design).
function richBlock(
  block: SimRichBlock,
  text: (doc: RichDoc) => { doc: Record<string, RichDoc> },
  key: (id: string) => string,
): RichMessageBlockIn {
  switch (block.type) {
    case 'paragraph':
    case 'footer':
    case 'heading':
    case 'code':
      return { ...block, text: text(block.text) }
    case 'quote':
      return { ...block, text: text(block.text), credit: block.credit && text(block.credit) }
    case 'list':
      return { ...block, items: block.items.map((item) => ({ ...item, text: text(item.text) })) }
    case 'table':
      return {
        ...block,
        rows: block.rows.map((row) => ({ cells: row.cells.map((cell) => ({ ...cell, text: text(cell.text) })) })),
        caption: block.caption && text(block.caption),
      }
    case 'details':
      return { ...block, summary: text(block.summary), text: text(block.text) }
    case 'divider':
      return block
    case 'media':
      return { ...block, caption: block.caption && text(block.caption) }
    case 'buttons':
      return { type: 'buttons', ids: block.buttons.map((button) => key(button.id)) }
  }
}

/** What the tester sent, in the words of their bubble. */
export function sentText(sent: SimSent): string {
  switch (sent.type) {
    case 'text':
      return sent.text
    case 'media':
      return `${mediaIcons[sent.kind]} ${sent.name}`
    case 'contact':
      return `📞 ${sent.phone}`
    case 'location':
      return `📍 ${String(sent.latitude)}, ${String(sent.longitude)}`
    case 'users':
      return `👤 User ${String(sent.userId)}`
    case 'chat':
      return `${sent.channel ? '📢 Channel' : '👥 Group'} ${String(sent.chatId)}`
    case 'poll':
      return `📊 ${sent.question}`
    case 'unexpected':
      return 'A message the bot does not expect'
  }
}

const mediaIcons = { photo: '🖼️', video: '🎬', file: '📄', voice: '🎤', audio: '🎵' } as const

/** What the top bar says while a message waits for its chat action ("typing", "sending photo"). */
export function chatActionOf(action: ChatAction): TgChatAction {
  switch (action) {
    case 'typing':
      return 'typing'
    case 'upload_photo':
      return 'photo'
    case 'record_video':
    case 'upload_video':
      return 'video'
    case 'record_voice':
    case 'upload_voice':
      return 'voice'
    case 'upload_document':
      return 'file'
    case 'choose_sticker':
      return 'sticker'
    case 'find_location':
      return 'location'
    case 'record_video_note':
    case 'upload_video_note':
      return 'videoNote'
  }
}
