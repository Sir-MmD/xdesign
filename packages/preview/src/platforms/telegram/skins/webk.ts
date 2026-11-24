import { webkAlbumLayout } from '../albumLayout.webk'
import { codeLanguage } from '../codeLanguages'
import { lookFonts } from '../fonts'
import type { PeerColor, PeerPalette } from '../peerColors'
import { webkCount, webkInitials } from '../time'
import { eventLabels, pollLabels, sheetLabels, subscribersLabel, unlockLabel } from './labels'
import type { MediaBoxFn, SkinTokens } from './tokens'

/**
 * Telegram Web K (web.telegram.org/k, morethanwords/tweb 2.2 (680), commit 1da254b), the fifth
 * look (docs/plan/29-owner-list-2026-10-22.md sections 8.4 and 8.5, D-6244; stored as `webk`,
 * D-6271), light = the `day` theme and dark = `night`, at the app's text size 16 in a
 * 1440 x 900 window: every value from its measurement sheet .dev/upd29/tg/web-k.md, which names
 * each one's source file and line (TGP-04). The frame is 728 wide, the app's 696 px chat column
 * with its 16 px gutters; webk.css draws what the tokens cannot: the narrow window's gutters,
 * the code block's header, the parts the app places its own way.
 */

/**
 * The wallpaper's highlight colour (web-k.md section 7.4: the average of the default gradient
 * through highlightingColor.ts): the buttons under the post, the share button, reactions on the
 * wallpaper and the pill under big emoji.
 */
const highlight = { light: 'rgba(90, 152, 66, 0.4)', dark: 'rgba(119, 48, 144, 0.4)' }

/** A peer colour: the avatar's vertical gradient (base.scss:188-194) and the colour, the same in dark (web-k.md open point 3). */
function peer(top: string, bottom: string, tint: string): PeerColor {
  return { avatar: { light: [top, bottom], dark: [top, bottom] }, tint: { light: tint, dark: tint } }
}

/** Web K's seven peer colours (getPeerColorById.ts:8), red to pink. */
const webkPeerPalette: PeerPalette = [
  peer('#ff845e', '#d45246', '#cc5049'),
  peer('#febb5b', '#f68136', '#d67722'),
  peer('#b694f9', '#6c61df', '#955cdb'),
  peer('#9ad164', '#46ba43', '#40a920'),
  peer('#53edd6', '#28c9b7', '#309eba'),
  peer('#5caffa', '#408acf', '#368ad1'),
  peer('#ff8aac', '#d95574', '#c7508b'),
]

/** formatNumber(views, 1) (formatNumber.ts:1-15): 1234 "1.2K", 1000 "1K", 15300 "15.3K", then M, B and T. */
function webkViews(count: number): string {
  if (count <= 0) return String(Math.max(count, 0))
  const units = ['', 'K', 'M', 'B', 'T']
  const i = Math.max(0, Math.min(Math.floor(Math.log(count) / Math.log(1000)), units.length - 1))
  return `${String(Number.parseFloat((count / 1000 ** i).toFixed(1)))}${units[i] ?? ''}`
}

/**
 * "12 345 subscribers", "1 subscriber": the thousands joined by a no-break space
 * (numberThousandSplitter.ts:4-11, lang.ts:4693-4696); the preview's "channel" when the count
 * is unknown.
 */
