import { webAlbumLayout } from '../albumLayout'
import { codeLanguage } from '../codeLanguages'
import { lookFonts } from '../fonts'
import type { PeerColor, PeerPalette } from '../peerColors'
import { webAInitial } from '../time'
import { eventLabels, pollLabels, sheetLabels, subscribersLabel, unlockLabel } from './labels'
import { webTail } from './tails'
import type { MediaBoxFn, SkinTokens } from './tokens'

/**
 * Telegram Web A (web.telegram.org/a), set from its measurement sheet .dev/upd29/tg/web-a.md
 * (telegram-tt 12.0.47; docs/plan/29-owner-list-2026-10-22.md section 8.4, TGP-03): a 760 px
 * messages column with 16 px text on a computer that is not Apple's. Its stored id stays `web`
 * (D-6271). What the tokens cannot draw is in web.css: the app's phone layout in a chat up to
 * 600 px wide, the spoiler's dots, the quote's arrow, the marks of the buttons, big emoji and
 * the reactions' room. The sources below are the app's files and lines, as the sheet names them.
 */

/** "1.2K", "12.3K", "1M": Web A's count, floored to one decimal (textFormat.ts:16-26, math.ts:5). */
const counts = new Intl.NumberFormat('en-US')

function webViews(count: number): string {
  if (count < 1e3) return counts.format(count)
  if (count < 1e6) return `${counts.format(Math.floor((count / 1e3) * 10) / 10)}K`
  return `${counts.format(Math.floor((count / 1e6) * 10) / 10)}M`
}

/** "1.2K comments", "1 comment", "Leave a comment": the count in the views' form (CommentButton.tsx:90-120). */
function webComments(count: number): string {
  if (count <= 0) return 'Leave a comment'
  return `${webViews(count)} ${count === 1 ? 'comment' : 'comments'}`
}

