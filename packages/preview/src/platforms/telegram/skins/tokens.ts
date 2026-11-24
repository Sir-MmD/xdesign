// The tokens of a Telegram look (docs/plan/10-frontend.md section 8.10): geometry,
// typography, colors, icons and the hooks where an app draws a part its own way. PreviewFrame
// writes them as CSS custom properties; preview.css reads only those, so a look is one tokens
// file, plus its own stylesheet skins/<look>.css (scoped by [data-skin="<look>"]) for what the
// shared rules cannot draw (docs/plan/29-owner-list-2026-10-22.md section 8.6, TGP-02).
import type { PreviewTheme } from '../../../core/types'
import type { AlbumLayoutFn } from '../albumLayout'
import type { RtlInfoRow } from '../bidi'
import type { PreviewMedia } from '../model'
import type { PeerColor, PeerPalette } from '../peerColors'

/** The looks (29 section 8.5): Web A is `web`, the value the panel has always stored (D-6271), Web K `webk`. */
export type SkinId = 'web' | 'webk' | 'desktop' | 'android' | 'ios'

export interface SkinColors {
  /** The incoming bubble. */
  bubble: string
  /** The message's text. */
  text: string
  /** Links, mentions and hashtags. */
  link: string
  /** The info row's text: the time and the signature. */
  meta: string
  /** The view counter's eye and count in the info row (Android draws them apart from the time). */
  views: string
  /** The look's accent: the channel's name in the bubble, reactions and the comments bar, unless they take the channel's color (SkinTokens.peer). */
  accent: string
  /** Inline code's text and fill. */
  codeText: string
  codeBg: string
  /** A code block: its fill, its text, the bar at its start, the band of its header, the language (or the label of a block without one) and the copy mark. */
  preBg: string
  preText: string
  preBar: string
  preHeaderBg: string
  preLabel: string
  preIcon: string
  /** A quote's fill, and its bar and mark, unless the look takes the channel's color (SkinTokens.peer.quote). */
  quoteBg: string
  quoteBar: string
  /** The link preview's fill, and its bar and site name, unless the look takes the channel's color (SkinTokens.peer.linkPreview). */
  webpageBg: string
  webpageAccent: string
  /** The dots over a hidden spoiler. */
  spoilerDots: string
  /** The top bar's fill, the channel's name and the line under it. */
  header: string
  headerText: string
  headerSubtext: string
  /** A line under the top bar (Desktop); transparent for none. */
  headerBorder: string
  /** The top bar's shadow, a CSS box-shadow (the floating bars of Web A and Web K); none for none. */
  headerShadow: string
  /** The back arrow and the menu's dots of the top bar. */
  headerIcon: string
  /** The round pieces of the top bar that hold the back and menu buttons (Android's and iOS's glass). */
  headerButton: string
  /** The fade under a top bar that the chat runs under (SkinTokens.header.fade), at its top. */
  headerFade: string
  /** The round share button beside channel posts. */
  share: string
  shareIcon: string
  /** The bubble's outline (iOS draws a hairline instead of a shadow). */
  outline: string
  /** The bubble's shadow, and the tail's (Web A draws the tail's in a color of its own). */
  shadow: string
  tailShadow: string
  /** The info row over media without a caption: its pill, its text and its eye. */
  mediaMetaBg: string
  mediaMetaText: string
  mediaMetaIcon: string
  /** The info row's pill under big emoji (SkinTokens.bigEmoji). */
  bigEmojiMetaBg: string
  /** A layer over the blurred copy behind a picture narrower than its box (Desktop and Web K darken it); transparent for none. */
  mediaShade: string
  /** A video's duration pill and its text. */
  durationBg: string
  durationText: string
  /** The round play button over a video, and its triangle. */
  playBg: string
  playIcon: string
  /** A reaction under the text: its pill and its count; and under media without a caption, over the wallpaper. */
  reactionBg: string
  reactionText: string
  reactionOutsideBg: string
  reactionOutsideText: string
  /** The comments bar: its text, its icons and the line above it. */
  commentsText: string
  commentsIcon: string
  commentsBorder: string
  /** An inline button without a style over the wallpaper, and its text. */
  button: string
  buttonText: string
  /** The inline buttons with a style (Bot API 9.4): success, primary and danger; their text is white. */
  buttonSuccess: string
  buttonPrimary: string
  buttonDanger: string
  /**
   * The private chat (ChatTokens, PRV-02; calibrate: O-02): the user's outgoing bubble, its text,
   * links, info row, checkmarks, outline and shadow; a service line's pill (a date) and its text;
   * the top bar's status while the bot is typing.
   */
  outBubble: string
  outText: string
  outLink: string
  outMeta: string
  outCheck: string
  outOutline: string
  outShadow: string
  serviceBg: string
  serviceText: string
  typing: string
  /** The input field (calibrate: O-02): its bar or pill, its text, placeholder and icons, the line above a bar (Desktop), the send arrow; the menu button's fill and label. */
  composer: string
  composerText: string
  composerPlaceholder: string
  composerIcon: string
  composerBorder: string
  send: string
  menuButton: string
  menuButtonText: string
  /** The bottom keyboard (calibrate: O-02): its panel, its buttons, their text and shadow (a CSS box-shadow; none for none). */
  replyPanel: string
  replyButton: string
  replyButtonText: string
  replyButtonShadow: string
  /** A callback answer (calibrate: O-02): the toast and its text; the alert, its text and button, and the shade over the chat under it. */
  toast: string
  toastText: string
  alert: string
  alertText: string
  alertButton: string
  scrim: string
  /** The empty chat (calibrate: O-02): the card and its text; the Start button's fill (when filled) and its label. */
  empty: string
  emptyText: string
  start: string
  startText: string
  /** The commands menu (calibrate: O-02): its panel, the first text of a row and the second. */
  commands: string
  commandsText: string
  commandsSubtext: string
}

/** A part of the input field (ChatTokens.composer.parts): the menu button, the emoji, attach, the field, the bottom keyboard's button, and send. */
export type ComposerPart = 'menu' | 'emoji' | 'attach' | 'field' | 'keyboard' | 'send'

/**
 * The private chat around a bot's messages (PRV-02, 04 sections 4.4, 7 and 8): the screen, the
 * user's outgoing bubbles, service lines, the top bar's status, the input field with the menu
 * button, the bottom keyboard, a callback answer's toast and alert, the empty chat and the
 * commands menu. xWriter has no private chat, so every value is read from the Telegram apps and
 * waits for the owner's screenshots (calibrate: O-02); chat.css draws the parts.
 */
