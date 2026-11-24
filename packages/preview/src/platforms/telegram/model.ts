// The data the Telegram preview renders (docs/plan/10-frontend.md section 8.3): the
// backend's RenderedTelegram plus the channel, time and sample counters.

export type EntityType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'spoiler'
  | 'code'
  | 'pre'
  | 'text_link'
  | 'blockquote'
  | 'custom_emoji'
  | 'formatted_date'

/** A formatting range with UTF-16 offsets (03 section 4.4), as the backend renders it. */
export interface Entity {
  type: EntityType
  offset: number
  length: number
  url?: string
  language?: string
  collapsed?: boolean
  custom_emoji_id?: string
  /** The time of a formatted_date, in seconds since 1970. */
  unix_time?: number
  /** How a formatted_date is drawn (dates.ts): r, or up to one each of w, d or D, t or T. */
  date_format?: string
}

export type MediaKind = 'photo' | 'video' | 'animation' | 'document' | 'audio'

export interface PreviewMedia {
  kind: MediaKind
  /** The authenticated media URL, or a generated sample; never a remote URL. */
  url: string
  width: number
  height: number
  durationSec?: number
}

export interface PreviewWebPage {
  url: string
  siteName?: string
  title?: string
  description?: string
  photo?: { url: string; width: number; height: number }
  /** A large photo under the text; otherwise a small thumbnail on the side. */
  largePhoto?: boolean
}

export interface PreviewIssue {
  code: string
  severity: 'error' | 'warning'
  message: string
}

/**
 * What an inline button does, which decides the mark in its corner: `url` opens a link
 * (an arrow), `copy` copies a text (a copy mark), `callback` asks the bot (no mark).
 */
export type KeyboardButtonKind = 'url' | 'copy' | 'callback'

/**
 * The color of an inline button (Bot API 9.4, InlineKeyboardButton.style): `success`
 * green, `primary` blue, `danger` red; `none`, or no style, the apps' own button over the
 * wallpaper.
 */
export type KeyboardButtonStyle = 'success' | 'primary' | 'danger' | 'none'

/** A button of an inline keyboard, as the API's InlineButton writes it. */
export interface KeyboardButton {
  text: string
  kind: KeyboardButtonKind
  style?: KeyboardButtonStyle | undefined
  /** The link a `url` button opens: its tooltip. */
  url?: string | undefined
  /** The text a `copy` button copies: its tooltip. */
  copy_text?: string | undefined
  /** The ID of the premium emoji drawn before the text (the card look's button icons, 20 section 5.14.2). */
  icon?: string | undefined
  /** The normal emoji the icon stands for, drawn in its place (xDesign: the icon's fallback, PRV-01). */
  icon_alt?: string | undefined
}

/** A row of an inline keyboard, as the API's InlineKeyboardRow. */
export interface KeyboardRow {
  buttons: readonly KeyboardButton[]
}

/**
 * An inline keyboard (docs/plan/19-x-proxies-server-media.md section 7.9): rows of
 * buttons, the first row first, drawn under the message as wide as its bubble; the
 * buttons of a row share its width. The keyboards of the API (POST api/proxies/card-preview
 * and POST api/writers/render-preview, InlineKeyboardRow[]) have this shape, so they go
 * into a post as they are.
 */
export type InlineKeyboard = readonly KeyboardRow[]

/**
 * The kinds of blocks of a Telegram rich message (docs/plan/28-owner-list-2026-10-20.md
 * section 14.3, format.BlockKind): the leaves hold text (a divider none, a picture its
 * caption), the containers hold blocks; a formula, a map, a collage and a slideshow come
 * only from a rich source post (28 section 14.6).
 */
export type RichBlockKind =
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'pre'
  | 'list'
  | 'item'
  | 'table'
  | 'row'
  | 'cell'
  | 'details'
  | 'summary'
  | 'divider'
  | 'media'
  | 'math'
  | 'map'
  | 'collage'
  | 'slideshow'
  | 'buttons'

/**
 * A block of a rich message, as the API's RichBlock writes it: the range of the message's
 * text that is its own text (UTF-16 offsets, start to end), what it is besides, and a
 * container's blocks in order.
 */