/** A color with white laid over it at 25 %: the top of Web A's avatar, linear-gradient(#fff -300%, color) (Avatar.scss:63). */
function avatarTop(hex: string): string {
  const channel = (at: number) =>
    Math.round(255 * 0.25 + Number.parseInt(hex.slice(at, at + 2), 16) * 0.75)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

/** A peer color of Web A: the same in both themes, its avatar from 25 % white over it down to the color. */
function webPeer(color: string): PeerColor {
  const avatar = [avatarTop(color), color] as const
  return { avatar: { light: avatar, dark: avatar }, tint: { light: color, dark: color } }
}

/**
 * Web A's seven peer colors (theme.ts:62-68), the light ones in both themes (the server may send
 * dark ones; the source has none): the channel's color tints its quotes, code blocks, link
 * previews and comments bar (_common.scss:254-261), at 10 % under quotes and link previews.
 */
const webPalette: PeerPalette = ['#d45246', '#f68136', '#6c61df', '#46ba43', '#5caffa', '#408acf', '#d95574'].map(
  webPeer,
)

/** The size of big emoji by N, the most emoji on a line or the lines: 1 to 7 and more (_message-content.scss:886-943). */
const bigEmojiSizes = [112, 90, 84, 72, 60, 48, 36] as const

/**
 * A single photo or video as Web A sizes it (media.module.scss:1-36, Photo.tsx:248-249): as wide
 * as the picture but at least 192 px (320 when the caption is longer than 40 characters or the
 * comments bar shows, 224 of those in the phone layout: media.module.scss:78-84,
 * Message.tsx:369,935-938) and at most as wide as 432 px of height allow and as the bubble; at
 * most 432 and at least 80 px tall. The bubble takes the media's width (has-adaptive-width,
 * _message-content.scss:780-795) and the picture is contained in its box over a blurred copy.
 */
const webMediaBox: MediaBoxFn = (m, { bubbleMax, frameWidth, caption, comments }) => {
  const aspect = m.width > 0 && m.height > 0 ? m.width / m.height : 1
  const wide = caption.length > 40 || comments
  const minWidth = wide ? (frameWidth <= 600 ? 224 : 320) : 192
  const natural = m.width > 0 ? m.width : Number.POSITIVE_INFINITY
  const width = Math.min(Math.max(minWidth, Math.min(natural, 432 * aspect)), bubbleMax)
  const height = Math.max(Math.min(width / aspect, 432), 80)
  const imageWidth = Math.min(width, height * aspect)
  const imageHeight = imageWidth / aspect
  return { width, height, imageWidth, imageHeight, blur: imageWidth < width - 0.5 || imageHeight < height - 0.5 }
}

/** --action-message-bg, computed by the app from the default wallpaper (wallpaper.ts:168-176; sheet section 7). */
const actionLight = '#6aa15ad9'
const actionDark = '#22292ed9'

export const web: SkinTokens = {
  id: 'web',
  label: 'Web A',
  // The messages column: 47.5rem (_variables.scss:249, MessageList.scss:113).
  frameWidth: 760,
  // The column's 1rem padding above the first post (MessageList.scss:116) and the last post's
  // 0.375rem margin under it (Message.scss:120-124); the composer's 72 px follow
  // (wallpaper/web.ts).
  list: { top: 16, bottom: 6 },
  // --max-width: 29rem; in the phone layout min(29rem, 100vw - 4.5rem) beside the share
  // button (_message-content.scss:653-671, Message.scss:15).
  bubbleMaxWidth: (w) => (w <= 600 ? Math.min(464, w - 72) : 464),
  bubbleMinWidth: 0,
  bubbleMinHeight: 0,
  // The column's padding, 1.125rem left and 1rem right (MessageList.scss:116); channels have no
  // avatars and no indent (MessageList.tsx:1286, Message.scss:157). Phone layout: web.css.
  bubbleMarginLeft: 18,
  bubbleMarginRight: 16,
  // box-shadow: 0 1px 2px var(--color-default-shadow) (_message-content.scss:479-480).
  bubbleShadow: { y: 1, blur: 2, spread: 0 },
  outlineWidth: 0,
  // index.scss:14-15 with xWriter's Roboto first; Persian in Vazirmatn as the stand-in of the
  // system font the app falls to with an English interface (sheet section 6).
  fontFamily:
    '"Roboto Variable", Roboto, "Vazirmatn Variable", -apple-system, BlinkMacSystemFont, "Apple Color Emoji", "Segoe UI", Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  fontSize: 16,
  lineHeight: 1.3125,
  // b, strong: var(--font-weight-medium) (reboot.css:96-98, _variables.scss:349).
  boldWeight: 500,
  links: { underline: false },
  emoji: { scale: 1.25, customScale: 1.25, gap: 1, align: 'text-bottom' },
  // Up to 100 emoji without other text or formatting (parseEmojiOnlyString.ts:4-33).
  bigEmoji: {
    rule: 'lines',
    single: null,
    size: ({ count, lines, perLine }) =>
      count > 100 ? null : (bigEmojiSizes[Math.min(Math.max(lines, perLine), 7) - 1] ?? 36),
  },
  title: { show: false, size: 14, weight: 500, lineHeight: 1.25, gap: 4, mediaGap: 4 },
  metaFontSize: 12,
  meta: {
    // The row floats in the last line, 6 px lower and 6 px into the right padding
    // (_message-content.scss:141-153): its box ends 2 px inside the bubble's right edge and
    // 1 px above its bottom; it keeps 7 - 6 = 1 px more than itself on the line, and drops
    // under the text with its own 20 px.
    right: 2,
    bottom: 1,
    height: 20,
    padding: 4,
    iconSize: 18,
    iconGap: 6,
    countGap: 2,
    timeGap: 4,
    viewsFirst: true,
    rtl: 'float',
    form: 'parts',
    views: webViews,
    hour: 'numeric',
    reserve: 1,
    dropHeight: 20,
    // Over media without a caption and under big emoji (MessageMeta.scss:102-131).
    overlay: { right: 4, bottom: 4, height: 18, padStart: 6, padEnd: 5, radius: 10 },
  },
  padding: { top: 5, right: 8, bottom: 6, left: 8, footer: 6 },
  // The media's 0.375rem margin above a caption and the bubble's padding under it, or the
  // comments bar's 0.375rem margin (_message-content.scss:687, 492; CommentButton.scss:166).
  caption: { top: 6, bottom: 6, footer: 6 },
  radius: { main: 15, small: 6, aboveKeyboard: 6 },
  // MessageAppendix.tsx:5-27: a 9 x 18 box (the SVG drawn 1:1 and clipped, web.css), 0.562rem
  // left of the bubble and 1 px below it, so the path's foot (y 17) is on the bubble's bottom.
  tail: {
    path: webTail,
    viewBox: '0 0 9 18',
    width: 9,
    height: 18,
    left: -8.992,
    bottom: -1,
    squareCorner: true,
    aboveKeyboard: false,
    underMedia: true,
    shadow: { y: 1, blur: 1 },
  },
  quote: {
    collapsedLines: 4,
    barWidth: 3,
    radius: 4,
    padStart: 8,
    padEnd: 16,
    padBlock: 2,
    padY: 2,
    fontSizeDelta: -2,
    lineHeight: null,
    // The last 1rem fades (Blockquote.module.scss:16-24, _mixins.scss:35-37).
    fade: 16,
    icon: { width: 10, height: 10, top: 4, end: 4 },
    // A 1.5rem box at the quote's bottom-right corner (Blockquote.module.scss:26-37); its glyph in web.css.
    expand: { width: 24, height: 24, end: 0, bottom: 0 },
    // It folds, with its arrow, only over four lines (Blockquote.tsx:57, useCollapsibleLines.ts:80),
    // and takes the message's side (the text's dir="auto").
    foldLong: true,
    direction: 'message',
    wideAt: null,
    first: null,
  },
  code: {
    fontFamily:
      '"Cascadia Mono", "Roboto Mono", "Droid Sans Mono", "SF Mono", Menlo, "Ubuntu Mono", Consolas, monospace',
    fontSize: 14,
    blockFontSize: 14,
    lineHeight: 1.3125,
    radius: 4,
    inlinePadding: '1px 2px',
    // CodeBlock.scss:3-27 in PeerColorWrapper.module.scss:1-30: 3 px above and under, 9 px after
    // the 3 px bar and 6 px at the end; the language over the code, 8 px above it.
    blockPadding: '3px 6px 3px 9px',
    blockMargin: 4,
    barWidth: 3,
    header: { fontSize: 14, fontWeight: 500, padding: '3px 6px 8px 9px', mono: false, height: null },
    noLanguage: null,
    copyMark: false,
    wideBubble: null,
    // The language's name, "js" as "JavaScript" (codeLanguages.ts:108-117).
    language: codeLanguage.web,
    sizes: null,
    copyBar: null,
    first: null,
  },
  // Rich posts (RichContent.module.scss): 12 under each block and 2 under a paragraph (:19-48),
  // numbered markers in 20 px boxes 4 before the item (:204-223), tables with 16 px outer
  // corners (:318-361, --border-radius-default).
  rich: { gap: { block: 12, paragraph: 2 }, marker: { width: 20, gap: 4 }, tableRadius: 16 },
  // The dots are the app's picture (web.css); the hidden text's corners (Spoiler.scss:4).
  spoiler: { dot: 0.6, cell: 3, radius: 8 },
  media: {
    maxWidth: () => 464,
    maxHeight: () => 432,
    minWidth: 192,
    minHeight: 80,
    radius: 15,
    captionRadius: 0,
    inset: 0,
    sampleTail: true,
    blurFill: true,
    box: webMediaBox,
  },
  // MediaBadge.module.scss:1-20.
  duration: { top: 3, left: 3, height: 18, padX: 6, radius: 12, fontSize: 12, pad: 'hours', gif: 'GIF' },
  // A 3.375rem circle (media.module.scss:110-136); Web A plays videos in the chat by default, so
  // web.css hides it.
  play: { size: 54, iconSize: 18 },
  album: { gap: 2, inset: 0, layout: webAlbumLayout },
  // .message-action-button: 2.25rem, right: -3rem (Message.scss:742-807); its icon 1.5rem
  // (Button.scss:327-333); shown while the mouse is over the post.
  shareButton: { size: 36, gap: 12, bottom: 0, iconSize: 24, hover: true },
  // ReactionButton.module.scss:2-30,69-71,136-139 and Reactions.scss:1-11: pills 30 px tall,
  // the emoji 20 px with 4 px around it (web.css), 2 px to the count, which keeps 2 px more
  // before the 6 px padding.
  reactions: {
    height: 30,
    radius: 28,
    padStart: 4,
    padEnd: 8,
    emoji: 20,
    emojiGap: 2,
    fontSize: 14,
    fontWeight: 500,
    gap: 6,
    rowGap: 6,
    top: 4,
    outside: true,
    outsideTail: true,
    count: webViews,
    meta: { gap: 6, end: 8, drop: 18 },
  },
  // CommentButton.scss: 8 px above and under a 34 px line with its 1 px line on top, 10 px
  // before the 25 px icon (web.css) and 14 px after it, the 24 px arrow 4 px from the end.
  comments: {
    height: 51,
    padStart: 10,
    padEnd: 4,
    padY: 8,
    fontSize: 15,
    fontWeight: 500,
    icons: true,
    iconSize: 24,
    textGap: 14,
    minBubbleWidth: 0,
    label: webComments,
  },
  // WebPage.scss:1-20 in a PeerColorWrapper (padding 0.5625rem after the bar, 0.375rem at the end).
  webpage: {
    padding: '3px 6px 3px 9px',
    radius: 4,
    fontSize: 15,
    lineHeight: 1.2,
    barWidth: 3,
    top: 4,
    // The small picture, 5rem square (WebPage.scss:152-154); its place, its corners and the text's
    // room beside it are in web.css (RVW-29c).
    thumb: 80,
    metaInside: false,
  },
  peer: {
    palette: webPalette,
    title: false,
    quote: true,
    quoteLinks: false,
    // The bar and the language; the block keeps the code fill (web.css).
    code: true,
    inlineCode: false,
    linkPreview: true,
    comments: true,
    alpha: 0.1,
  },
  // The floating pill (MiddleHeader.scss:3-27,125-264): 3rem tall with 0.25rem padding, 1rem
  // from the column's top and sides, radius 2rem; the avatar 40 px, 10 px before the title
  // (18 px on 24 px lines) over the status (14 px on 18 px lines).
  header: {
    height: 48,
    avatar: 40,
    titleSize: 18,
    titleWeight: 500,
    titleLineHeight: 24 / 18,
    subSize: 14,
    subLineHeight: 18 / 14,
    centered: false,
    gap: 10,
    padX: 4,
    radius: 32,
    float: { top: 16, side: 16 },
    fade: 0,
    back: false,
    menu: false,
    buttonSize: 40,
    // One letter, 17 px, bold in Nunito ExtraBold, the rounded stack (Avatar.scss:21-26, index.scss:20).
    initials: webAInitial,
    initial: {
      size: 17,
      weight: 700,
      font: `${lookFonts.web.avatar}, "Roboto Variable", Roboto, "Helvetica Neue", sans-serif`,
    },
    subscribers: subscribersLabel,
  },
  hour12: false,
  messageDir: false,
  // InlineButtons.module.scss and Button.scss:296-304: 2.25rem buttons 2 px apart all round, the
  // first row 4 px under the bubble, 7 px padding, 14 px text on lines of 1.25; the corners 6 px,
  // the last row's outer ones 15; a link's arrow 12 px at 2 px from the corner (a copy button's
  // mark in web.css); a style laid at 50 % over the fill.
  keyboard: {
    wrap: false,
    height: 36,
    gap: 4,
    rowGap: 4,
    top: 4,
    overhang: 0,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.25,
    padX: 7,
    radius: 6,
    lastRowRadius: 15,
    iconSize: 12,
    iconTop: 2,
    iconEnd: 2,
    styleAlpha: 0.5,
    maxWidth: null,
  },
  // The private chat (PRV-02), read from the app and not measured yet (calibrate: O-02): the
  // 900 px window; own messages on the right in the column's padding, the tail in it; the date's
  // pill; "typing" with its dots after it; the floating composer 3rem tall, 1rem over the bottom
  // and in from the sides, with its round send button beside it (the 72 px under the list,
  // wallpaper/web.ts); the bottom keyboard a menu over the chat; the callback's toast at the top
  // and its alert a dialog under the bot's name; the empty chat's card and START on the
  // composer's plate; the commands menu over the composer, each command before its description.
  chat: {
    height: 900,
    gap: 6,
    out: { marginLeft: 16, marginRight: 18, checkWidth: 16, checkHeight: 11 },
    service: { height: 26, padX: 8, radius: 13, fontSize: 15, fontWeight: 500, margin: 8 },
    status: { bot: 'bot', dots: 'after' },
    composer: {
      height: 48,
      float: { side: 16, bottom: 16 },
      radius: 15,
      padX: 4,
      fontSize: 16,
      iconSize: 24,
      gap: 0,
      parts: ['menu', 'emoji', 'field', 'keyboard', 'attach'],
      send: 48,
      placeholder: 'Message',
    },
    menuButton: { height: 32, padX: 10, radius: 16, fontSize: 15, fontWeight: 500, label: 'Menu' },
    replyKeyboard: {
      over: true,
      height: 240,
      padding: 8,
      gap: 4,
      buttonHeight: 40,
      radius: 8,
      fontSize: 15,
      fontWeight: 500,
    },
    toast: { place: 'top', offset: 12, radius: 10, padding: '10px 16px', fontSize: 15, maxWidth: 420 },
    alert: {
      width: 360,
      radius: 16,
      padding: '20px 20px 12px',
      fontSize: 16,
      title: true,
      titleSize: 20,
      button: 'OK',
      buttonSize: 16,
      buttonAlign: 'end',
    },
    empty: {
      width: 320,
      radius: 15,
      padding: '12px 16px',
      title: 'What can this bot do?',
      titleSize: 16,
      fontSize: 16,
      gap: 6,
    },
    start: { height: 48, label: 'Start', fontSize: 16, fontWeight: 500, uppercase: true, filled: false, radius: 15 },
    commands: {
      rowHeight: 48,
      avatar: 32,
      fontSize: 16,
      subSize: 14,
      padX: 12,
      radius: 15,
      rows: 5,
      commandFirst: true,
    },
  },
  // Polls and quizzes, paid media and dice (MSG-03), read from the app and not measured yet
  // (calibrate: O-02): the question over the type line, round marks before the options, a line
  // under each option until the vote, then the percentage, the bar and the footer's count.
  poll: {
    questionSize: 16,
    questionWeight: 500,
    typeSize: 14,
    typeGap: 8,
    optionSize: 16,
    optionHeight: 36,
    optionGap: 4,
    mark: 20,
    markGap: 12,
    bar: 4,
    footerHeight: 32,
    footerSize: 14,
    right: '#4fae4e',
    wrong: '#e53935',
    labels: pollLabels,
  },
  paid: {
    blur: 24,
    height: 36,
    padX: 14,
    radius: 18,
    fontSize: 15,
    fontWeight: 500,
    label: unlockLabel,
  },
  dice: { size: 160 },
  // Invoices and their payment sheet (PAY-02), read from the app and not measured yet (calibrate:
  // O-02): the title over the description, then the photo with the price in the pill over media.
  invoice: {
    titleSize: 16,
    titleWeight: 500,
    priceSize: 14,
    label: 'INVOICE',
    sheet: { radius: 12, ...sheetLabels },
  },
  // The pinned bar, a gift's card and Restart (EVT-02): read from the app, calibrate: O-02.
  events: {
    pinned: {
      height: 44,
      gap: 8,
      radius: 16,
      padX: 12,
      line: 2,
      title: eventLabels.pinned,
      titleSize: 14,
      fontSize: 14,
    },
    gift: {
      width: 220,
      radius: 16,
      padding: '14px 16px',
      picture: 88,
      titleSize: 15,
      title: eventLabels.gift,
      fontSize: 14,
      button: eventLabels.view,
    },
    restart: eventLabels.restart,
  },
  // Telegram's art for Web A (art/icons.ts): the icon font's pictures, drawn N px for an N px glyph.
  icons: {
    views: 'var(--tg-art-views)',
    share: 'var(--tg-art-share)',
    comments: 'var(--tg-art-comments)',
    commentsArrow: 'var(--tg-art-comments-arrow)',
    link: 'var(--tg-art-link)',
    copy: 'var(--tg-art-copy)',
    quote: 'var(--tg-art-quote)',
    quoteExpand: 'var(--tg-art-quote-expand)',
    codeCopy: null,
    play: null,
    back: null,
    menu: null,
  },
  // themes.json, _variables.scss and the parts' own stylesheets (sheet section 2.2 and 3).
  light: {
    bubble: '#ffffff',
    text: '#000000',
    link: '#3390ec',
    meta: 'rgba(104, 108, 114, 0.75)',
    views: 'rgba(104, 108, 114, 0.75)',
    accent: '#3390ec',
    codeText: '#4a729a',
    codeBg: 'rgba(112, 117, 121, 0.08)',
    preBg: 'rgba(112, 117, 121, 0.08)',
    preText: '#000000',
    preBar: '#3390ec',
    preHeaderBg: 'transparent',
    preLabel: '#3390ec',
    preIcon: '#3390ec',
    quoteBg: 'rgba(51, 144, 236, 0.1)',
    quoteBar: '#3390ec',
    webpageBg: 'rgba(51, 144, 236, 0.1)',
    webpageAccent: '#3390ec',
    spoilerDots: '#000000',
    header: '#ffffff',
    headerText: '#000000',
    headerSubtext: '#707579',
    headerBorder: 'transparent',
    headerShadow: '0 1px 5px -1px rgba(0, 0, 0, 0.21)',
    headerIcon: '#707579',
    headerButton: 'transparent',
    headerFade: 'transparent',
    share: actionLight,
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: '#72727240',
    // The tail's own shadow color, the same in both themes (MessageAppendix.tsx:12-18).
    tailShadow: 'rgba(16, 35, 47, 0.15)',
    mediaMetaBg: 'rgba(0, 0, 0, 0.2)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: actionLight,
    mediaShade: 'transparent',
    durationBg: 'rgba(0, 0, 0, 0.25)',
    durationText: '#ffffff',
    // The circle at 25 % black and the whole control at 70 % (media.module.scss:120-135).
    playBg: 'rgba(0, 0, 0, 0.175)',
    playIcon: 'rgba(255, 255, 255, 0.7)',
    reactionBg: '#ebf3fd',
    reactionText: '#3390ec',
    reactionOutsideBg: actionLight,
    reactionOutsideText: '#ffffff',
    commentsText: '#3390ec',
    commentsIcon: '#3390ec',
    commentsBorder: '#dadce0',
    button: actionLight,
    buttonText: '#ffffff',
    buttonSuccess: '#00c73e',
    buttonPrimary: '#3390ec',
    buttonDanger: '#e53935',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#eeffde',
    outText: '#000000',
    outLink: '#3390ec',
    outMeta: '#4fae4e',
    outCheck: '#4fae4e',
    outOutline: 'transparent',
    outShadow: '#72727240',
    serviceBg: '#4a8e3a8c',
    serviceText: '#ffffff',
    typing: '#3390ec',
    composer: '#ffffff',
    composerText: '#000000',
    composerPlaceholder: '#a2acb4',
    composerIcon: '#707579',
    composerBorder: 'transparent',
    send: '#3390ec',
    menuButton: '#3390ec',
    menuButtonText: '#ffffff',
    replyPanel: '#ffffff',
    replyButton: '#f4f4f5',
    replyButtonText: '#000000',
    replyButtonShadow: 'none',
    toast: 'rgba(0, 0, 0, 0.75)',
    toastText: '#ffffff',
    alert: '#ffffff',
    alertText: '#000000',
    alertButton: '#3390ec',
    scrim: 'rgba(0, 0, 0, 0.25)',
    empty: '#ffffff',
    emptyText: '#000000',
    start: '#3390ec',
    startText: '#3390ec',
    commands: '#ffffff',
    commandsText: '#000000',
    commandsSubtext: '#707579',
  },
  dark: {
    bubble: '#212121',
    text: '#ffffff',
    link: '#8774e1',
    // The source has no dark value for the info row (MessageMeta.scss:98, _variables.scss:46,89).
    meta: 'rgba(104, 108, 114, 0.75)',
    views: 'rgba(104, 108, 114, 0.75)',
    accent: '#8774e1',
    codeText: '#8774e1',
    codeBg: 'rgba(0, 0, 0, 0.5)',
    preBg: 'rgba(0, 0, 0, 0.5)',
    preText: '#ffffff',
    preBar: '#8774e1',
    preHeaderBg: 'transparent',
    preLabel: '#8774e1',
    preIcon: '#8774e1',
    quoteBg: 'rgba(135, 116, 225, 0.1)',
    quoteBar: '#8774e1',
    webpageBg: 'rgba(135, 116, 225, 0.1)',
    webpageAccent: '#8774e1',
    spoilerDots: '#ffffff',
    header: '#212121',
    headerText: '#ffffff',
    headerSubtext: '#aaaaaa',
    headerBorder: 'transparent',
    headerShadow: '0 1px 5px -1px rgba(0, 0, 0, 0.21)',
    headerIcon: '#aaaaaa',
    headerButton: 'transparent',
    headerFade: 'transparent',
    share: actionDark,
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: '#1010109c',
    tailShadow: 'rgba(16, 35, 47, 0.15)',
    mediaMetaBg: 'rgba(0, 0, 0, 0.2)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: actionDark,
    mediaShade: 'transparent',
    durationBg: 'rgba(0, 0, 0, 0.25)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.175)',
    playIcon: 'rgba(255, 255, 255, 0.7)',
    reactionBg: 'rgba(255, 255, 255, 0.1)',
    reactionText: '#ffffff',
    reactionOutsideBg: actionDark,
    reactionOutsideText: '#ffffff',
    commentsText: '#8774e1',
    commentsIcon: '#8774e1',
    commentsBorder: '#303030',
    button: actionDark,
    buttonText: '#ffffff',
    buttonSuccess: '#00c73e',
    buttonPrimary: '#8774e1',
    buttonDanger: '#e53935',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#8774e1',
    outText: '#ffffff',
    outLink: '#ffffff',
    outMeta: 'rgba(255, 255, 255, 0.6)',
    outCheck: '#ffffff',
    outOutline: 'transparent',
    outShadow: '#1010109c',
    serviceBg: '#0a0a0a8c',
    serviceText: '#ffffff',
    typing: '#8774e1',
    composer: '#212121',
    composerText: '#ffffff',
    composerPlaceholder: '#707579',
    composerIcon: '#aaaaaa',
    composerBorder: 'transparent',
    send: '#8774e1',
    menuButton: '#8774e1',
    menuButtonText: '#ffffff',
    replyPanel: '#212121',
    replyButton: '#2c2c2c',
    replyButtonText: '#ffffff',
    replyButtonShadow: 'none',
    toast: 'rgba(0, 0, 0, 0.75)',
    toastText: '#ffffff',
    alert: '#212121',
    alertText: '#ffffff',
    alertButton: '#8774e1',
    scrim: 'rgba(0, 0, 0, 0.5)',
    empty: '#212121',
    emptyText: '#ffffff',
    start: '#8774e1',
    startText: '#8774e1',
    commands: '#212121',
    commandsText: '#ffffff',
    commandsSubtext: '#aaaaaa',
  },
}