export interface ChatTokens {
  /** The screen's height when the pane gives none. */
  height: number
  /** The space between two messages. */
  gap: number
  /** The outgoing bubble: the space at its left and at its right (its tail sits in it), and the checkmarks' box. */
  out: { marginLeft: number; marginRight: number; checkWidth: number; checkHeight: number }
  /** A service line (a date): its pill's height, side padding, radius, text size and weight, and the space above and under it. */
  service: { height: number; padX: number; radius: number; fontSize: number; fontWeight: number; margin: number }
  /** The top bar's status: a bot's label ("bot"), and the dots of "typing" drawn before or after it, or written as "..." ('text'). */
  status: { bot: string; dots: 'before' | 'after' | 'text' }
  /**
   * The input field: its height; a pill floating `side` and `bottom` from the screen's edges, the
   * chat running under it (null: a bar across the bottom); its radius, side padding, text size,
   * icons and the space between its parts; the parts in the app's order; a round send button this
   * big beside the pill (Web A, Web K; null: send is a part); and its placeholder.
   */
  composer: {
    height: number
    float: { side: number; bottom: number } | null
    radius: number
    padX: number
    fontSize: number
    iconSize: number
    gap: number
    parts: readonly ComposerPart[]
    send: number | null
    placeholder: string
  }
  /** The menu button ("Menu", the design's commands menu button): its height, side padding, radius, text size and weight, and its label. */
  menuButton: { height: number; padX: number; radius: number; fontSize: number; fontWeight: number; label: string }
  /**
   * The bottom keyboard: over, a panel over the chat above the input field (Web A, Web K), else in
   * the system keyboard's place under it; the panel's height when not resized, its padding, the
   * space between buttons, a button's height when resized, its radius, text size and weight.
   */
  replyKeyboard: {
    over: boolean
    height: number
    padding: number
    gap: number
    buttonHeight: number
    radius: number
    fontSize: number
    fontWeight: number
  }
  /** A callback answer's toast: at the chat's top, middle or bottom, `offset` from there; its radius, padding, text size and widest. */
  toast: {
    place: 'top' | 'middle' | 'bottom'
    offset: number
    radius: number
    padding: string
    fontSize: number
    maxWidth: number
  }
  /** A callback answer's alert: its width, radius, padding and text size; the bot's name over the text (title) in titleSize; its button's label, size and place. */
  alert: {
    width: number
    radius: number
    padding: string
    fontSize: number
    title: boolean
    titleSize: number
    button: string
    buttonSize: number
    buttonAlign: 'end' | 'center'
  }
  /** The empty chat's card: its width, radius and padding, its title ("What can this bot do?") and its size, the text's size and the space under the title. */
  empty: {
    width: number
    radius: number
    padding: string
    title: string
    titleSize: number
    fontSize: number
    gap: number
  }
  /** The Start button in the input field's place: its height, label, size, weight and capitals; filled: a button in its own fill (else its label on the bar); its radius. */
  start: {
    height: number
    label: string
    fontSize: number
    fontWeight: number
    uppercase: boolean
    filled: boolean
    radius: number
  }
  /** The commands menu above the input field: a row's height, the bot's picture in it (0: none), the two texts' sizes, the side padding, the panel's radius, the rows shown before it scrolls, and the command first (else its description). */
  commands: {
    rowHeight: number
    avatar: number
    fontSize: number
    subSize: number
    padX: number
    radius: number
    rows: number
    commandFirst: boolean
  }
}

/** A poll's or quiz's words as a look writes them ("Anonymous Poll", "No votes", "1 vote", "Vote"). */
export interface PollLabels {
  anonymous: string
  public: string
  anonymousQuiz: string
  quiz: string
  noVotes: string
  noAnswers: string
  votes: (count: number) => string
  answers: (count: number) => string
  vote: string
  results: string
}

/**
 * A poll or quiz in the bubble (MSG-03, sendPoll): xWriter draws none, so every value is read from
 * the Telegram apps and waits for the owner's screenshots (calibrate: O-02). The question's size
 * and weight; the type line ("Anonymous Poll") in typeSize with typeGap under it; an option's text
 * size, least height and the space between options; the round mark's size and the space after it
 * (where the percentage stands once voted); the result bar's thickness; the footer's height and
 * size; a quiz's right and wrong colors; and the look's words. poll.css draws the parts.
 */
export interface PollTokens {
  questionSize: number
  questionWeight: number
  typeSize: number
  typeGap: number
  optionSize: number
  optionHeight: number
  optionGap: number
  mark: number
  markGap: number
  bar: number
  footerHeight: number
  footerSize: number
  right: string
  wrong: string
  labels: PollLabels
}

/**
 * Paid media (MSG-03, sendPaidMedia; calibrate: O-02): the blur over its pictures until it is
 * bought, and the price button over them (in the look's pill colors over media): its height, side
 * padding, radius, text size and weight, and its words ("Unlock for ⭐ 50").
 */
export interface PaidTokens {
  blur: number
  height: number
  padX: number
  radius: number
  fontSize: number
  fontWeight: number
  label: (stars: number) => string
}

/**
 * An invoice's card and its payment sheet in Try it (PAY-02): the title's size and weight, the
 * price's size and the word after it ("INVOICE", '' for none), and the sheet's corner radius and
 * words.
 */
export interface InvoiceTokens {
  titleSize: number
  titleWeight: number
  priceSize: number
  label: string
  sheet: { radius: number; title: string; starsTitle: string; total: string; shipping: string }
}

/**
 * The events of stage 2 in the private chat (EVT-02): xWriter draws none, so every value is read
 * from the Telegram apps and waits for the owner's screenshots (calibrate: O-02). The pinned
 * message bar under the top bar: its height, the space between the two (a floating bar's gap),
 * its radius and side padding, the accent line's width, its title ("Pinned Message") and the two
 * text sizes. A gift's card in the middle of the chat: its width, radius and padding, the gift's
 * picture, the title's size and words ("Gift from <bot>"), the text's size and the button's label.
 * The button in the input field's place once the user blocked the bot ("Restart"), drawn as Start.
 */
export interface EventTokens {
  pinned: {
    height: number
    gap: number
    radius: number
    padX: number
    line: number
    title: string
    titleSize: number
    fontSize: number
  }
  gift: {
    width: number
    radius: number
    padding: string
    picture: number
    titleSize: number
    title: (bot: string) => string
    fontSize: number
    button: string
  }
  restart: string
}

/**
 * The icons of a look (29 section 8.4): each a CSS image, normally the look's own Telegram art
 * that art/icons.ts hands the chat and the rich card as a custom property (for example
 * `'var(--tg-art-views)'`), drawn as a mask in its part's color with the look's mask mode
 * (`--tg-art-mask-mode`); null draws xWriter's own icon. The art the markup has no place for
 * (a code block's menu or mark, a mini app's mark) is drawn by the look's stylesheet.
 */
export interface SkinIcons {
  /** The eye of the view counter. */
  views: string | null
  /** The arrow of the round share button. */
  share: string | null
  /** The comments bar's icon before its text and the arrow at its end. */
  comments: string | null
  commentsArrow: string | null
  /** The marks of a link button and a copy button. */
  link: string | null
  copy: string | null
  /** A quote's mark and the arrow of an expandable quote. */
  quote: string | null
  quoteExpand: string | null
  /** The copy mark in a code block's header. */
  codeCopy: string | null
  /** The triangle of the play button over a video. */
  play: string | null
  /** The top bar's back arrow and menu. */
  back: string | null
  menu: string | null
}

/** The box of a single photo or video, and the picture in it: centered, over a blurred copy of itself when `blur`. */
export interface MediaBox {
  width: number
  height: number
  imageWidth: number
  imageHeight: number
  blur: boolean
}

/**
 * Sizes a single photo or video (29 section 8.6): the look's tokens, the widest bubble, the
 * chat area's width, the caption (empty without one), whether the comments bar shows, and the
 * info row's view count and time (with the signature, "Jane, 3:05 PM") as the look writes them
 * (Android's photo is at least as wide as its info row, TGP-02).
 */
export type MediaBoxFn = (
  media: PreviewMedia,
  context: {
    skin: SkinTokens
    bubbleMax: number
    frameWidth: number
    caption: string
    comments: boolean
    info: { views: string | undefined; time: string }
  },
) => MediaBox

/** A text of emoji only (entities.ts emojiOnly): its emoji, its lines and the most emoji on one line. */
export interface EmojiCount {
  count: number
  lines: number
  perLine: number
}

/** What a text of emoji only may hold besides its emoji (SkinTokens.bigEmoji.rule). */
export type EmojiRule = 'loose' | 'spaces' | 'lines' | 'strict'