function webkSubscribers(count: number | undefined): string {
  if (count === undefined) return subscribersLabel(count)
  const digits = String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${digits} ${count === 1 ? 'subscriber' : 'subscribers'}`
}

/** "12 Comments", "1 Comment", "Leave a comment" (lang.ts:1688-1691, 2131); the count is not shortened. */
function webkComments(count: number): string {
  if (count <= 0) return 'Leave a comment'
  return `${String(count)} ${count === 1 ? 'Comment' : 'Comments'}`
}

/** The browser's clock, which tweb follows (getTimeFormat.ts:2-13): 12-hour on an English (US) system. */
function browserHour12(): boolean {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 === true
  } catch {
    return false
  }
}

/** calcImageInBox.ts:11-35: the picture fitted into the box (not enlarged with noZoom), its sides cut to whole pixels. */
function imageInBox(
  w: number,
  h: number,
  boxW: number,
  boxH: number,
  noZoom: boolean,
): { width: number; height: number } {
  if (w < boxW && h < boxH && noZoom) return { width: w, height: h }
  let width = boxW
  let height = boxH
  if (w / h > boxW / boxH) {
    height = Math.trunc((h * boxW) / w)
  } else {
    width = Math.trunc((w * boxH) / h)
    if (width > boxW) {
      height = Math.trunc((height * boxW) / width)
      width = boxW
    }
  }
  if (noZoom && width >= w && height >= h) return { width: w, height: h }
  return { width, height }
}

/**
 * A single photo or video (setAttachmentSize.ts:44-101, web-k.md section 4.14): fitted into
 * 420 x 400 (340 x 340 in a window of 600 px or less) without enlarging; when both sides are
 * under 200, enlarged to fit 200 x 200; at least 320 wide with a caption or the comments bar,
 * and at least 120 wide; a box wider than the picture shows it centred over its blurred copy
 * (photo.ts:140-186). The box is never wider than the bubble (the attachment's max-width: 100%),
 * and the 1 px border in the bubble's colour (media.inset) is inside it, as in the app.
 */
const webkMediaBox: MediaBoxFn = (m, { skin, bubbleMax, frameWidth, caption, comments }) => {
  const maxWidth = Math.min(skin.media.maxWidth(frameWidth), bubbleMax)
  const w = m.width > 0 ? m.width : 100
  const h = m.height > 0 ? m.height : 100
  let picture = imageInBox(w, h, maxWidth, skin.media.maxHeight(frameWidth), true)
  if (picture.width < 200 && picture.height < 200) picture = imageInBox(picture.width, picture.height, 200, 200, false)
  if (picture.width > maxWidth) {
    picture = { width: maxWidth, height: (picture.height * maxWidth) / picture.width }
  }
  let width = picture.width
  if ((caption.length > 0 || comments) && width < 320) width = 320
  width = Math.min(Math.max(width, skin.media.minWidth), maxWidth)
  const inset = 2 * skin.media.inset
  const blur = width > picture.width
  return {
    width: width - inset,
    height: picture.height - inset,
    imageWidth: blur ? picture.width : width - inset,
    imageHeight: blur ? picture.height : picture.height - inset,
    blur,
  }
}

export const webk: SkinTokens = {
  id: 'webk',
  label: 'Web K',
  // The 696 px chat column and its 16 px gutters (updateColumnWidths.ts:87-97).
  frameWidth: 728,
  // The messages start 8 under the top bar, where the app's fade at the top of the chat ends
  // (--bubbles-scrollable-fade-top, _chat.scss:1312); the last one keeps 6 under it
  // ($bubble-margin-big, _chatBubble.scss:743-744).
  list: { top: 8, bottom: 6 },
  // The chat column (min(w - 32, 696), w - 16 in a window of 600 px or less) less the share
  // button's room beside a channel post (38 + 8), or less 89 on a phone (_chat.scss:1500-1507,
  // base.scss:92-94, _chatBubble.scss:216-224, updateColumnWidths.ts:97, 314).
  bubbleMaxWidth: (w) => (w > 600 ? Math.min(w - 32, 696) - 46 : w - 16 - 89),
  bubbleMinWidth: 56,
  bubbleMinHeight: 0,
  // The column's gutters (8 in a window of 600 px or less: webk.css).
  bubbleMarginLeft: 16,
  bubbleMarginRight: 16,
  bubbleShadow: { y: 1, blur: 2, spread: 0 },
  outlineWidth: 0,
  // The app's stack (base.scss:137, 571) with the panel's Roboto first; Persian falls to the
  // system font there, which Vazirmatn stands in for where no system stack font has it.
  fontFamily:
    '"Roboto Variable", Roboto, -apple-system, "Apple Color Emoji", BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", "Vazirmatn Variable", sans-serif',
  fontSize: 16,
  lineHeight: 1.3125,
  boldWeight: 500,
  links: { underline: true },
  // Emoji images 18 x 18 in the middle of the line (base.scss:1053-1064); premium emoji 16 + 4.
  emoji: { scale: 1.125, customScale: 1.25, gap: 0, align: 'middle' },
  // One to seven emoji: 96, 90, 84, 72, 60, 48, then 36 for any more (bubbles.ts:484-492,
  // 8986-8996); one emoji is the app's 112 px sticker, drawn with Apple's image (the lead's rule).
  bigEmoji: {
    rule: 'loose',
    single: null,
    size: ({ count }) => (count <= 1 ? 112 : ([90, 84, 72, 60, 48][count - 2] ?? 36)),
  },
  title: { show: false, size: 14, weight: 500, lineHeight: 1.25, gap: 4, mediaGap: 4 },
  metaFontSize: 12,
  meta: {
    right: 8,
    bottom: 4,
    height: 12,
    padding: 0,
    iconSize: 18,
    iconGap: 6,
    countGap: 2,
    timeGap: 0,
    viewsFirst: true,
    rtl: 'anyChar',
    form: 'joined',
    views: webkViews,
    hour: '2-digit',
    reserve: 5,
    dropHeight: 12,
    overlay: { right: 3, bottom: 3, height: 18, padStart: 5, padEnd: 5, radius: 12 },
  },
  // footer: the text's bottom margin stays before the comments bar; reactions start 3 under the
  // last line (reactions.top).
  padding: { top: 4, right: 8, bottom: 5, left: 8, footer: 5 },
  caption: { top: 2, bottom: 5, footer: 5 },
  radius: { main: 15, small: 5, aboveKeyboard: 5 },
  // The tail symbol of index.html:64-68 flattened, drawn 11 x 20 at -8.4 and 1 px below the
  // bubble (utils.ts:43-63, _chatBubble.scss:2125-2137, 3479-3481); it stays above the buttons
  // and under media without a caption, and casts no shadow.
  tail: {
    path: 'M3 19h6V2c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 0 0 3 19z',
    viewBox: '0 0 9 20',
    width: 9,
    height: 20,
    left: -8.4,
    bottom: -1,
    squareCorner: true,
    aboveKeyboard: true,
    underMedia: true,
    shadow: { y: 0, blur: 0 },
  },
  quote: {
    collapsedLines: 3,
    barWidth: 3,
    radius: 4,
    padStart: 9,
    padEnd: 18,
    padBlock: 2,
    padY: 1,
    fontSizeDelta: -2,
    lineHeight: 18,
    fade: 0,
    icon: { width: 11, height: 11, top: 2, end: 3 },
    expand: { width: 16, height: 16, end: 0, bottom: 0 },
    // Its arrow only when the text is cut (_quote.scss:73-122); each quote faces its own text's
    // way (dir="auto", wrapRichText.ts:883-905).
    foldLong: true,
    direction: 'own',
    wideAt: null,
    first: null,
  },
  code: {
    fontFamily: `${lookFonts.webk.code}, "Roboto Mono", monospace`,
    fontSize: 16,
    blockFontSize: 14,
    lineHeight: 19 / 14,
    radius: 4,
    inlinePadding: '0',
    blockPadding: '4px 10px',
    blockMargin: 4,
    barWidth: 3,
    header: { fontSize: 14, fontWeight: 500, padding: '1px 1px 1px 10px', mono: false, height: null },
    noLanguage: 'copy',
    copyMark: true,
    wideBubble: null,
    // Prism's name of the language, "copy" for one it does not know (wrapRichText.ts:349-355).
    language: codeLanguage.webk,
    sizes: null,
    copyBar: null,
    first: null,
  },
  // Rich posts are spaced in webk.css; their lists and tables were not read (web-k.md section 10).
  rich: { gap: null, marker: null, tableRadius: 0 },
  // Particles of radius 1.6, about one per 25 px² (dotRendererCore.ts:32-50): their still frame
  // as a 5 px grid (an estimate).
  spoiler: { dot: 1.6, cell: 5, radius: 0 },
  media: {
    maxWidth: (w) => (w > 600 ? 420 : 340),
    maxHeight: (w) => (w > 600 ? 400 : 340),
    minWidth: 120,
    minHeight: 0,
    radius: 15,
    captionRadius: 0,
    inset: 1,
    sampleTail: false,
    blurFill: true,
    box: webkMediaBox,
  },
  duration: { top: 3, left: 3, height: 18, padX: 6, radius: 18, fontSize: 12, pad: null, gif: 'GIF' },
  play: { size: 54, iconSize: 34 },
  album: { gap: 1, inset: 0, layout: webkAlbumLayout },
  shareButton: { size: 38, gap: 8, bottom: 0, iconSize: 20, hover: true },
  // A pill of 22 + 8 with the counter's 1 px end margin in its end padding (_reaction.scss:81-94,
  // 210-224); Apple's emoji at 20 in the 22 px box (the app's clipped sticker, an estimate).
  reactions: {
    height: 30,
    radius: 15,
    padStart: 8,
    padEnd: 9,
    emoji: 20,
    emojiGap: 6,
    fontSize: 15,
    fontWeight: 500,
    gap: 6,
    rowGap: 6,
    top: -2,
    outside: true,
    outsideTail: true,
    count: webkCount,
    meta: { gap: 5, end: 0, drop: 14 },
  },
  comments: {
    height: 49,
    padStart: 8,
    padEnd: 8,
    padY: 0,
    fontSize: 15,
    fontWeight: 500,
    icons: true,
    iconSize: 24,
    textGap: 14,
    minBubbleWidth: 240,
    label: webkComments,
  },
  webpage: {
    padding: '4px 6px 4px 9px',
    radius: 4,
    fontSize: 14,
    lineHeight: 18 / 14,
    barWidth: 3,
    top: 4,
    thumb: 48,
    metaInside: false,
  },
  // The channel's colour on quotes, code and the link preview (bubbles.ts:10954-10961); links,
  // the comments bar and reactions stay in the accent.
  peer: {
    palette: webkPeerPalette,
    title: false,
    quote: true,
    quoteLinks: false,
    code: true,
    inlineCode: true,
    linkPreview: true,
    comments: false,
    alpha: 0.1,
  },
  // A plate floating 16 from the top and the column's sides (_chatTopbar.scss:43-69, 125-211).
  header: {
    height: 48,
    avatar: 40,
    titleSize: 16,
    titleWeight: 500,
    titleLineHeight: 24 / 16,
    subSize: 14,
    subLineHeight: 1.3125,
    centered: false,
    gap: 16,
    padX: 4,
    radius: 24,
    float: { top: 16, side: 16 },
    fade: 0,
    back: false,
    menu: false,
    buttonSize: 40,
    initials: webkInitials,
    initial: { size: 14.81, weight: 500, font: null },
    subscribers: webkSubscribers,
  },
  hour12: browserHour12(),
  messageDir: true,
  // Rows 2 apart and 1 + 2 under the bubble, buttons 40 high and 2 apart without side padding
  // (_chatBubble.scss:3775-3838, _chatVariables.scss:12-17).
  keyboard: {
    wrap: true,
    height: 40,
    gap: 2,
    rowGap: 2,
    top: 3,
    overhang: 0,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.3125,
    padX: 0,
    radius: 6,
    lastRowRadius: 24,
    iconSize: 14,
    iconTop: 2,
    iconEnd: 2,
    styleAlpha: 1,
    maxWidth: null,
  },
  // The private chat (PRV-02), read from the app and not measured yet (calibrate: O-02): the
  // 900 px window; own messages on the right; the service line's pill in the wallpaper's
  // highlight; "typing" with its dots after it; the input's plate 3.375rem tall over the bottom
  // with its round send button beside it (the 64 px under the list, wallpaper/webk.ts); the
  // bottom keyboard a panel over the chat; the toast at the bottom and the alert a popup under the
  // bot's name; the empty chat's card and START on the input's plate; the commands over the
  // input, each description before its command.
  chat: {
    height: 900,
    gap: 6,
    out: { marginLeft: 16, marginRight: 16, checkWidth: 16, checkHeight: 11 },
    service: { height: 24, padX: 10, radius: 12, fontSize: 15, fontWeight: 500, margin: 8 },
    status: { bot: 'bot', dots: 'after' },
    composer: {
      height: 54,
      float: { side: 16, bottom: 10 },
      radius: 12,
      padX: 4,
      fontSize: 16,
      iconSize: 24,
      gap: 0,
      parts: ['menu', 'emoji', 'field', 'keyboard', 'attach'],
      send: 54,
      placeholder: 'Message',
    },
    menuButton: { height: 32, padX: 10, radius: 16, fontSize: 15, fontWeight: 500, label: 'Menu' },
    replyKeyboard: {
      over: true,
      height: 240,
      padding: 8,
      gap: 6,
      buttonHeight: 42,
      radius: 10,
      fontSize: 15,
      fontWeight: 500,
    },
    toast: { place: 'bottom', offset: 12, radius: 8, padding: '10px 16px', fontSize: 15, maxWidth: 420 },
    alert: {
      width: 320,
      radius: 12,
      padding: '20px 20px 10px',
      fontSize: 16,
      title: true,
      titleSize: 20,
      button: 'OK',
      buttonSize: 15,
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
    start: { height: 54, label: 'Start', fontSize: 16, fontWeight: 500, uppercase: true, filled: false, radius: 12 },
    commands: {
      rowHeight: 56,
      avatar: 42,
      fontSize: 16,
      subSize: 14,
      padX: 12,
      radius: 12,
      rows: 5,
      commandFirst: false,
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
    wrong: '#df3f40',
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
    sheet: { radius: 10, ...sheetLabels },
  },
  // The pinned bar, a gift's card and Restart (EVT-02): read from the app, calibrate: O-02.
  events: {
    pinned: {
      height: 44,
      gap: 8,
      radius: 24,
      padX: 16,
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
  icons: {
    views: 'var(--tg-art-views)',
    share: 'var(--tg-art-share)',
    comments: 'var(--tg-art-comments)',
    commentsArrow: 'var(--tg-art-comments-arrow)',
    link: 'var(--tg-art-link)',
    copy: 'var(--tg-art-copy)',
    quote: 'var(--tg-art-quote)',
    quoteExpand: 'var(--tg-art-quote-expand)',
    codeCopy: 'var(--tg-art-code-copy)',
    play: 'var(--tg-art-play)',
    back: null,
    menu: null,
  },
  light: {
    bubble: '#ffffff',
    text: '#000000',
    link: '#3390ec',
    meta: '#707579',
    views: '#707579',
    accent: '#3390ec',
    codeText: '#3390ec',
    codeBg: 'transparent',
    preBg: 'rgba(51, 144, 236, 0.1)',
    preText: '#000000',
    preBar: '#3390ec',
    preHeaderBg: 'transparent',
    preLabel: '#3390ec',
    preIcon: '#3390ec',
    quoteBg: 'rgba(51, 144, 236, 0.1)',
    quoteBar: '#3390ec',
    webpageBg: 'rgba(51, 144, 236, 0.1)',
    webpageAccent: '#3390ec',
    spoilerDots: '#101010',
    header: '#ffffff',
    headerText: '#000000',
    headerSubtext: '#707579',
    headerBorder: 'transparent',
    headerShadow: '0 1px 5px -1px rgba(0, 0, 0, 0.21)',
    headerIcon: '#707579',
    headerButton: 'transparent',
    headerFade: 'transparent',
    share: highlight.light,
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: 'rgba(16, 35, 47, 0.15)',
    tailShadow: 'transparent',
    mediaMetaBg: 'rgba(0, 0, 0, 0.35)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: highlight.light,
    // The blurred copy at 0.8 over black (_chatBubble.scss:965-975, 2102-2104).
    mediaShade: 'rgba(0, 0, 0, 0.2)',
    durationBg: 'rgba(0, 0, 0, 0.35)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.35)',
    playIcon: '#ffffff',
    reactionBg: '#eef6fd',
    reactionText: '#3390ec',
    reactionOutsideBg: highlight.light,
    reactionOutsideText: '#ffffff',
    commentsText: '#3390ec',
    commentsIcon: '#3390ec',
    commentsBorder: '#dfe1e5',
    button: highlight.light,
    buttonText: '#ffffff',
    buttonSuccess: 'rgba(112, 183, 104, 0.8)',
    buttonPrimary: 'rgba(51, 144, 236, 0.8)',
    buttonDanger: 'rgba(223, 63, 64, 0.8)',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#eeffde',
    outText: '#000000',
    outLink: '#3390ec',
    outMeta: '#4fae4e',
    outCheck: '#4fae4e',
    outOutline: 'transparent',
    outShadow: 'rgba(16, 35, 47, 0.15)',
    serviceBg: highlight.light,
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
    toast: 'rgba(0, 0, 0, 0.7)',
    toastText: '#ffffff',
    alert: '#ffffff',
    alertText: '#000000',
    alertButton: '#3390ec',
    scrim: 'rgba(0, 0, 0, 0.3)',
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
    meta: '#aaaaaa',
    views: '#aaaaaa',
    accent: '#8774e1',
    codeText: '#8774e1',
    codeBg: 'transparent',
    preBg: 'rgba(0, 0, 0, 0.8)',
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
    share: highlight.dark,
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: 'rgba(16, 35, 47, 0.15)',
    tailShadow: 'transparent',
    mediaMetaBg: 'rgba(0, 0, 0, 0.35)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: highlight.dark,
    mediaShade: 'rgba(0, 0, 0, 0.2)',
    durationBg: 'rgba(0, 0, 0, 0.35)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.35)',
    playIcon: '#ffffff',
    reactionBg: '#292730',
    reactionText: '#8774e1',
    reactionOutsideBg: highlight.dark,
    reactionOutsideText: '#ffffff',
    commentsText: '#8774e1',
    commentsIcon: '#8774e1',
    commentsBorder: '#0f0f0f',
    button: highlight.dark,
    buttonText: '#ffffff',
    buttonSuccess: 'rgba(92, 200, 94, 0.8)',
    buttonPrimary: 'rgba(135, 116, 225, 0.8)',
    buttonDanger: 'rgba(255, 89, 90, 0.8)',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#8774e1',
    outText: '#ffffff',
    outLink: '#ffffff',
    outMeta: 'rgba(255, 255, 255, 0.6)',
    outCheck: '#ffffff',
    outOutline: 'transparent',
    outShadow: 'rgba(16, 35, 47, 0.15)',
    serviceBg: highlight.dark,
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
    toast: 'rgba(0, 0, 0, 0.7)',
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
