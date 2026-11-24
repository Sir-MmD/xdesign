// The input adapter (PRV-01): an xDesign message (docs/plan/03-design-model.md sections 2.4, 2.5
// and 5) as the post xWriter's Telegram preview renders (platforms/telegram/model.ts). The
// shapes below are the parts of SPEC-01's model the adapter reads, written here so the preview
// needs no dependency on packages/spec: a message step or a question's prompt, and the design's
// own maps, fit them as they are. Until SPEC-02's toTelegram is merged the rich text becomes
// Telegram's text and entities by a walk of its own, with each variable written `{idName}` and
// a text part's text in place (03 section 5.2). The private chat (PRV-02) reads the bot's setup
// and the start points' commands as well (ChatDesign), and its entries leave the bottom keyboard.
import { paragraphDirection } from './platforms/telegram/bidi'
import type {
  Entity,
  InlineKeyboard,
  KeyboardButton,
  KeyboardRow,
  MediaKind,
  PreviewMedia,
  PreviewRich,
  ReplyButton,
  RichBlock as PreviewRichBlock,
  TgChat,
  TgChatAction,
  TgChatRow,
  TgCommand,
  TgInvoice,
  TgPaymentSheet,
  TgPoll,
  TgPreviewPost,
  TgReplyKeyboard,
} from './platforms/telegram/model'

/** A plain text per language. */
export type LangText = Partial<Record<string, string>>

export type RichMark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' | 'spoiler' | 'code' }
  | { type: 'link'; attrs: { href: string } }
  | { type: 'dateTime'; attrs: { unix: number; format: string } }

type Marks = readonly RichMark[] | undefined

export type RichInline =
  | { type: 'text'; text: string; marks?: Marks }
  | { type: 'hardBreak'; marks?: Marks }
  | { type: 'variable'; attrs: { var: string }; marks?: Marks }
  | { type: 'customEmoji'; attrs: { id: string; fallback: string }; marks?: Marks }
  | { type: 'part'; attrs: { part: string }; marks?: Marks }

interface RichParagraph {
  type: 'paragraph'
  content?: readonly RichInline[] | undefined
}

export type RichBlock =
  | RichParagraph
  | {
      type: 'codeBlock'
      attrs?: { language?: string | null | undefined } | undefined
      content?: readonly { text: string }[] | undefined
    }
  | { type: 'blockquote'; attrs?: { expandable?: boolean | undefined } | undefined; content: readonly RichParagraph[] }

export interface RichDoc {
  type: 'doc'
  content: readonly RichBlock[]
}

/** A rich text: its document per language. */
export interface RichTextRef {
  doc: Partial<Record<string, RichDoc>>
}

/** An uploaded file by its ID, or a placeholder the developer fills. */
export type MediaSlot = { media: string } | { placeholder: { description: string } }

export type MessageContent =
  | { type: 'text'; text: RichTextRef }
  | {
      type: 'photo' | 'livePhoto' | 'video' | 'animation' | 'audio' | 'voice' | 'document'
      media: MediaSlot
      caption?: RichTextRef | undefined
    }
  | { type: 'videoNote' | 'sticker'; media: MediaSlot }
  | { type: 'album'; items: readonly { media: MediaSlot; caption?: RichTextRef | undefined }[] }
  | { type: 'location' | 'venue' | 'contact' }
  // Stage 2 (MSG-03): a poll's or quiz's question and options, a dice's emoji, paid media's items and price.
  | {
      type: 'poll' | 'quiz'
      question: RichTextRef
      options: readonly LangText[]
      anonymous: boolean
      multiple: boolean
      correct?: readonly number[] | undefined
    }
  | { type: 'dice'; emoji: string }
  | { type: 'paidMedia'; items: readonly { media: MediaSlot }[]; stars: number; caption?: RichTextRef | undefined }
  // RICH-01: a rich message's blocks.
  | { type: 'rich'; blocks: readonly RichMessageBlockIn[]; rtl?: boolean | undefined }
  // Stage 2 (PAY-02): an invoice's title and description, its photo and its total as Telegram
  // writes it ("⭐️50", "4.50 USD"); `link`, a subscription: a message with its invoice link in a
  // url button in place of the pay button (createInvoiceLink).
  | {
      type: 'invoice'
      title: LangText
      description: LangText
      photo?: MediaSlot | undefined
      price: string
      link?: boolean | undefined
    }
  // Stage 2 (EVT-02): a gift the bot sends, which gift in the design's words, and its text.
  | { type: 'gift'; description: string; text?: RichTextRef | undefined }