export interface SkinTokens {
  id: SkinId
  /** The look's name in the pickers: Web A, Web K, Desktop, Android, iOS (29 section 8.5). */
  label: string
  /** Width of the simulated chat area when the pane gives none. */
  frameWidth: number
  /** The space above the post (under a top bar the chat does not run under) and under it. */
  list: { top: number; bottom: number }
  /** The widest bubble for a chat area of this width. */
  bubbleMaxWidth: (frameWidth: number) => number
  bubbleMinWidth: number
  /** The lowest bubble (iOS: 33, a one-line bubble). */
  bubbleMinHeight: number
  /** Space between the chat area's left edge and the bubble (the tail sits in it). */
  bubbleMarginLeft: number
  /** Space between the bubble (or the share button beside it) and the chat area's right edge. */
  bubbleMarginRight: number
  /** The bubble's shadow under it: its offset down, its blur and its spread; its color is SkinColors.shadow. */
  bubbleShadow: { y: number; blur: number; spread: number }
  /** The width of the bubble's outline, in SkinColors.outline. */
  outlineWidth: number
  fontFamily: string
  fontSize: number
  lineHeight: number
  boldWeight: number
  /** URL and text links underlined (Web K); mentions and hashtags never are. */
  links: { underline: boolean }
  /**
   * The text takes the message's own direction, from its first strong letter (Web K: a quote, as
   * wide as its text, then sits on the right in a message that starts right to left; TGP-02,
   * TGP-02d); false: the chat's left to right, where Web A mirrors its own parts (meta.rtl) and
   * Desktop, Android and iOS keep their quotes on the left.
   */
  messageDir: boolean
  /**
   * Emoji in the text: the image's size and a premium emoji's, as a share of the font size;
   * the space after each; and their vertical alignment (a CSS vertical-align value).
   */
  emoji: { scale: number; customScale: number; gap: number; align: string }
  /**
   * A message of emoji only, drawn big without a bubble (29 section 8.4): the emoji's size for
   * the text's emoji, or null when this message keeps its bubble; null: never big. rule: what the
   * text may hold besides its emoji (entities.ts emojiOnly, TGP-02): 'loose', white space anywhere
   * and empty lines not counted (Web K strips white space, bubbles.ts:8984); 'spaces', only
   * spaces, tabs, line breaks and U+FE0F, empty lines not counted (Android, Emoji.java:474-476;
   * RVW-29c); 'lines', only line breaks, and empty lines count
   * (Web A, parseEmojiOnlyString.ts:7-54); 'strict', nothing else at all (Desktop's isolated
   * emoji, stickers_emoji_pack.cpp:56-60; iOS containsOnlyEmoji, EmojiUtils.swift:103-105 and
   * ChatMessageItemCommon.swift:242-251). single: the info row's pill under a single emoji, the
   * app's sticker, its radius and side padding (Android 12 and 6, ChatMessageCell.java:24021-24048);
   * null: the pill under any big emoji.
   */
  bigEmoji: {
    size: (emoji: EmojiCount) => number | null
    rule: EmojiRule
    single: { radius: number; padX: number } | null
  } | null
  /**
   * The channel's name at the top of the bubble (Desktop; its color is the accent, or the
   * channel's with SkinTokens.peer.title): its size, weight and line height, and the space under
   * it before the text and before media.
   */
  title: { show: boolean; size: number; weight: number; lineHeight: number; gap: number; mediaGap: number }
  metaFontSize: number
  /** The info row, at the bubble's bottom-right corner (Web A MessageMeta.scss): its
   * distance from the corner, height and side padding; the text keeps room for it at the
   * right end of its last line. viewsFirst puts the count before the eye (Web A); rtl
   * says when right-to-left text gives it a line of its own (bidi.ts). */
  meta: {
    right: number
    bottom: number
    height: number
    padding: number
    iconSize: number
    /** The space after the view counter (the eye, or the count after it). */
    iconGap: number
    /** The space between the count and the eye. */
    countGap: number
    timeGap: number
    viewsFirst: boolean
    rtl: RtlInfoRow
    /**
     * How the parts are written: apart (Web A); the signature joined to the time, "Jane, 3:05 PM"
     * (Web K, Desktop, Android); or one text after the eye, "1.2K Jane, 3:05 PM" (iOS).
     */
    form: 'parts' | 'joined' | 'string'
    /** The view count as the app writes it ("1.2K"; Desktop "1234", then "12.3K"). */
    views: (count: number) => string
    /** The hour as the app writes it (TGP-02): 'numeric' ("3:07 PM"), '2-digit' (Web K "03:07 PM", formatTimeOptions in tweb's date.ts). */
    hour: 'numeric' | '2-digit'
    /** The space the text keeps before the info row on its last line. */
    reserve: number
    /** The height an info row that moves under the text adds (Web K 12, Desktop 13); null: one line. */
    dropHeight: number | null
    /** The pill over media without a caption and under big emoji: its distance from the right and bottom edges, height, padding at its start and end, and radius. */
    overlay: { right: number; bottom: number; height: number; padStart: number; padEnd: number; radius: number }
  }
  /** The text's padding in the bubble; footer is the bottom padding when reactions or the comments bar follow (iOS). */
  padding: { top: number; right: number; bottom: number; left: number; footer: number }
  /** The top and bottom padding of text under media (a caption), measured from the
   * owner's screenshots where they differ from text-only bubbles; footer is its bottom padding
   * when reactions or the comments bar follow (RVW-29c). */
  caption: { top: number; bottom: number; footer: number }
  /** The bubble's corners: its radius, the small radius beside a neighbor, and the bottom corners above inline buttons. */
  radius: { main: number; small: number; aboveKeyboard: number }
  /**
   * The tail at the bubble's bottom-left (29 section 8.6): its path in its viewBox, drawn in a
   * box `width` x `height` placed `left` and `bottom` from the bubble's bottom-left corner;
   * squareCorner: that corner is square (iOS draws its tail over a round corner); aboveKeyboard:
   * it stays above inline buttons (Web K); underMedia: it stays on a bubble that ends with media
   * without a caption; shadow: its shadow's offset and blur, in SkinColors.tailShadow.
   */
  tail: {
    path: string
    viewBox: string
    width: number
    height: number
    left: number
    bottom: number
    squareCorner: boolean
    aboveKeyboard: boolean
    underMedia: boolean
    shadow: { y: number; blur: number }
  } | null
  quote: {
    collapsedLines: number
    barWidth: number
    radius: number
    padStart: number
    padEnd: number
    /** The space above and below a quote. */
    padBlock: number
    /** The padding above the first line and under the last, inside the quote's fill (Web K 1). */
    padY: number
    fontSizeDelta: number
    /** The quote's line height in pixels; null: the text's. */
    lineHeight: number | null
    /** The fade at the bottom of a folded quote, in pixels; null: its last 45 %; 0: none. */
    fade: number | null
    /** The quote's mark: its box and its distance from the top and the end. */
    icon: { width: number; height: number; top: number; end: number }
    /** The arrow of an expandable quote: its box and its distance from the end and the bottom. */
    expand: { width: number; height: number; end: number; bottom: number }
    /**
     * An expandable quote folds, and shows its arrow, only when its text is longer than its folded
     * lines (29 section 8.4, TGP-02): Web A over four lines (Blockquote.tsx:57,
     * useCollapsibleLines.ts:80), Web K when the text is cut (_quote.scss:73-122), Desktop over
     * three (text_renderer.cpp:410-447), Android over its folded 67.2 (ChatMessageCell.java:16990)
     * and iOS over three (InteractiveTextComponent.swift:2045); false: every expandable quote folds.
     */
    foldLong: boolean
    /**
     * The quote's direction, which puts its bar at its start and its mark and arrow at its end:
     * 'message', the message's (Web A: the text's dir="auto", Post.tsx's mirrored rule, and a rich
     * message's dir); 'own', its own first strong letter (Web K: dir="auto" on each quote,
     * wrapRichText.ts:883-905); 'ltr', the bar on the left and the mark on the right whatever the
     * text (Desktop text.cpp:351; Android ReplyMessageLine.java:542-555 and
     * ChatMessageCell.java:16966-16979; iOS InteractiveTextComponent.swift:3219-3228).
     */
    direction: 'message' | 'own' | 'ltr'
    /** A quote wider than this share of the text's column takes the whole column (Android 0.7, ChatMessageCell.java:16943); null: as wide as the look draws it. */
    wideAt: number | null
    /**
     * A quote that opens the text: the space above it and above its first line inside it (Android
     * 4.66 and 5.34: its box 1.66 lower, ChatMessageCell.java:16950, its text 2 lower,
     * MessageObject.java:8894-8899); null: padBlock and padY.
     */
    first: { margin: number; padY: number } | null
  }
  /**
   * Code (inline code in `fontSize`, a block in `blockFontSize`); a block's line height (a share
   * of its size), the space above and below it, the bar at its start; its header (font size,
   * weight, padding, in the code's font with `mono`, a band `height` tall or as tall as its text);
   * the header's text without a language (Web K and Desktop: "copy"; null: no header); the copy
   * mark at the header's end; and the widest bubble when the text has a code block (Desktop lets
   * one widen it), null for bubbleMaxWidth.
   */
  code: {
    fontFamily: string
    fontSize: number
    blockFontSize: number
    lineHeight: number
    radius: number
    inlinePadding: string
    blockPadding: string
    blockMargin: number
    barWidth: number
    header: { fontSize: number; fontWeight: number; padding: string; mono: boolean; height: number | null }
    noLanguage: string | null
    copyMark: boolean
    wideBubble: ((frameWidth: number) => number) | null
    /**
     * The header's text for a block's language as the app writes it (29 section 8.4, TGP-02;
     * codeLanguages.ts): Web A its name ("js" as "JavaScript"), Web K Prism's name or null for one
     * it does not know, Desktop the word as it is, Android its own names or only the first letter
     * capital, iOS each word capitalized ("json" as "Json"); null: the header of a block without one.
     */
    language: (language: string) => string | null
    /**
     * A block's sizes by its code's length in characters (Android: the code 14, 13 above 80 and 11
     * above 220, MessageObject.java:8908-8916 with Theme.java:8049-8051; the language 14, 13 above
     * 120, in a band 1.714 times as tall and 4, MessageObject.java:1080-1085); null: blockFontSize,
     * header.fontSize and header.height for every block.
     */
    sizes: ((length: number) => { fontSize: number; headerSize: number; headerHeight: number | null }) | null
    /**
     * The bar under a block of minLength characters or more that copies it, `height` tall: the
     * look's copy icon (SkinIcons.codeCopy) iconSize wide and the label in fontSize and fontWeight,
     * gap apart and centred, in the language's color (Android's "COPY CODE" under 75 characters or
     * more, MessageObject.java:1066-1125); null: none.
     */
    copyBar: {
      minLength: number
      height: number
      label: string
      fontSize: number
      fontWeight: number
      iconSize: number
      gap: number
    } | null
    /**
     * A block that opens the text: the space above it, and its top-right corner when it opens the
     * bubble too (Android 0 and 17 / 3 x 2: ChatMessageCell.java:16657-16658 with
     * MessageObject.java:8903, and ChatMessageCell.java:17035); null: blockMargin and radius.
     */
    first: { margin: number; radius: number } | null
  }
  /**
   * A rich message's blocks (28 section 14.5, 29 section 8.4, TGP-02): the space under each block
   * and under a paragraph (Web A 12 and 2, RichContent.module.scss:19-48); a numbered list's
   * markers drawn as "1." in a box `width` wide, aligned to its end, `gap` before the item (Web A
   * 20 and 4, RichContent.module.scss:204-223); and a table's outer corners (Web A 16 on its
   * corner cells, RichContent.module.scss:318-361). null and 0: the shared 8 between blocks (14
   * above a heading, or the look's own in its stylesheet: Web K), the browser's markers and square
   * corners.
   */
  rich: {
    gap: { block: number; paragraph: number } | null
    marker: { width: number; gap: number } | null
    tableRadius: number
  }
  /** The dots over a hidden spoiler: their radius, the square grid they sit on and the hidden text's corners. */
  spoiler: { dot: number; cell: number; radius: number }
  /** Single media: the largest box, and whether a box wider than the picture is filled
   * with a blurred copy (Web A) instead of shrinking to the picture. */
  media: {
    /** The widest and tallest single media for a chat area of frameWidth pixels. */
    maxWidth: (frameWidth: number) => number
    maxHeight: (frameWidth: number) => number
    minWidth: number
    /** The lowest single media (Android 120, iOS 74). */
    minHeight: number
    radius: number
    /** The bottom corners of media a caption follows. */
    captionRadius: number
    inset: number
    blurFill: boolean
    /**
     * The tail under a photo without a caption, comments or reactions takes the picture's
     * bottom-left color, read once it has loaded (Web A: Photo.tsx:215-235, getCustomAppendixBg.ts,
     * offscreen-canvas.worker.ts:26-38; TGP-02); false: the bubble's color (Web K, Desktop,
     * Android, iOS).
     */
    sampleTail: boolean
    /** The box of a single photo or video: mediaBox (layout.ts) from the values above, or the app's own rules. */
    box: MediaBoxFn
  }
  /**
   * A video's duration pill at the media's top-left corner: its distance from the top and the
   * left, height, side padding, radius and font size; null: none. pad (time.ts formatDuration,
   * TGP-02): 'hours' writes the hours in two digits (Web A "01:02:03", duration.ts:99-111),
   * 'minutes' the minutes always in two (Desktop "00:07", format_values.cpp:137-140), null neither
   * ("0:07", "1:02:03": Web K, Android, iOS). gif: the pill's text on an animation (Web A
   * Video.tsx:337, Web K video.ts:155-157, Android ChatMessageCell.java:12838-12844, iOS
   * ChatMessageInteractiveMediaNode.swift:2701); null: none (Desktop shows it only under the
   * mouse, history_view_gif.cpp:2712-2729).
   */
  duration: {
    top: number
    left: number
    height: number
    padX: number
    radius: number
    fontSize: number
    pad: 'hours' | 'minutes' | null
    gif: string | null
  } | null
  /** The round play button over a video: its size and the triangle's height. */
  play: { size: number; iconSize: number }
  /**
   * Grouped media: the space between items; the album's inset in the bubble at each side, which
   * the bubble's width counts as it counts a single media's (iOS 1; 0 where the album fills the
   * bubble, Web A, Web K and Desktop, or its layout holds the inset, Android's 2; TGP-02); and the
   * app's layout (albumLayout.ts and albumLayout.<look>.ts).
   */
  album: { gap: number; inset: number; layout: AlbumLayoutFn }
  /**
   * The round share button beside channel posts: its size, the space before it, its bottom above
   * the bubble's bottom, its arrow's size; hover: shown only while the mouse is over the post, on
   * devices with a mouse (Web A, Web K).
   */
  shareButton: { size: number; gap: number; bottom: number; iconSize: number; hover: boolean } | null
  /**
   * The reactions under the text (the toolbar's option): a pill's height (null: its content's),
   * radius and padding at its start and end; the emoji's size (null: the text's emoji) and the
   * space after it; the count's size and weight; the space between pills, between rows and above
   * the first row; outside: under media without a caption they sit under the bubble, over the
   * wallpaper and under the buttons, and the share button stays level with the bubble (Web A
   * Message.tsx:979-990, Web K, Desktop history_view_message.cpp:1929-1947, iOS
   * ChatMessageBubbleItemNode.swift:484-505 and 5470-5480); false: under the media inside the
   * bubble, where the info row leaves the picture for them (Android
   * ChatMessageCell.java:10216-10250; TGP-02). outsideTail: the bubble keeps its tail over them
   * (false: iOS merges the bubble's bottom with them, no tail and the small corner,
   * ChatMessageBubbleImages.swift, ChatMessageBackground.swift:198-203). count: a pill's count as
   * the app writes it. meta: the info row's room at the end of their last row, `gap` after the
   * last pill and reaching `end` past the rows' end, or a line of its own `drop` tall under them
   * when the row is full (Web A 6, 8, 18: Reactions.scss, _message-content.scss:187-199; Web K 5,
   * 0, 14: _chatBubble.scss:2293-2300, bubbles.ts:11558-11564; Desktop 10, 3, 13:
   * history_view_reactions.cpp:378-415; Android 10, 0, 14: ReactionsLayoutInBubble.java:339-423;
   * iOS 5, 0, 14: ChatMessageDateAndStatusNode.swift:183-207); null: the room stays at the end of
   * the text.
   */
  reactions: {
    height: number | null
    radius: number
    padStart: number
    padEnd: number
    emoji: number | null
    emojiGap: number
    fontSize: number
    fontWeight: number
    gap: number
    rowGap: number
    top: number
    outside: boolean
    outsideTail: boolean
    count: (count: number) => string
    meta: { gap: number; end: number; drop: number } | null
  }
  /**
   * The comments bar (the toolbar's option): its height (null: its padding and text), padding at
   * its start, end, top and bottom, the text's size and weight; icons: the icon before the text
   * and the arrow at the end (SkinIcons.comments, commentsArrow), iconSize big, textGap before
   * the text; the narrowest bubble with the bar (Web K 240); and the label for a count.
   */
  comments: {
    height: number | null
    padStart: number
    padEnd: number
    padY: number
    fontSize: number
    fontWeight: number
    icons: boolean
    iconSize: number
    textGap: number
    minBubbleWidth: number
    label: (count: number) => string
  }
  /**
   * The link preview: its padding, radius, font size and line height (a share of the size), the
   * bar at its start and the space above it; thumb: the small picture's size (Desktop five lines,
   * 90, history_view_web_page.cpp:56-61 and 801-866; 48 elsewhere); metaInside: the info row stays
   * in the preview's last line (Desktop) instead of a line of its own under it (Web A
   * WebPage.scss:136-138, Web K _chatBubble.scss:2711-2714; Android and iOS not traced; TGP-02).
   */
  webpage: {
    padding: string
    radius: number
    fontSize: number
    lineHeight: number
    barWidth: number
    top: number
    thumb: number
    metaInside: boolean
  }
  /**
   * The channel's color (29 section 8.6): the look's palette of Telegram's seven peer colors
   * (peerColors.ts, picked by the channel's color, else from its title) and the parts that take
   * it instead of the look's own colors: the channel's name in the bubble, quotes, the links in
   * quotes, code blocks, inline code, the link preview and the comments bar; alpha is the fill's
   * opacity under a tinted quote, code block or link preview.
   */
  peer: {
    palette: PeerPalette
    title: boolean
    quote: boolean
    quoteLinks: boolean
    code: boolean
    inlineCode: boolean
    linkPreview: boolean
    comments: boolean
    alpha: number
  }
  /**
   * The top bar (29 section 8.6): its height, the avatar's size, the title's and subtitle's
   * sizes, weights and line heights (a share of the size), centered (iOS), the space after the
   * avatar, the side padding and the corner radius; float: the bar floats over the chat at `top`
   * and `side` from its edges, and the chat runs under it (null: a bar at the top); fade: the fade
   * under it, in pixels; back and menu: the round buttons at its ends, buttonSize big; the
   * avatar's initial; and the subtitle for the subscriber count.
   */
  header: {
    height: number
    avatar: number
    titleSize: number
    titleWeight: number
    titleLineHeight: number
    subSize: number
    subLineHeight: number
    centered: boolean
    gap: number
    padX: number
    radius: number
    float: { top: number; side: number } | null
    fade: number
    back: boolean
    menu: boolean
    buttonSize: number
    initial: { size: number; weight: number; font: string | null }
    /**
     * The avatar's letters for the channel's title (time.ts, TGP-02): Web A one letter after
     * punctuation (Avatar.tsx:262-264); Web K the first letters of the first and last words
     * (getAbbreviation.ts); Android its first letter and, when a later word follows, the letter
     * it takes at the first one's length (AvatarDrawable.java:509-542); Desktop and iOS one letter.
     */
    initials: (title: string) => string
    subscribers: (count: number | undefined) => string
  }
  /** 12-hour time in the info row by default (the owner's apps with an English system). */
  hour12: boolean
  /**
   * The inline keyboard under a message (19 section 7.9): rows of buttons as wide as the
   * bubble, `gap` apart in a row, `rowGap` between rows and `top` under the bubble, reaching
   * `overhang` past each side; a button is `height` tall with its text in `fontSize`,
   * `fontWeight` and `lineHeight`, `padX` at its sides (null: room for the mark), and the mark
   * of a URL or copy button, `iconSize` wide, `iconTop` and `iconEnd` from its top-right corner.
   * Buttons take `radius`, and the outer bottom corners of the last row `lastRowRadius`; a styled
   * button lays its color at `styleAlpha` over the plain fill (1: the color alone). maxWidth: the
   * widest keyboard (Android's may grow past the bubble); null: the bubble's widest.
   */
  keyboard: {
    height: number
    gap: number
    rowGap: number
    top: number
    overhang: number
    fontSize: number
    fontWeight: number
    lineHeight: number
    padX: number | null
    radius: number
    lastRowRadius: number
    iconSize: number
    iconTop: number
    iconEnd: number
    styleAlpha: number
    maxWidth: ((frameWidth: number) => number) | null
    /** A long label wraps and its button grows (Web K, whose button has no one-line rule, _chatBubble.scss:3791-3812); false: one line with an ellipsis (TGP-02). */
    wrap: boolean
  }
  /** The private chat around the messages (PRV-02; calibrate: O-02). */
  chat: ChatTokens
  /** Polls and quizzes (MSG-03; calibrate: O-02). */
  poll: PollTokens
  /** Paid media (MSG-03; calibrate: O-02). */
  paid: PaidTokens
  /** A dice: the animated emoji's size without a bubble (MSG-03; calibrate: O-02). */
  dice: { size: number }
  /** Invoices and their payment sheet (PAY-02; calibrate: O-02). */
  invoice: InvoiceTokens
  /** The pinned message bar, a gift's card and Restart (EVT-02; calibrate: O-02). */
  events: EventTokens
  icons: SkinIcons
  light: SkinColors
  dark: SkinColors
}