export interface RichBlock {
  kind: RichBlockKind
  start: number
  end: number
  /** A heading's size, 1 to 3. */
  level?: number
  ordered?: boolean
  /** A numbered list's first number; absent or 1: it starts at 1. */
  first?: number
  /** A table's header cell. */
  header?: boolean
  /** A collapsible part shown open. */
  open?: boolean
  /** A source's pull quote. */
  pull?: boolean
  /** A picture or video: its position in the post's media, from 1. */
  media?: number
  video?: boolean
  map?: { lat: number; long: number; zoom: number; width: number; height: number }
  /** A row of buttons inside the message (xDesign, RICH-01: InputRichBlockButtons). */
  buttons?: KeyboardRow | undefined
  blocks?: RichBlock[]
}

/**
 * A post as a Telegram rich message (28 section 14.5, RCH-04b): its text laid out as a
 * normal message (the text between the blocks' ranges, the empty lines, "• ", "1. " and
 * " | ", is the normal message's only), the formatting of that text, its blocks, and
 * whether it is shown right to left.
 */
export interface PreviewRich {
  text: string
  entities: Entity[]
  blocks: RichBlock[]
  rtl: boolean
}

export interface TgPreviewPost {
  text: string
  entities: Entity[]
  /** The text is a media caption. */
  asCaption: boolean
  media: PreviewMedia[]
  linkPreview: PreviewWebPage | null
  /** The link preview above the text (publish.link_preview = above). */
  invertMedia: boolean
  /** color: Telegram's peer color index (0 to 6), when known. */
  channel: { title: string; username?: string; avatarUrl?: string; subscribers?: number; color?: number }
  signature?: string
  views: number
  /** ISO time, shown in the writer's time zone. */
  date: string
  timeZone?: string
  reactions: { emoji: string; count: number }[] | null
  comments: { count: number } | null
  length: number
  limit: number
  issues: PreviewIssue[]
  language: string
  rtl: boolean
  /** The inline keyboard under the message (a bot's buttons, the API's keyboard as it is); absent or empty: none. */
  keyboard?: InlineKeyboard | undefined
  /**
   * The post as a Telegram rich message (28 section 14.5): drawn instead of the text, with
   * the media inside it (those its pictures between paragraphs do not place come first);
   * text and entities stay its normal form. Absent for every other post.
   */
  rich?: PreviewRich | undefined
  /**
   * A bot's message in a private chat (xDesign, PRV-01): drawn without the chat's top bar,
   * the channel's name in the bubble (Desktop) and the share button, which only a channel's
   * post has here.
   */
  bot?: boolean | undefined
  /** A poll or quiz (xDesign, MSG-03): drawn in place of the text, its question as the text. */
  poll?: TgPoll | undefined
  /** A dice (MSG-03): its emoji is the text, drawn as the animated emoji's still frame without a bubble. */
  dice?: boolean | undefined
  /** Paid media (MSG-03): its price in Stars, and locked (blurred under the price button) until bought. */
  paid?: { stars: number; locked: boolean } | undefined
  /** An invoice (sendInvoice, PAY-02): its card in place of the text, its photo the post's media. */
  invoice?: TgInvoice | undefined
  /**
   * A gift the bot sent (sendGift, EVT-02): a card in the middle of the chat with the gift, which
   * gift in the design's words in its picture's place, and its text (the post's text).
   */
  gift?: { description: string } | undefined
}

/**
 * An invoice as the user sees it (PAY-02): the title, the description, then the photo with the
 * price over it, or the price on its own line; `price` as Telegram writes the total ("⭐️50",
 * "4.50 USD").
 */
export interface TgInvoice {
  title: string
  description: string
  price: string
}

/**
 * The payment sheet of an invoice (Try it's mock, PAY-02): the invoice's title, description and
 * photo, its price lines and total, what it asks for, the shipping options with their prices
 * (flexible shipping), and whether it is paid in Stars or a subscription; all texts in the
 * tester's language and the prices as Telegram writes them.
 */