/** A block of a rich message (SPEC's RichMessageBlock); `buttons` names inline buttons of the design. */
export type RichMessageBlockIn =
  | { type: 'paragraph' | 'footer'; text: RichTextRef }
  | { type: 'heading'; text: RichTextRef; size: number }
  | { type: 'code'; text: RichTextRef; language?: string | undefined }
  | { type: 'quote'; text: RichTextRef; credit?: RichTextRef | undefined; expandable?: boolean | undefined }
  | { type: 'list'; ordered: boolean; items: readonly { text: RichTextRef; checked?: boolean | undefined }[] }
  | {
      type: 'table'
      rows: readonly { cells: readonly { text: RichTextRef; header?: boolean | undefined }[] }[]
      caption?: RichTextRef | undefined
    }
  | { type: 'details'; summary: RichTextRef; text: RichTextRef; open?: boolean | undefined }
  | { type: 'divider' }
  | { type: 'media'; media: MediaSlot; caption?: RichTextRef | undefined }
  | { type: 'buttons'; ids: readonly string[] }

/** A keyboard's row: buttons by ID, or a row part placed in it. */
export type KeyboardRowRef = { type: 'buttons'; ids: readonly string[] } | { type: 'part'; part: string }

export type MessageKeyboard =
  | { type: 'inline'; rows: readonly KeyboardRowRef[] }
  | {
      type: 'reply'
      rows: readonly KeyboardRowRef[]
      oneTime: boolean
      persistent: boolean
      resize: boolean
      placeholder?: LangText | undefined
    }
  | { type: 'removeReply' }
  | { type: 'forceReply'; placeholder?: LangText | undefined }
  | null

type ButtonLook = 'default' | 'primary' | 'success' | 'danger'

export type MessageButton =
  | {
      place: 'inline'
      label: LangText
      look: ButtonLook
      icon?: { customEmojiId: string; fallback: string } | undefined
      action:
        | { type: 'goTo' }
        | { type: 'url'; url: string }
        | { type: 'copyText'; text: LangText }
        | { type: 'loginUrl'; url: string }
        // Stage 2: an invoice's pay button (PAY-02), a link's button on a subscription's message.
        | { type: 'pay' }
    }
  | {
      place: 'reply'
      label: LangText
      look: ButtonLook
      icon?: { customEmojiId: string; fallback: string } | undefined
    }

export type MessagePart =
  | { kind: 'rows'; place: 'inline' | 'reply'; rows: readonly (readonly string[])[] }
  | { kind: 'text'; text: RichTextRef }

/**
 * What the bot sends: a message step's content and keyboard, or a question's prompt. `sent`, the
 * message as the user has it in a conversation (Try it): a quiz's right options hidden until the
 * `vote`, paid media locked until `paid`; without it (the editor), a quiz shows its right options.
 */
export interface BotMessage {
  content: MessageContent
  keyboard: MessageKeyboard
  sent?: { vote?: readonly number[] | undefined; paid?: boolean | undefined } | undefined
}

/** The parts of the design a message reads. */
export interface MessageDesign {
  languages: { default: string }
  bot: { name: LangText }
  buttons: Readonly<Record<string, MessageButton>>
  parts: Readonly<Record<string, MessagePart>>
  variables: Readonly<Record<string, { idName: string }>>
  media: Readonly<
    Record<
      string,
      {
        kind: string
        name: string
        width?: number | undefined
        height?: number | undefined
        durationMs?: number | undefined
      }
    >
  >
}

export interface AdaptOptions {
  /** The language shown; a text without it shows the default language's. */
  lang: string
  /** The time of the message (ISO); now when left out. */
  date?: string | undefined
  /** How a variable shows in a text; `{idName}` by default, as Telegram's text form writes it. */
  varText?: ((id: string) => string) | undefined
  /** The picture of an uploaded file (a photo, or a video's first frame) by its media ID; without one the file shows as a placeholder. */
  mediaUrl?: ((id: string) => string | undefined) | undefined
}