const px = (n: number) => `${String(n)}px`
const pxOr = (n: number | null, fallback: string) => (n === null ? fallback : px(n))

/** Where the messages start: under a floating top bar, and under the pinned message bar when there is one (EVT-02). */
export function listTop(t: SkinTokens, pinned: boolean): number {
  const float = t.header.float
  const top = float ? float.top + t.header.height + t.list.top : t.list.top
  return pinned ? top + t.events.pinned.gap + t.events.pinned.height : top
}

/** The custom properties of a look in a theme, for a chat area of frameWidth pixels. */
export function skinProperties(t: SkinTokens, theme: PreviewTheme, frameWidth: number): Record<string, string> {
  const c = theme === 'dark' ? t.dark : t.light
  const bubbleMax = t.bubbleMaxWidth(frameWidth)
  const float = t.header.float
  return {
    '--tg-frame-width': px(frameWidth),
    '--tg-list-top': px(listTop(t, false)),
    '--tg-list-bottom': px(t.list.bottom),
    '--tg-bubble-max': px(bubbleMax),
    '--tg-bubble-min': px(t.bubbleMinWidth),
    '--tg-bubble-min-height': px(t.bubbleMinHeight),
    '--tg-bubble-margin-left': px(t.bubbleMarginLeft),
    '--tg-bubble-margin-right': px(t.bubbleMarginRight),
    '--tg-shadow-y': px(t.bubbleShadow.y),
    '--tg-shadow-blur': px(t.bubbleShadow.blur),
    '--tg-shadow-spread': px(t.bubbleShadow.spread),
    '--tg-outline-width': px(t.outlineWidth),
    '--tg-font': t.fontFamily,
    '--tg-font-size': px(t.fontSize),
    '--tg-line-height': String(t.lineHeight),
    '--tg-bold': String(t.boldWeight),
    '--tg-link-decoration': t.links.underline ? 'underline' : 'none',
    '--tg-emoji-size': `${String(t.emoji.scale)}em`,
    // PremiumEmoji draws a box 1.25em big: its font size scales it to the look's size.
    '--tg-custom-emoji-font': `${String(t.emoji.customScale / 1.25)}em`,
    '--tg-emoji-gap': px(t.emoji.gap),
    '--tg-emoji-align': t.emoji.align,
    '--tg-title-size': px(t.title.size),
    '--tg-title-weight': String(t.title.weight),
    '--tg-title-line-height': String(t.title.lineHeight),
    '--tg-title-gap': px(t.title.gap),
    '--tg-title-media-gap': px(t.title.mediaGap),
    '--tg-meta-size': px(t.metaFontSize),
    '--tg-meta-right': px(t.meta.right),
    '--tg-meta-bottom': px(t.meta.bottom),
    '--tg-meta-height': px(t.meta.height),
    '--tg-meta-pad': px(t.meta.padding),
    '--tg-meta-icon': px(t.meta.iconSize),
    '--tg-meta-icon-gap': px(t.meta.iconGap),
    '--tg-meta-count-gap': px(t.meta.countGap),
    '--tg-meta-time-gap': px(t.meta.timeGap),
    '--tg-meta-reserve': px(t.meta.reserve),
    '--tg-meta-drop': pxOr(t.meta.dropHeight, '1lh'),
    '--tg-meta-overlay-right': px(t.meta.overlay.right),
    '--tg-meta-overlay-bottom': px(t.meta.overlay.bottom),
    '--tg-meta-overlay-height': px(t.meta.overlay.height),
    '--tg-meta-overlay-pad-start': px(t.meta.overlay.padStart),
    '--tg-meta-overlay-pad-end': px(t.meta.overlay.padEnd),
    '--tg-meta-overlay-radius': px(t.meta.overlay.radius),
    '--tg-big-single-radius': px(t.bigEmoji?.single?.radius ?? t.meta.overlay.radius),
    '--tg-big-single-pad': px(t.bigEmoji?.single?.padX ?? t.meta.overlay.padStart),
    '--tg-pad-top': px(t.padding.top),
    '--tg-pad-right': px(t.padding.right),
    '--tg-pad-bottom': px(t.padding.bottom),
    '--tg-pad-left': px(t.padding.left),
    '--tg-pad-footer': px(t.padding.footer),
    '--tg-caption-top': px(t.caption.top),
    '--tg-caption-bottom': px(t.caption.bottom),
    '--tg-caption-footer': px(t.caption.footer),
    '--tg-radius': px(t.radius.main),
    '--tg-radius-small': px(t.radius.small),
    '--tg-radius-keyboard': px(t.radius.aboveKeyboard),
    '--tg-tail-width': px(t.tail?.width ?? 0),
    '--tg-tail-height': px(t.tail?.height ?? 0),
    '--tg-tail-left': px(t.tail?.left ?? 0),
    '--tg-tail-bottom': px(t.tail?.bottom ?? 0),
    '--tg-tail-corner': px(t.tail?.squareCorner === false ? t.radius.main : 0),
    '--tg-tail-corner-keyboard': px(t.tail?.squareCorner === false ? t.radius.aboveKeyboard : 0),
    '--tg-tail-shadow-y': px(t.tail?.shadow.y ?? 0),
    '--tg-tail-shadow-blur': px(t.tail?.shadow.blur ?? 0),
    '--tg-quote-bar': px(t.quote.barWidth),
    '--tg-quote-radius': px(t.quote.radius),
    '--tg-quote-pad-start': px(t.quote.padStart),
    '--tg-quote-pad-end': px(t.quote.padEnd),
    '--tg-quote-pad-block': px(t.quote.padBlock),
    '--tg-quote-pad-y': px(t.quote.padY),
    '--tg-quote-font-size': px(t.fontSize + t.quote.fontSizeDelta),
    '--tg-quote-line-height': pxOr(t.quote.lineHeight, String(t.lineHeight)),
    '--tg-quote-lines': String(t.quote.collapsedLines),
    '--tg-quote-fade': t.quote.fade === null ? '55%' : `calc(100% - ${px(t.quote.fade)})`,
    '--tg-quote-icon-width': px(t.quote.icon.width),
    '--tg-quote-icon-height': px(t.quote.icon.height),
    '--tg-quote-icon-top': px(t.quote.icon.top),
    '--tg-quote-icon-end': px(t.quote.icon.end),
    '--tg-quote-expand-width': px(t.quote.expand.width),
    '--tg-quote-expand-height': px(t.quote.expand.height),
    '--tg-quote-expand-end': px(t.quote.expand.end),
    '--tg-quote-expand-bottom': px(t.quote.expand.bottom),
    '--tg-quote-first-margin': px(t.quote.first?.margin ?? t.quote.padBlock),
    '--tg-quote-first-pad': px(t.quote.first?.padY ?? t.quote.padY),
    '--tg-code-font': t.code.fontFamily,
    '--tg-code-size': px(t.code.fontSize),
    '--tg-code-block-size': px(t.code.blockFontSize),
    '--tg-code-line-height': String(t.code.lineHeight),
    '--tg-code-radius': px(t.code.radius),
    '--tg-code-inline-pad': t.code.inlinePadding,
    '--tg-code-block-pad': t.code.blockPadding,
    '--tg-code-block-margin': px(t.code.blockMargin),
    '--tg-code-bar': px(t.code.barWidth),
    '--tg-code-header-size': px(t.code.header.fontSize),
    '--tg-code-header-weight': String(t.code.header.fontWeight),
    '--tg-code-header-pad': t.code.header.padding,
    '--tg-code-header-font': t.code.header.mono ? t.code.fontFamily : t.fontFamily,
    '--tg-code-header-height': pxOr(t.code.header.height, 'auto'),
    '--tg-code-first-margin': px(t.code.first?.margin ?? t.code.blockMargin),
    '--tg-code-first-radius': px(t.code.first?.radius ?? t.code.radius),
    '--tg-code-copy-bar-height': px(t.code.copyBar?.height ?? 0),
    '--tg-code-copy-bar-size': px(t.code.copyBar?.fontSize ?? 0),
    '--tg-code-copy-bar-weight': String(t.code.copyBar?.fontWeight ?? 400),
    '--tg-code-copy-bar-icon': px(t.code.copyBar?.iconSize ?? 0),
    '--tg-code-copy-bar-gap': px(t.code.copyBar?.gap ?? 0),
    '--tg-rich-gap': px(t.rich.gap?.block ?? 8),
    '--tg-rich-paragraph-gap': px(t.rich.gap?.paragraph ?? 8),
    '--tg-rich-marker-width': px(t.rich.marker?.width ?? 0),
    '--tg-rich-marker-gap': px(t.rich.marker?.gap ?? 0),
    '--tg-rich-table-radius': px(t.rich.tableRadius),
    '--tg-spoiler-dot': px(t.spoiler.dot),
    '--tg-spoiler-dot-edge': px(t.spoiler.dot + 0.5),
    '--tg-spoiler-cell': px(t.spoiler.cell),
    '--tg-spoiler-radius': px(t.spoiler.radius),
    '--tg-media-radius': px(t.media.radius),
    '--tg-media-caption-radius': px(t.media.captionRadius),
    '--tg-media-inset': px(t.media.inset),
    '--tg-duration-top': px(t.duration?.top ?? 0),
    '--tg-duration-left': px(t.duration?.left ?? 0),
    '--tg-duration-height': px(t.duration?.height ?? 0),
    '--tg-duration-pad': px(t.duration?.padX ?? 0),
    '--tg-duration-radius': px(t.duration?.radius ?? 0),
    '--tg-duration-size': px(t.duration?.fontSize ?? 0),
    '--tg-play-size': px(t.play.size),
    '--tg-play-icon': px(t.play.iconSize),
    '--tg-album-gap': px(t.album.gap),
    '--tg-album-inset': px(t.album.inset),
    '--tg-share-size': px(t.shareButton?.size ?? 0),
    '--tg-share-gap': px(t.shareButton?.gap ?? 0),
    '--tg-share-icon-size': px(t.shareButton?.iconSize ?? 0),
    '--tg-reaction-height': pxOr(t.reactions.height, 'auto'),
    '--tg-reaction-radius': px(t.reactions.radius),
    '--tg-reaction-pad-start': px(t.reactions.padStart),
    '--tg-reaction-pad-end': px(t.reactions.padEnd),
    '--tg-reaction-emoji': pxOr(t.reactions.emoji, 'var(--tg-emoji-size)'),
    '--tg-reaction-emoji-gap': px(t.reactions.emojiGap),
    '--tg-reaction-size': px(t.reactions.fontSize),
    '--tg-reaction-weight': String(t.reactions.fontWeight),
    '--tg-reactions-gap': px(t.reactions.gap),
    '--tg-reactions-row-gap': px(t.reactions.rowGap),
    '--tg-reactions-top': px(t.reactions.top),
    '--tg-reactions-meta-gap': px(t.reactions.meta?.gap ?? 0),
    '--tg-reactions-meta-end': px(t.reactions.meta?.end ?? 0),
    '--tg-reactions-meta-drop': px(Math.max(0, (t.reactions.meta?.drop ?? 0) - t.reactions.rowGap)),
    '--tg-comments-height': pxOr(t.comments.height, 'auto'),
    '--tg-comments-pad-start': px(t.comments.padStart),
    '--tg-comments-pad-end': px(t.comments.padEnd),
    '--tg-comments-pad-y': px(t.comments.padY),
    '--tg-comments-size': px(t.comments.fontSize),
    '--tg-comments-weight': String(t.comments.fontWeight),
    '--tg-comments-icon-size': px(t.comments.iconSize),
    '--tg-comments-text-gap': px(t.comments.textGap),
    '--tg-comments-min-width': px(t.comments.minBubbleWidth),
    '--tg-webpage-pad': t.webpage.padding,
    '--tg-webpage-radius': px(t.webpage.radius),
    '--tg-webpage-size': px(t.webpage.fontSize),
    '--tg-webpage-line-height': String(t.webpage.lineHeight),
    '--tg-webpage-bar': px(t.webpage.barWidth),
    '--tg-webpage-top': px(t.webpage.top),
    '--tg-webpage-thumb': px(t.webpage.thumb),
    '--tg-header-height': px(t.header.height),
    '--tg-header-avatar': px(t.header.avatar),
    '--tg-header-title-size': px(t.header.titleSize),
    '--tg-header-title-weight': String(t.header.titleWeight),
    '--tg-header-title-line-height': String(t.header.titleLineHeight),
    '--tg-header-sub-size': px(t.header.subSize),
    '--tg-header-sub-line-height': String(t.header.subLineHeight),
    '--tg-header-justify': t.header.centered ? 'center' : 'flex-start',
    '--tg-header-avatar-order': t.header.centered ? '2' : '0',
    '--tg-header-text-align': t.header.centered ? 'center' : 'flex-start',
    '--tg-header-gap': px(t.header.gap),
    '--tg-header-pad-x': px(t.header.padX),
    '--tg-header-radius': px(t.header.radius),
    '--tg-header-position': float ? 'absolute' : 'relative',
    '--tg-header-top': px(float?.top ?? 0),
    '--tg-header-side': px(float?.side ?? 0),
    '--tg-header-fade': px(t.header.fade),
    '--tg-header-button': px(t.header.buttonSize),
    '--tg-header-initial-size': px(t.header.initial.size),
    '--tg-header-initial-weight': String(t.header.initial.weight),
    '--tg-header-initial-font': t.header.initial.font ?? t.fontFamily,
    '--tg-kb-height': px(t.keyboard.height),
    // A wrapping label grows its button by its lines, one line keeping the button's height.
    '--tg-kb-button-height': t.keyboard.wrap ? 'auto' : px(t.keyboard.height),
    '--tg-kb-pad-y': t.keyboard.wrap ? `calc((${px(t.keyboard.height)} - 1lh) / 2)` : '0px',
    '--tg-kb-white-space': t.keyboard.wrap ? 'normal' : 'nowrap',
    '--tg-kb-gap': px(t.keyboard.gap),
    '--tg-kb-row-gap': px(t.keyboard.rowGap),
    '--tg-kb-top': px(t.keyboard.top),
    '--tg-kb-overhang': px(t.keyboard.overhang),
    '--tg-kb-font-size': px(t.keyboard.fontSize),
    '--tg-kb-weight': String(t.keyboard.fontWeight),
    '--tg-kb-line-height': String(t.keyboard.lineHeight),
    '--tg-kb-pad-x': px(t.keyboard.padX ?? t.keyboard.iconSize + 8),
    '--tg-kb-radius': px(t.keyboard.radius),
    '--tg-kb-last-radius': px(t.keyboard.lastRowRadius),
    '--tg-kb-icon': px(t.keyboard.iconSize),
    '--tg-kb-icon-top': px(t.keyboard.iconTop),
    '--tg-kb-icon-end': px(t.keyboard.iconEnd),
    '--tg-kb-style-alpha': `${String(t.keyboard.styleAlpha * 100)}%`,
    '--tg-kb-max': px(t.keyboard.maxWidth ? t.keyboard.maxWidth(frameWidth) : bubbleMax),
    '--tg-bubble': c.bubble,
    '--tg-text': c.text,
    '--tg-link': c.link,
    '--tg-meta': c.meta,
    '--tg-views': c.views,
    '--tg-accent': c.accent,
    '--tg-title-color': c.accent,
    '--tg-code-text': c.codeText,
    '--tg-code-bg': c.codeBg,
    '--tg-pre-bg': c.preBg,
    '--tg-pre-text': c.preText,
    '--tg-pre-bar': c.preBar,
    '--tg-pre-header-bg': c.preHeaderBg,
    '--tg-pre-label': c.preLabel,
    '--tg-pre-icon': c.preIcon,
    '--tg-quote-bg': c.quoteBg,
    '--tg-quote-bar-color': c.quoteBar,
    '--tg-quote-link': c.link,
    '--tg-webpage-bg': c.webpageBg,
    '--tg-webpage-accent': c.webpageAccent,
    '--tg-spoiler-dots': c.spoilerDots,
    '--tg-header': c.header,
    '--tg-header-text': c.headerText,
    '--tg-header-subtext': c.headerSubtext,
    '--tg-header-border': c.headerBorder,
    '--tg-header-shadow': c.headerShadow,
    '--tg-header-icon': c.headerIcon,
    '--tg-header-button-bg': c.headerButton,
    '--tg-header-fade-color': c.headerFade,
    '--tg-share': c.share,
    '--tg-share-icon': c.shareIcon,
    '--tg-outline': c.outline,
    '--tg-shadow': c.shadow,
    '--tg-tail-shadow': c.tailShadow,
    '--tg-media-meta-bg': c.mediaMetaBg,
    '--tg-media-meta-text': c.mediaMetaText,
    '--tg-media-meta-icon': c.mediaMetaIcon,
    '--tg-big-emoji-meta-bg': c.bigEmojiMetaBg,
    '--tg-media-shade': c.mediaShade,
    '--tg-duration-bg': c.durationBg,
    '--tg-duration-text': c.durationText,
    '--tg-play-bg': c.playBg,
    '--tg-play-color': c.playIcon,
    '--tg-reaction-bg': c.reactionBg,
    '--tg-reaction-text': c.reactionText,
    '--tg-reaction-outside-bg': c.reactionOutsideBg,
    '--tg-reaction-outside-text': c.reactionOutsideText,
    '--tg-comments-text': c.commentsText,
    '--tg-comments-icon': c.commentsIcon,
    '--tg-comments-border': c.commentsBorder,
    '--tg-kb-bg': c.button,
    '--tg-kb-text': c.buttonText,
    '--tg-kb-success': c.buttonSuccess,
    '--tg-kb-primary': c.buttonPrimary,
    '--tg-kb-danger': c.buttonDanger,
    ...chatProperties(t, c),
    ...kindProperties(t),
    ...markColors(theme),
  }
}