export interface TgPaymentSheet {
  stars: boolean
  title: string
  description: string
  photoUrl?: string | undefined
  lines: readonly { label: string; price: string }[]
  total: string
  /** A subscription: how often the user pays ("every 30 days"). */
  every?: string | undefined
  asks: readonly string[]
  /** Each option's price, and the total with it. */
  shipping?: readonly { id: string; title: string; price: string; total: string }[] | undefined
}

/**
 * A poll or quiz as the user sees it (sendPoll, MSG-03): the question is the post's text (only its
 * custom emoji kept), each option a plain text; anonymous, several answers allowed; `right`, a
 * quiz's right options shown with their marks (the editor's phone, or once answered); `vote`, the
 * options the user voted for (then the results show).
 */
export interface TgPoll {
  quiz: boolean
  anonymous: boolean
  multiple: boolean
  options: readonly string[]
  right?: readonly number[] | undefined
  vote?: readonly number[] | undefined
}

/**
 * What the bot is doing, shown in the private chat's top bar (sendChatAction, PRV-02): typing, or
 * sending a photo, a video, a voice message, a file, a location, a round video, or a sticker.
 */
export type TgChatAction = 'typing' | 'photo' | 'video' | 'voice' | 'file' | 'location' | 'videoNote' | 'sticker'

/**
 * A line of the private chat (PRV-02): a bot's message (a post with `bot` set), the user's text
 * in an outgoing bubble with its time and checkmarks (and the bot's reaction on it, EVT-02), or a
 * service line such as a date.
 */
export type TgChatRow =
  | { kind: 'bot'; key: string; post: TgPreviewPost }
  | {
      kind: 'user'
      key: string
      text: string
      date: string
      timeZone?: string | undefined
      reaction?: string | undefined
    }
  | { kind: 'service'; key: string; text: string }

/** A button of the bottom keyboard (KeyboardButton): its label, its color (Bot API 9.4) and its premium emoji with the emoji it stands for. */
export interface ReplyButton {
  text: string
  style?: KeyboardButtonStyle | undefined
  icon?: string | undefined
  icon_alt?: string | undefined
}

/**
 * The bottom keyboard (ReplyKeyboardMarkup): its rows; resize, as small as its buttons (else the
 * system keyboard's height); persistent, shown whenever the system keyboard is not (else the user
 * hides it with its button); open, shown now (false: hidden behind its button, as after a one-time
 * keyboard was used).
 */
export interface TgReplyKeyboard {
  rows: readonly (readonly ReplyButton[])[]
  resize: boolean
  persistent: boolean
  open: boolean
}

/** A callback answer (answerCallbackQuery): a toast over the chat, or an alert with its button. */
export interface TgPopup {
  kind: 'toast' | 'alert'
  text: string
}

/** A command of the commands menu: the command without its slash, and its description. */
export interface TgCommand {
  command: string
  description: string
}

/**
 * A private chat with a bot as the preview renders it (PRV-02): the bot's name and picture in the
 * top bar, its status while it is doing something, the rows, the input field (the menu button,
 * the placeholder, a draft), the bottom keyboard, the commands menu when open, a callback
 * answer's popup; or, with `empty`, the empty chat: the card with the bot's description and the
 * Start button in the input field's place.
 */
export interface TgChat {
  bot: { title: string; avatarUrl?: string | undefined }
  rows: readonly TgChatRow[]
  action?: TgChatAction | undefined
  /** The menu button: "Menu" for the commands menu button, the commands icon for Telegram's default; null: none (no commands). */
  menu: 'commands' | 'default' | null
  /** The input field's placeholder (the keyboard's input_field_placeholder); the look's own without one. */
  placeholder?: string | undefined
  /** The text typed in the input field: send shows in place of the microphone. */
  draft?: string | undefined
  replyKeyboard?: TgReplyKeyboard | undefined
  /** The commands menu, open above the input field. */
  commands?: readonly TgCommand[] | undefined
  popup?: TgPopup | undefined
  empty?: { description: string } | undefined
  /** An invoice's payment sheet, open over the chat (PAY-02). */
  payment?: TgPaymentSheet | undefined
  /** The pinned message's text in the bar under the top bar (EVT-02). */
  pinned?: string | undefined
  /** The user blocked the bot: Restart in the input field's place (EVT-02). */
  blocked?: boolean | undefined
}