/** The size of a placeholder's picture, and of a file whose size is not known. */
const placeholderSize = { width: 1280, height: 720 }

/** A placeholder's picture: a grey box with its description, as the editor shows placeholders (04 section 5.4). */
export function placeholderPicture(width: number, height: number, description: string): string {
  const text = description.length > 48 ? `${description.slice(0, 47)}…` : description
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">` +
    `<rect width="100%" height="100%" fill="#b8bcc0"/>` +
    `<text x="50%" y="50%" fill="#4a4e52" font-family="sans-serif" font-size="${String(Math.round(height / 14))}" text-anchor="middle" dominant-baseline="middle">${escaped}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** A text in the language, else in the default language. */
function inLang<T>(texts: Partial<Record<string, T>>, lang: string, fallback: string): T | undefined {
  return texts[lang] ?? texts[fallback]
}

interface Walk {
  text: string
  entities: Entity[]
  design: MessageDesign
  lang: string
  varText: (id: string) => string
  /** The text parts being written, so a part that contains itself stops. */
  parts: Set<string>
}

/** One mark's entity identity: the same mark on the next node goes on in the same entity. */
function markKey(mark: RichMark): string {
  switch (mark.type) {
    case 'link':
      return `link ${mark.attrs.href}`
    case 'dateTime':
      return `dateTime ${String(mark.attrs.unix)} ${mark.attrs.format}`
    default:
      return mark.type
  }
}

/** A mark's entity, from `offset` (its length is set when it ends). */
function markEntity(mark: RichMark, offset: number): Entity {
  switch (mark.type) {
    case 'link':
      return { type: 'text_link', offset, length: 0, url: mark.attrs.href }
    case 'dateTime':
      return { type: 'formatted_date', offset, length: 0, unix_time: mark.attrs.unix, date_format: mark.attrs.format }
    default:
      return { type: mark.type, offset, length: 0 }
  }
}

function addEntity(w: Walk, entity: Entity): void {
  if (entity.length > 0) w.entities.push(entity)
}

/** The inline nodes of a paragraph: a run of nodes with the same mark is one entity. */
function walkInline(w: Walk, nodes: readonly RichInline[]): void {
  const open = new Map<string, Entity>()
  const closeAllBut = (keep: ReadonlySet<string>) => {
    for (const [key, entity] of open) {
      if (keep.has(key)) continue
      entity.length = w.text.length - entity.offset
      addEntity(w, entity)
      open.delete(key)
    }
  }
  for (const node of nodes) {
    const marks = node.marks ?? []
    closeAllBut(new Set(marks.map(markKey)))
    for (const mark of marks) {
      const key = markKey(mark)
      if (!open.has(key)) open.set(key, markEntity(mark, w.text.length))
    }
    switch (node.type) {
      case 'text':
        w.text += node.text
        break
      case 'hardBreak':
        w.text += '\n'
        break
      case 'variable':
        w.text += w.varText(node.attrs.var)
        break
      case 'customEmoji': {
        const offset = w.text.length
        w.text += node.attrs.fallback
        addEntity(w, {
          type: 'custom_emoji',
          offset,
          length: w.text.length - offset,
          custom_emoji_id: node.attrs.id,
        })
        break
      }
      case 'part': {
        const part = w.design.parts[node.attrs.part]
        if (part?.kind !== 'text' || w.parts.has(node.attrs.part)) break
        const doc = inLang(part.text.doc, w.lang, w.design.languages.default)
        if (!doc) break
        w.parts.add(node.attrs.part)
        walkDoc(w, doc)
        w.parts.delete(node.attrs.part)
        break
      }
    }
  }
  closeAllBut(new Set())
}

/** A document's blocks joined by line breaks: a code block is a pre entity, a quote a blockquote one. */
function walkDoc(w: Walk, doc: RichDoc): void {
  doc.content.forEach((block, i) => {
    if (i > 0) w.text += '\n'
    const offset = w.text.length
    switch (block.type) {
      case 'paragraph':
        walkInline(w, block.content ?? [])
        break
      case 'codeBlock': {
        w.text += (block.content ?? []).map((node) => node.text).join('')
        const language = block.attrs?.language
        addEntity(w, { type: 'pre', offset, length: w.text.length - offset, ...(language ? { language } : {}) })
        break
      }
      case 'blockquote':
        block.content.forEach((paragraph, j) => {
          if (j > 0) w.text += '\n'
          walkInline(w, paragraph.content ?? [])
        })
        addEntity(w, {
          type: 'blockquote',
          offset,
          length: w.text.length - offset,
          collapsed: block.attrs?.expandable === true,
        })
        break
    }
  })
}

/** The preview's kind of a file sent as a photo, video or GIF; other kinds have no picture in the bubble. */
function pictureKind(kind: string): MediaKind | undefined {
  switch (kind) {
    case 'photo':
    case 'livePhoto':
      return 'photo'
    case 'video':
    case 'animation':
      return kind
    default:
      return undefined
  }
}

/** A media slot as the bubble's picture: the file's own, else a placeholder's grey box. */
function slotMedia(slot: MediaSlot, kind: MediaKind, design: MessageDesign, options: AdaptOptions): PreviewMedia {
  if ('placeholder' in slot) {
    const { width, height } = placeholderSize
    return { kind, url: placeholderPicture(width, height, slot.placeholder.description), width, height }
  }
  const item = design.media[slot.media]
  const width = item?.width ?? placeholderSize.width
  const height = item?.height ?? placeholderSize.height
  const duration = item?.durationMs === undefined ? {} : { durationSec: Math.round(item.durationMs / 1000) }
  const url = options.mediaUrl?.(slot.media) ?? placeholderPicture(width, height, item?.name ?? '')
  return { kind, url, width, height, ...duration }
}

/** An inline button as xWriter's keyboard draws it: its look, the mark of what it does, its icon. */
export function keyboardButton(
  button: Extract<MessageButton, { place: 'inline' }>,
  lang: string,
  fallback: string,
): KeyboardButton {
  const { action } = button
  const base: KeyboardButton = {
    text: inLang(button.label, lang, fallback) ?? '',
    kind:
      action.type === 'url' || action.type === 'loginUrl' ? 'url' : action.type === 'copyText' ? 'copy' : 'callback',
    style: button.look === 'default' ? 'none' : button.look,
  }
  if (action.type === 'url' || action.type === 'loginUrl') base.url = action.url
  if (action.type === 'copyText') base.copy_text = inLang(action.text, lang, fallback) ?? ''
  if (button.icon) {
    base.icon = button.icon.customEmojiId
    base.icon_alt = button.icon.fallback
  }
  return base
}

/** A keyboard's rows of buttons of the place (inline or reply), a row part's rows in its place. */
function placedRows(rows: readonly KeyboardRowRef[], place: MessageButton['place'], design: MessageDesign) {
  const out: MessageButton[][] = []
  for (const row of rows) {
    let idRows: readonly (readonly string[])[] = []
    if (row.type === 'buttons') idRows = [row.ids]
    else {
      const part = design.parts[row.part]
      if (part?.kind === 'rows' && part.place === place) idRows = part.rows
    }
    for (const ids of idRows) {
      const buttons: MessageButton[] = []
      for (const id of ids) {
        const button = design.buttons[id]
        if (button?.place === place) buttons.push(button)
      }
      out.push(buttons)
    }
  }
  return out
}

/**
 * The inline keyboard's rows, a row part's rows in its place; the bottom keyboard is the chat's
 * (adaptChat). `payLink`: the pay buttons open a subscription's invoice link (PAY-02).
 */
function inlineKeyboard(
  keyboard: MessageKeyboard,
  design: MessageDesign,
  lang: string,
  payLink = false,
): InlineKeyboard | undefined {
  if (keyboard?.type !== 'inline') return undefined
  const fallback = design.languages.default
  return placedRows(keyboard.rows, 'inline', design).map((row): KeyboardRow => ({
    buttons: row.flatMap((button): KeyboardButton[] => {
      if (button.place !== 'inline') return []
      const shown = keyboardButton(button, lang, fallback)
      return [payLink && button.action.type === 'pay' ? { ...shown, kind: 'url', url: invoiceLink } : shown]
    }),
  }))
}

/** A subscription's invoice link as the pay button's tooltip (the bot makes the real one). */
const invoiceLink = 'https://t.me/$invoice'

/**
 * An invoice's keyboard: its own, else Telegram's pay button with the total ("Pay ⭐️50"); a
 * subscription's pay buttons are links (PAY-02).
 */
function invoiceKeyboard(
  content: Extract<MessageContent, { type: 'invoice' }>,
  keyboard: MessageKeyboard,
  design: MessageDesign,
  lang: string,
): InlineKeyboard | undefined {
  const link = content.link === true
  if (keyboard !== null) return inlineKeyboard(keyboard, design, lang, link)
  const text = `Pay ${content.price}`
  return [
    {
      buttons: [
        link ? { text, kind: 'url', url: invoiceLink, style: 'none' } : { text, kind: 'callback', style: 'none' },
      ],
    },
  ]
}

/**
 * An xDesign message as the preview's post, a bot's message in a private chat: its text or
 * caption (an album's first caption), its photos, videos and GIFs (a placeholder as a grey
 * box), and its inline keyboard. The bot's name stands in the channel's place; views,
 * reactions and comments are a channel's and stay off.
 */
export function adaptMessage(message: BotMessage, design: MessageDesign, options: AdaptOptions): TgPreviewPost {
  const { lang } = options
  const fallback = design.languages.default
  const varText = options.varText ?? ((id: string) => `{${design.variables[id]?.idName ?? id}}`)
  const walk: Walk = { text: '', entities: [], design, lang, varText, parts: new Set() }
  const { content, sent } = message
  let rich: RichTextRef | undefined
  const media: PreviewMedia[] = []
  let poll: TgPoll | undefined
  let invoice: TgInvoice | undefined
  switch (content.type) {
    case 'text':
      rich = content.text
      break
    case 'poll':
    case 'quiz': {
      rich = content.question
      const quiz = content.type === 'quiz'
      poll = {
        quiz,
        anonymous: content.anonymous,
        multiple: content.multiple,
        options: content.options.map((option) => inLang(option, lang, fallback) ?? ''),
        right: quiz && (!sent || sent.vote) ? (content.correct ?? []) : undefined,
        vote: sent?.vote,
      }
      break
    }
    case 'dice':
      walk.text = content.emoji
      break
    // An invoice's card; a subscription's message is its title in bold over its description.
    case 'invoice': {
      const title = inLang(content.title, lang, fallback) ?? ''
      const description = inLang(content.description, lang, fallback) ?? ''
      if (content.photo) media.push(slotMedia(content.photo, 'photo', design, options))
      if (!content.link) {
        invoice = { title, description, price: content.price }
        break
      }
      walk.text = description === '' ? title : `${title}\n${description}`
      if (title !== '') walk.entities.push({ type: 'bold', offset: 0, length: title.length })
      break
    }
    // A gift's card, its text as the post's text (EVT-02).
    case 'gift':
      rich = content.text
      break
    case 'paidMedia':
    case 'album':
      rich = content.type === 'album' ? content.items.find((item) => item.caption)?.caption : content.caption
      for (const item of content.items) {
        const kind = 'media' in item.media ? pictureKind(design.media[item.media.media]?.kind ?? '') : 'photo'
        if (kind) media.push(slotMedia(item.media, kind, design, options))
      }
      break
    case 'location':
    case 'venue':
    case 'contact':
    case 'videoNote':
    case 'sticker':
    case 'rich':
      break
    default: {
      rich = content.caption
      const kind = pictureKind(content.type)
      if (kind) media.push(slotMedia(content.media, kind, design, options))
    }
  }
  const doc = rich ? inLang(rich.doc, lang, fallback) : undefined
  if (doc) walkDoc(walk, doc)
  const richPost = content.type === 'rich' ? adaptRich(walk, content, design, options, media) : undefined
  // Telegram keeps only the custom emoji of a poll's question.
  if (poll) walk.entities = walk.entities.filter((entity) => entity.type === 'custom_emoji')
  const asCaption =
    content.type !== 'text' &&
    content.type !== 'rich' &&
    content.type !== 'gift' &&
    !(content.type === 'invoice' && media.length === 0)
  return {
    text: walk.text,
    entities: walk.entities,
    asCaption,
    media,
    linkPreview: null,
    invertMedia: false,
    channel: { title: inLang(design.bot.name, lang, fallback) ?? '' },
    views: 0,
    date: options.date ?? new Date().toISOString(),
    reactions: null,
    comments: null,
    length: walk.text.length,
    limit: asCaption ? 1024 : content.type === 'rich' ? 32768 : content.type === 'gift' ? 128 : 4096,
    issues: [],
    language: lang,
    rtl: paragraphDirection(walk.text) === 'rtl',
    keyboard:
      content.type === 'invoice'
        ? invoiceKeyboard(content, message.keyboard, design, lang)
        : inlineKeyboard(message.keyboard, design, lang),
    bot: true,
    poll,
    dice: content.type === 'dice',
    paid: content.type === 'paidMedia' ? { stars: content.stars, locked: sent?.paid !== true } : undefined,
    invoice,
    rich: richPost,
    gift: content.type === 'gift' ? { description: content.description } : undefined,
  }
}

/**
 * A rich message as the preview draws it (RICH-01): each block's texts written one after
 * another into the walk's text, every block naming its range; a code block and a quote also
 * get their pre and blockquote entities, a media block its file as the post's media, a button
 * row its buttons.
 */
function adaptRich(
  w: Walk,
  content: Extract<MessageContent, { type: 'rich' }>,
  design: MessageDesign,
  options: AdaptOptions,
  media: PreviewMedia[],
): PreviewRich {
  const fallback = design.languages.default
  // One text as a leaf of `kind`: its range of the walk's text.
  const leaf = (
    kind: PreviewRichBlock['kind'],
    text: RichTextRef | undefined,
    more: Partial<PreviewRichBlock> = {},
  ): PreviewRichBlock => {
    if (w.text.length > 0) w.text += '\n'
    const start = w.text.length
    const doc = text ? inLang(text.doc, w.lang, fallback) : undefined
    if (doc) walkDoc(w, doc)
    return { kind, start, end: w.text.length, ...more }
  }
  const blocks = content.blocks.map((block): PreviewRichBlock => {
    switch (block.type) {
      case 'paragraph':
      case 'footer':
        return leaf('paragraph', block.text)
      case 'heading':
        return leaf('heading', block.text, { level: Math.min(Math.max(block.size, 1), 3) })
      case 'code': {
        const made = leaf('pre', block.text)
        const language = block.language
        addEntity(w, {
          type: 'pre',
          offset: made.start,
          length: made.end - made.start,
          ...(language ? { language } : {}),
        })
        return made
      }
      case 'quote': {
        const made = leaf('quote', block.text)
        addEntity(w, {
          type: 'blockquote',
          offset: made.start,
          length: made.end - made.start,
          collapsed: block.expandable === true,
        })
        return made
      }
      case 'list': {
        const items = block.items.map((item) => {
          const own = leaf('paragraph', item.text)
          return { kind: 'item' as const, start: own.start, end: own.end, blocks: [own] }
        })
        return {
          kind: 'list',
          start: items[0]?.start ?? w.text.length,
          end: w.text.length,
          ordered: block.ordered,
          blocks: items,
        }
      }
      case 'table': {
        const rows = block.rows.map((row) => {
          const cells = row.cells.map((cell) => leaf('cell', cell.text, cell.header === true ? { header: true } : {}))
          return { kind: 'row' as const, start: cells[0]?.start ?? w.text.length, end: w.text.length, blocks: cells }
        })
        return { kind: 'table', start: rows[0]?.start ?? w.text.length, end: w.text.length, blocks: rows }
      }
      case 'details': {
        const summary = leaf('summary', block.summary)
        const body = leaf('paragraph', block.text)
        return {
          kind: 'details',
          start: summary.start,
          end: body.end,
          open: block.open === true,
          blocks: [summary, body],
        }
      }
      case 'divider':
        return { kind: 'divider', start: w.text.length, end: w.text.length }
      case 'media': {
        const kind = 'media' in block.media ? pictureKind(design.media[block.media.media]?.kind ?? '') : 'photo'
        if (kind) media.push(slotMedia(block.media, kind, design, options))
        return leaf('media', block.caption, kind ? { media: media.length, video: kind !== 'photo' } : {})
      }
      case 'buttons':
        return {
          kind: 'buttons',
          start: w.text.length,
          end: w.text.length,
          buttons: inlineKeyboard({ type: 'inline', rows: [{ type: 'buttons', ids: block.ids }] }, design, w.lang)?.[0],
        }
    }
  })
  return { text: w.text, entities: w.entities, blocks, rtl: content.rtl ?? paragraphDirection(w.text) === 'rtl' }
}

/**
 * The parts of the design the private chat reads besides a message's (PRV-02; 03 sections 2.3
 * and 2.9): the bot's description, photo, menu button and commands order, and the start points'
 * commands. A SPEC-01 `Design` fits as it is.
 */
export interface ChatDesign extends MessageDesign {
  bot: MessageDesign['bot'] & {
    description: LangText
    photo?: MediaSlot | undefined
    menuButton: 'commands' | 'default'
    commandOrder: readonly string[]
  }
  steps: Readonly<
    Record<
      string,
      { kind: string; trigger?: { type: string; command?: string; inMenu?: boolean; menuDescription?: LangText } }
    >
  >
}

/**
 * A line of the chat in order: what the bot sends, what the user types, or a service line (a date
 * such as "Today"); `reaction`, the bot's reaction emoji on the message (EVT-02).
 */
export type ChatEntry =
  | { type: 'bot'; message: BotMessage; date?: string | undefined; reaction?: string | undefined }
  | { type: 'user'; text: string; date?: string | undefined; reaction?: string | undefined }
  | { type: 'service'; text: string }

export interface ChatOptions extends AdaptOptions {
  /** What the bot is doing, in the top bar ("typing", "sending photo"). */
  action?: TgChatAction | undefined
  /** A callback answer's popup (a button's popup in the design), shown over the chat. */
  popup?: { kind: 'toast' | 'alert'; text: LangText } | undefined
  /** The text typed in the input field. */
  draft?: string | undefined
  /** The commands menu open above the input field. */
  commandsOpen?: boolean | undefined
  /**
   * The bottom keyboard and the input field's placeholder as the caller keeps them (Try it's
   * engine), in place of what the entries leave.
   */
  bottom?: { keyboard: TgReplyKeyboard | undefined; placeholder: string | undefined } | undefined
  /** An invoice's payment sheet open over the chat (Try it, PAY-02). */
  payment?: TgPaymentSheet | undefined
  /** The pinned message's text in the bar under the top bar (Try it, EVT-02). */
  pinned?: string | undefined
  /** The user blocked the bot: Restart in the input field's place (Try it, EVT-02). */
  blocked?: boolean | undefined
}

/** The command start points in Bot setup's order that show in the commands menu, each with its menu text. */
export function menuCommands(design: ChatDesign, lang: string): TgCommand[] {
  const commands: TgCommand[] = []
  for (const id of design.bot.commandOrder) {
    const trigger = design.steps[id]?.trigger
    if (trigger?.type !== 'command' || trigger.command === undefined || trigger.inMenu !== true) continue
    const description = inLang(trigger.menuDescription ?? {}, lang, design.languages.default) ?? ''
    commands.push({ command: trigger.command, description })
  }
  return commands
}

/** A bottom keyboard's rows as the chat draws them: each button's label, color and icon. */
function replyRows(rows: readonly KeyboardRowRef[], design: MessageDesign, lang: string): ReplyButton[][] {
  const fallback = design.languages.default
  return placedRows(rows, 'reply', design).map((row) => row.map((button) => replyButton(button, lang, fallback)))
}

/** A bottom keyboard button as the chat draws it: its label in the language, its color and its icon. */
export function replyButton(button: MessageButton, lang: string, fallback: string): ReplyButton {
  const out: ReplyButton = {
    text: inLang(button.label, lang, fallback) ?? '',
    style: button.look === 'default' ? 'none' : button.look,
  }
  if (button.icon) {
    out.icon = button.icon.customEmojiId
    out.icon_alt = button.icon.fallback
  }
  return out
}

/**
 * The bottom keyboard and the input field's placeholder after the entries, as Telegram keeps
 * them: a bot's reply keyboard stays until a later one replaces or removes it (an inline keyboard
 * leaves it), a one-time keyboard hides behind its button once the user has answered, and a
 * force reply's placeholder lasts until the user answers.
 */
function bottomKeyboard(
  entries: readonly ChatEntry[],
  design: MessageDesign,
  lang: string,
): { keyboard: TgReplyKeyboard | undefined; placeholder: string | undefined } {
  const fallback = design.languages.default
  let keyboard: TgReplyKeyboard | undefined
  let oneTime = false
  let keyboardPlaceholder: string | undefined
  let forcedPlaceholder: string | undefined
  for (const entry of entries) {
    if (entry.type === 'user') {
      if (keyboard && oneTime) keyboard = { ...keyboard, open: false }
      forcedPlaceholder = undefined
      continue
    }
    if (entry.type !== 'bot') continue
    const markup = entry.message.keyboard
    if (markup?.type === 'reply') {
      keyboard = {
        rows: replyRows(markup.rows, design, lang),
        resize: markup.resize,
        persistent: markup.persistent,
        open: true,
      }
      oneTime = markup.oneTime
      keyboardPlaceholder = markup.placeholder ? inLang(markup.placeholder, lang, fallback) : undefined
      forcedPlaceholder = undefined
    } else if (markup?.type === 'removeReply') {
      keyboard = undefined
      keyboardPlaceholder = undefined
    } else if (markup?.type === 'forceReply') {
      forcedPlaceholder = markup.placeholder ? inLang(markup.placeholder, lang, fallback) : undefined
    }
  }
  return { keyboard, placeholder: forcedPlaceholder ?? keyboardPlaceholder }
}

/**
 * The design's private chat as the preview's chat (PRV-02): the bot's name and photo (its letters
 * without one, or for a placeholder), the entries as rows (each bot message by adaptMessage, at
 * its own time or the chat's), the bottom keyboard and placeholder they leave, the menu button
 * when the commands menu has commands, the commands menu when open, and the popup in the
 * language. A chat without entries is the empty chat (the card with the bot's description and
 * the Start button), unless the commands menu is open (Bot setup's preview of the menu). The
 * bot's reactions go on their messages, the pinned message's text and a block pass through
 * (EVT-02).
 */
export function adaptChat(entries: readonly ChatEntry[], design: ChatDesign, options: ChatOptions): TgChat {
  const { lang } = options
  const fallback = design.languages.default
  const date = options.date ?? new Date().toISOString()
  const rows = entries.map((entry, i): TgChatRow => {
    const key = String(i)
    switch (entry.type) {
      case 'bot': {
        const post = adaptMessage(entry.message, design, { ...options, date: entry.date ?? date })
        if (entry.reaction !== undefined) post.reactions = [{ emoji: entry.reaction, count: 0 }]
        return { kind: 'bot', key, post }
      }
      case 'user':
        return { kind: 'user', key, text: entry.text, date: entry.date ?? date, reaction: entry.reaction }
      case 'service':
        return { kind: 'service', key, text: entry.text }
    }
  })
  const { keyboard, placeholder } = options.bottom ?? bottomKeyboard(entries, design, lang)
  const commands = menuCommands(design, lang)
  const photo = design.bot.photo
  const avatarUrl = photo && 'media' in photo ? options.mediaUrl?.(photo.media) : undefined
  const popup = options.popup
  const commandsOpen = options.commandsOpen === true
  return {
    bot: { title: inLang(design.bot.name, lang, fallback) ?? '', avatarUrl },
    rows,
    action: options.action,
    menu: commands.length > 0 ? design.bot.menuButton : null,
    placeholder,
    draft: options.draft,
    replyKeyboard: keyboard,
    commands: commandsOpen ? commands : undefined,
    popup: popup ? { kind: popup.kind, text: inLang(popup.text, lang, fallback) ?? '' } : undefined,
    empty:
      entries.length === 0 && !commandsOpen
        ? { description: inLang(design.bot.description, lang, fallback) ?? '' }
        : undefined,
    payment: options.payment,
    pinned: options.pinned,
    blocked: options.blocked,
  }
}