/** The private chat's custom properties (ChatTokens, PRV-02), read by chat.css. */
function chatProperties(t: SkinTokens, c: SkinColors): Record<string, string> {
  const { out, service, composer, menuButton, replyKeyboard, toast, alert, empty, start, commands } = t.chat
  return {
    '--tg-chat-height': px(t.chat.height),
    '--tg-chat-gap': px(t.chat.gap),
    '--tg-out-margin-left': px(out.marginLeft),
    '--tg-out-margin-right': px(out.marginRight),
    '--tg-out-check-width': px(out.checkWidth),
    '--tg-out-check-height': px(out.checkHeight),
    '--tg-service-height': px(service.height),
    '--tg-service-pad': px(service.padX),
    '--tg-service-radius': px(service.radius),
    '--tg-service-size': px(service.fontSize),
    '--tg-service-weight': String(service.fontWeight),
    '--tg-service-margin': px(service.margin),
    '--tg-composer-height': px(composer.height),
    '--tg-composer-side': px(composer.float?.side ?? 0),
    '--tg-composer-bottom': px(composer.float?.bottom ?? 0),
    // The list runs under a floating input field and keeps room for it.
    '--tg-composer-room': px(composer.float ? composer.height + composer.float.bottom : 0),
    '--tg-composer-radius': px(composer.radius),
    '--tg-composer-pad': px(composer.padX),
    '--tg-composer-size': px(composer.fontSize),
    '--tg-composer-icon': px(composer.iconSize),
    '--tg-composer-gap': px(composer.gap),
    '--tg-send-size': px(composer.send ?? composer.height),
    '--tg-menu-height': px(menuButton.height),
    '--tg-menu-pad': px(menuButton.padX),
    '--tg-menu-radius': px(menuButton.radius),
    '--tg-menu-size': px(menuButton.fontSize),
    '--tg-menu-weight': String(menuButton.fontWeight),
    '--tg-rk-height': px(replyKeyboard.height),
    '--tg-rk-pad': px(replyKeyboard.padding),
    '--tg-rk-gap': px(replyKeyboard.gap),
    '--tg-rk-button': px(replyKeyboard.buttonHeight),
    '--tg-rk-radius': px(replyKeyboard.radius),
    '--tg-rk-size': px(replyKeyboard.fontSize),
    '--tg-rk-weight': String(replyKeyboard.fontWeight),
    '--tg-toast-offset': px(toast.offset),
    '--tg-toast-radius': px(toast.radius),
    '--tg-toast-pad': toast.padding,
    '--tg-toast-size': px(toast.fontSize),
    '--tg-toast-max': px(toast.maxWidth),
    '--tg-alert-width': px(alert.width),
    '--tg-alert-radius': px(alert.radius),
    '--tg-alert-pad': alert.padding,
    '--tg-alert-size': px(alert.fontSize),
    '--tg-alert-title-size': px(alert.titleSize),
    '--tg-alert-button-size': px(alert.buttonSize),
    '--tg-alert-button-align': alert.buttonAlign === 'end' ? 'flex-end' : 'center',
    '--tg-empty-width': px(empty.width),
    '--tg-empty-radius': px(empty.radius),
    '--tg-empty-pad': empty.padding,
    '--tg-empty-title-size': px(empty.titleSize),
    '--tg-empty-size': px(empty.fontSize),
    '--tg-empty-gap': px(empty.gap),
    '--tg-start-height': px(start.height),
    '--tg-start-size': px(start.fontSize),
    '--tg-start-weight': String(start.fontWeight),
    '--tg-start-transform': start.uppercase ? 'uppercase' : 'none',
    '--tg-start-radius': px(start.radius),
    '--tg-cmd-row': px(commands.rowHeight),
    '--tg-cmd-avatar': px(commands.avatar),
    '--tg-cmd-size': px(commands.fontSize),
    '--tg-cmd-sub-size': px(commands.subSize),
    '--tg-cmd-pad': px(commands.padX),
    '--tg-cmd-radius': px(commands.radius),
    '--tg-cmd-max': px(commands.rows * commands.rowHeight),
    '--tg-out-bubble': c.outBubble,
    '--tg-out-text': c.outText,
    '--tg-out-link': c.outLink,
    '--tg-out-meta': c.outMeta,
    '--tg-out-check': c.outCheck,
    '--tg-out-outline': c.outOutline,
    '--tg-out-shadow': c.outShadow,
    '--tg-service-bg': c.serviceBg,
    '--tg-service-text': c.serviceText,
    '--tg-typing': c.typing,
    '--tg-composer': c.composer,
    '--tg-composer-text': c.composerText,
    '--tg-composer-placeholder': c.composerPlaceholder,
    '--tg-composer-icon-color': c.composerIcon,
    '--tg-composer-border': c.composerBorder,
    '--tg-send': c.send,
    '--tg-menu-bg': c.menuButton,
    '--tg-menu-text': c.menuButtonText,
    '--tg-rk-panel': c.replyPanel,
    '--tg-rk-bg': c.replyButton,
    '--tg-rk-text': c.replyButtonText,
    '--tg-rk-shadow': c.replyButtonShadow,
    '--tg-toast-bg': c.toast,
    '--tg-toast-text': c.toastText,
    '--tg-alert-bg': c.alert,
    '--tg-alert-text': c.alertText,
    '--tg-alert-button': c.alertButton,
    '--tg-scrim': c.scrim,
    '--tg-empty-bg': c.empty,
    '--tg-empty-text': c.emptyText,
    '--tg-start-bg': c.start,
    '--tg-start-text': c.startText,
    '--tg-cmd-bg': c.commands,
    '--tg-cmd-text': c.commandsText,
    '--tg-cmd-subtext': c.commandsSubtext,
  }
}

/**
 * The custom properties of polls, quizzes and paid media (PollTokens, PaidTokens, MSG-03), read by
 * poll.css, of invoices (InvoiceTokens, PAY-02), read by invoice.css, and of the pinned bar and
 * gifts (EventTokens, EVT-02), read by events.css.
 */
function kindProperties(t: SkinTokens): Record<string, string> {
  const { poll, paid, invoice } = t
  const { pinned, gift } = t.events
  return {
    '--tg-pinned-height': px(pinned.height),
    '--tg-pinned-gap': px(pinned.gap),
    '--tg-pinned-radius': px(pinned.radius),
    '--tg-pinned-pad': px(pinned.padX),
    '--tg-pinned-line': px(pinned.line),
    '--tg-pinned-title-size': px(pinned.titleSize),
    '--tg-pinned-size': px(pinned.fontSize),
    '--tg-gift-width': px(gift.width),
    '--tg-gift-radius': px(gift.radius),
    '--tg-gift-pad': gift.padding,
    '--tg-gift-picture': px(gift.picture),
    '--tg-gift-title-size': px(gift.titleSize),
    '--tg-gift-size': px(gift.fontSize),
    '--tg-invoice-title-size': px(invoice.titleSize),
    '--tg-invoice-title-weight': String(invoice.titleWeight),
    '--tg-invoice-price-size': px(invoice.priceSize),
    '--tg-sheet-radius': px(invoice.sheet.radius),
    '--tg-poll-question-size': px(poll.questionSize),
    '--tg-poll-question-weight': String(poll.questionWeight),
    '--tg-poll-type-size': px(poll.typeSize),
    '--tg-poll-type-gap': px(poll.typeGap),
    '--tg-poll-option-size': px(poll.optionSize),
    '--tg-poll-option-height': px(poll.optionHeight),
    '--tg-poll-option-gap': px(poll.optionGap),
    '--tg-poll-mark': px(poll.mark),
    '--tg-poll-mark-gap': px(poll.markGap),
    '--tg-poll-bar': px(poll.bar),
    '--tg-poll-footer-height': px(poll.footerHeight),
    '--tg-poll-footer-size': px(poll.footerSize),
    '--tg-poll-right': poll.right,
    '--tg-poll-wrong': poll.wrong,
    '--tg-paid-blur': px(paid.blur),
    '--tg-paid-height': px(paid.height),
    '--tg-paid-pad': px(paid.padX),
    '--tg-paid-radius': px(paid.radius),
    '--tg-paid-size': px(paid.fontSize),
    '--tg-paid-weight': String(paid.fontWeight),
  }
}

/**
 * The channel's color on the chat (29 section 8.6, TGP-02): Post.tsx sets these on the chat
 * element, where they take the place of the look's own colors in the parts its `peer` names.
 */
export function peerProperties(t: SkinTokens, theme: PreviewTheme, color: PeerColor): Record<string, string> {
  const tint = color.tint[theme]
  const fill = `color-mix(in srgb, ${tint} ${String(t.peer.alpha * 100)}%, transparent)`
  const out: Record<string, string> = { '--tg-peer': tint }
  if (t.peer.title) out['--tg-title-color'] = tint
  if (t.peer.quote) {
    out['--tg-quote-bar-color'] = tint
    out['--tg-quote-bg'] = fill
  }
  if (t.peer.quoteLinks) out['--tg-quote-link'] = tint
  if (t.peer.code) {
    out['--tg-pre-bar'] = tint
    out['--tg-pre-label'] = tint
    out['--tg-pre-bg'] = fill
  }
  if (t.peer.inlineCode) out['--tg-code-text'] = tint
  if (t.peer.linkPreview) {
    out['--tg-webpage-accent'] = tint
    out['--tg-webpage-bg'] = fill
  }
  if (t.peer.comments) {
    out['--tg-comments-text'] = tint
    out['--tg-comments-icon'] = tint
  }
  return out
}

/**
 * The colors of the ticks that draw the invisible direction marks (the preview option
 * "Invisible marks", 20 section 4.3.7): RLM blue, LRM green and ALM amber, the same in every
 * look and tuned for the bubble of each theme.
 */
function markColors(theme: PreviewTheme): Record<string, string> {
  return theme === 'dark'
    ? { '--tg-mark-rlm': '#6cb8ff', '--tg-mark-lrm': '#5fd18b', '--tg-mark-alm': '#f0aa5a' }
    : { '--tg-mark-rlm': '#1a6fd6', '--tg-mark-lrm': '#17884a', '--tg-mark-alm': '#b4620f' }
}
