import { androidAlbumLayout } from '../albumLayout.android'
import { codeLanguage } from '../codeLanguages'
import { lookFonts } from '../fonts'
import { androidMediaBox } from '../media.android'
import type { PeerColor, PeerPalette } from '../peerColors'
import { androidCount, androidInitials } from '../time'
import { commentsLabel, eventLabels, pollLabels, sheetLabels, subscribersLabel, unlockLabel } from './labels'
import type { SkinTokens } from './tokens'

/**
 * Telegram for Android 13.0.3 (docs/plan/29-owner-list-2026-10-22.md section 8.4, TGP-06): every
 * value from its measurement sheet .dev/upd29/tg/android.md, which names each one's source
 * (ChatMessageCell, MessageDrawable, Theme and ThemeColors, bluebubbles.attheme and
 * night.attheme), in dp, on the owner's phone: a chat area 384 wide, light the Classic theme
 * (its colours after the accent shift), dark the Night theme. What the tokens cannot draw (the
 * top bar's glass pieces, the share button's place, the fills from the wallpaper, an album's
 * corners, the copy button's icon) is in android.css.
 */

/** The text's line: Roboto's ascent and descent (hhea 1900 + 500 of 2048), 18.75 at 16. */
const robotoLine = 2400 / 2048

/**
 * The view count as Android writes it (LocaleController.formatShortNumber): divided by 1000
 * while above 999, with one decimal cut (not rounded) and shown when it is not 0, "M" for
 * millions; at least 1 (ChatMessageCell.java:18539).
 */
export function androidViews(count: number): string {
  let number = Math.max(1, Math.floor(count))
  let k = ''
  let decimal = 0
  while (Math.floor(number / 1000) > 0) {
    k += 'K'
    decimal = Math.floor((number % 1000) / 100)
    number = Math.floor(number / 1000)
  }
  const unit = k.length === 2 ? 'M' : k
  return decimal !== 0 && k.length > 0 ? `${String(number)}.${String(decimal)}${unit}` : `${String(number)}${unit}`
}

/** A peer colour: the avatar's gradient in Classic and Night, and the name colour in each. */
function peer(light: [string, string], dark: [string, string], tint: [string, string]): PeerColor {
  return { avatar: { light, dark }, tint: { light: tint[0], dark: tint[1] } }
}

/**
 * Android's seven peer colours (red, orange, violet, green, cyan, blue, pink): the avatar's
 * vertical gradient (avatar_background*, avatar_background2*: ThemeColors.java:161-174,
 * night.attheme) and the channel's colour in quotes and link previews (avatar_nameInMessage*:
 * ThemeColors.java:184-190, night.attheme); Classic's cyan and blue after the accent shift.
 */
const androidPalette: PeerPalette = [
  peer(['#ff845e', '#d45246'], ['#dc805b', '#d9614f'], ['#cc5049', '#e88878']),
  peer(['#febb5b', '#f68136'], ['#f2bc64', '#e58943'], ['#d67722', '#e8ab5a']),
  peer(['#b694f9', '#6c61df'], ['#b694f9', '#6c61df'], ['#806dcf', '#8c8dea']),
  peer(['#9ad164', '#46ba43'], ['#9ad164', '#46ba43'], ['#40a920', '#7dd071']),
  peer(['#79c2d7', '#5898c5'], ['#5bcbe3', '#359ad4'], ['#2fa3c9', '#53ccc6']),
  peer(['#7cb0e7', '#5e8bbe'], ['#5caffa', '#408acf'], ['#208dd6', '#5cadea']),
  peer(['#ff8aac', '#d95574'], ['#ff8aac', '#d95574'], ['#d26895', '#e8749a']),
]

/**
 * A message of emoji only has no bubble (MessageObject TYPE_EMOJIS): its emoji's box is the
 * paint's size and 4 (Theme.java:8027-8031, MessageObject.java:2110-2160), 44.8 for two, 37.6
 * for three, 30.4 for four and 26.8 for five or more; a single emoji is drawn as Telegram's
 * animated emoji sticker (MessageObject.java:1985-2011), 0.5 x the chat width x the server's
 * zoom 0.625 (ChatMessageCell.java:9675-9686), 120 on the owner's phone: Apple's image at that
 * size (the lead's rule for the apps' stickers).
 */
function androidBigEmoji({ count }: { count: number }): number {
  if (count === 1) return 120
  if (count === 2) return 44.8
  if (count === 3) return 37.6
  if (count === 4) return 30.4
  return 26.8
}

/**
 * A code block's sizes by its code's length (MessageObject.java:8908-8916, Theme.java:8049-8051):
 * the code 14, 13 above 80 characters and 11 above 220; its language 15 less half of
 * CodeHighlighting's step (2, 3 above 50 and 5 above 120 characters, in whole points:
 * CodeHighlighting.java:46-50), in a strip 1.714 times as tall and 4 (MessageObject.java:1080-1085).
 */
function androidCodeSizes(length: number): { fontSize: number; headerSize: number; headerHeight: number } {
  const step = length > 120 ? 5 : length > 50 ? 3 : 2
  const headerSize = 15 - Math.floor(step / 2)
  return { fontSize: length > 220 ? 11 : length > 80 ? 13 : 14, headerSize, headerHeight: headerSize * 1.714 + 4 }
}

export const android: SkinTokens = {
  id: 'android',
  label: 'Android',
  // The owner's phone: 1080 px at density 2.8125 (android.md section 1).
  frameWidth: 384,
  // Under the top bar the list starts 4 below it (ChatActivity.java:12016) and the bubble 3 into
  // its cell; under the post the cell's 3 and the 7 above the bottom bar (ChatActivity.java:12114,
  // the split of its 9 + 7 an estimate).
  list: { top: 7, bottom: 10 },
  // The body: the text's widest column (the width - 94, MessageObject.java:8525-8535) and 11 on
  // each side; a code block widens the column to the width - 60 (code.wideBubble).
  bubbleMaxWidth: (w) => w - 72,
  bubbleMinWidth: 0,
  bubbleMinHeight: 0,
  bubbleMarginLeft: 11,
  // The widest bubble with its share button leaves 19 (11 + (w - 72) + 10 + 32).
  bubbleMarginRight: 19,
  // MessageDrawable's shadow (MessageDrawable.java:366-410): a hairline 1 device px (0.36) down,
  // its CSS form an estimate; about nothing in Night.
  bubbleShadow: { y: 0.36, blur: 0.7, spread: 0 },
  outlineWidth: 0,
  fontFamily: `"Roboto Variable", Roboto, ${lookFonts.android.persian}, sans-serif`,
  fontSize: 16,
  lineHeight: robotoLine,
  // Bold is Roboto Medium (rmedium.ttf, TextStyleSpan.java:96-97); Persian and Arabic draw it
  // with Noto Naskh Arabic UI Bold, so it looks bold (fonts.css, 17 section 12).
  boldWeight: 500,
  links: { underline: false },
  // An emoji's box is the line's ascent and descent (Emoji.java:735-761), on the line's bottom;
  // a premium emoji's the size and 4 (MessageObject.java:2114); no space after either.
  emoji: { scale: robotoLine, customScale: 20 / 16, gap: 0, align: 'bottom' },
  // Emoji only, any count, with spaces, tabs, new lines and FE0F between them and nothing else, a
  // no-break space neither (Emoji.java:474-476, MessageObject.java:6662; RVW-29c).
  bigEmoji: { size: androidBigEmoji, rule: 'spaces', single: { radius: 12, padX: 6 } },
  title: { show: false, size: 14, weight: 500, lineHeight: 1.25, gap: 4, mediaGap: 4 },
  metaFontSize: 12,
  // The info row (android.md 4.3): eye, 3, count, 7, then "Jane, 3:05 PM", ending 11 inside the
  // body's right edge, the time's box (14.06 tall) 3.5 above the body's bottom; it needs the
  // time's width and 6 on the last line (ChatMessageCell.java:7410), else a line of 14 (18
  // after a code block or quote at the end: android.css); right to left text always puts it on
  // its own line (MessageObject.hasRtl).
  meta: {
    right: 11,
    bottom: 3.5,
    height: 12 * robotoLine,
    padding: 0,
    iconSize: 14.33,
    iconGap: 7,
    countGap: 3,
    timeGap: 0,
    viewsFirst: false,
    rtl: 'any',
    form: 'joined',
    views: androidViews,
    hour: 'numeric',
    reserve: 6,
    dropHeight: 14,
    // The pill over media without a caption: 17 tall, radius 8, 6 at each side, 5 from the
    // picture's right and 6 above its bottom (ChatMessageCell.java:24036-24060).
    overlay: { right: 5, bottom: 6, height: 17, padStart: 6, padEnd: 6, radius: 8 },
  },
  // Text at y 8 in its cell, the body from y 3; the body is the text and 11.5 (ChatMessageCell.java:10955-10958).
  padding: { top: 5, right: 11, bottom: 6.5, left: 11, footer: 6.5 },
  // A caption 6 under the picture and 5 above the body's bottom, before the comments bar too (the
  // bubble grows 43 then, ChatMessageCell.java:10942; its sides of 9: android.css).
  caption: { top: 6, bottom: 5, footer: 5 },
  radius: { main: 17, small: 6, aboveKeyboard: 6 },
  // MessageDrawable's tail (MessageDrawable.java:794-796): an elliptic arc from the body's edge
  // 11 above its bottom (radii 6.5 x 10, 83 degrees), 5.4 out at the bottom; kept above inline
  // buttons, none under media without a caption (TYPE_MEDIA).
  tail: {
    path: 'M6 0A6.5 10 0 0 1 .292 9.925L.6 11H6Z',
    viewBox: '0 0 6 11',
    width: 6,
    height: 11,
    left: -6,
    bottom: 0,
    squareCorner: true,
    aboveKeyboard: true,
    underMedia: false,
    shadow: { y: 0.36, blur: 0.7 },
  },
  // A quote (android.md 4.4): text 14 on lines of 14 x Roboto's line, 8 in from its start and
  // 16 short of its end, 5 above its first line and 6 under its last (android.css), 3 from the
  // text around it; folded to 67.2 of text less the 2 above its first line
  // (MessageObject.java:8945), its last 24 fading (ChatMessageCell.java:17101-17107); its
  // mark 16 at 3 from the top-right corner, the arrow 16 at 7 from the end and 6 from the
  // bottom, down while folded (ChatMessageCell.java:16966-17010).
  quote: {
    collapsedLines: (67.2 - 2) / (14 * robotoLine),
    barWidth: 3,
    radius: 5,
    padStart: 8,
    padEnd: 16,
    padBlock: 3,
    padY: 5,
    fontSizeDelta: -2,
    lineHeight: 14 * robotoLine,
    fade: 24,
    icon: { width: 16, height: 16, top: 3, end: 3 },
    expand: { width: 16, height: 16, end: 7, bottom: 6 },
    // Its arrow only when its text is taller than the folded 67.2 (ChatMessageCell.java:16990); the
    // bar on the left whatever the text (ReplyMessageLine.java:542-555); the whole column once its
    // text and 24 are over 70 % of it (ChatMessageCell.java:16943); one that opens the text 1.66
    // lower and its text 2 lower (ChatMessageCell.java:16950, MessageObject.java:8894-8899).
    foldLong: true,
    direction: 'ltr',
    wideAt: 0.7,
    first: { margin: 3 + 1.66, padY: 5 + 0.34 },
  },
  // Code (android.md 4.5): inline code is only the phone's monospace at 15 in the text's colour;
  // a block 14 (13 above 80 characters and 11 above 220: sizes), its text 6 under the language
  // strip and over its bottom, 10 from its start and 9 short of its end, 3 from the text above it
  // (5 below it: android.css); the strip 14 x 1.714 + 4 tall with the language in 14 Roboto
  // Medium 10 from the start (13 above 120 characters; the sheet's 15 and 29.7 took the size
  // step as 0, CodeHighlighting.java:46-50). The phone's Droid Sans Mono line (1.164) is an estimate.
  code: {
    fontFamily: `${lookFonts.android.code}, "Droid Sans Mono", monospace`,
    fontSize: 15,
    blockFontSize: 14,
    lineHeight: 2384 / 2048,
    radius: 5,
    inlinePadding: '0',
    blockPadding: '6px 9px 6px 10px',
    blockMargin: 3,
    barWidth: 3,
    header: { fontSize: 14, fontWeight: 500, padding: '0 9px 0 10px', mono: false, height: 14 * 1.714 + 4 },
    noLanguage: null,
    copyMark: false,
    wideBubble: (w) => w - 38,
    // Android's own names of languages, else only the first letter capital (MessageObject.java:1129-1204).
    language: codeLanguage.android,
    sizes: androidCodeSizes,
    // "COPY CODE" in 13 Medium after msg_copy at 0.8 of 24 and 5, centred in a bar of 38 under code
    // of 75 characters or more (MessageObject.java:1066-1125; its line above it: android.css).
    copyBar: { minLength: 75, height: 38, label: 'COPY CODE', fontSize: 13, fontWeight: 500, iconSize: 19.2, gap: 5 },
    // A block that opens the text starts at the text's top (2 lower, with no 5 before it) and has
    // a top-right corner of 17 / 3 x 2 when it opens the bubble (ChatMessageCell.java:16657-16658,
    // 17035; MessageObject.java:8903).
    first: { margin: 0, radius: (17 / 3) * 2 },
  },
  // Rich posts are not in the sheet: the shared rules.
  rich: { gap: null, marker: null, tableRadius: 0 },
  // SpoilerEffect's particles in the text's colour (android.md 4.6), as a fine grid of dots (estimate).
  spoiler: { dot: 0.65, cell: 2.5, radius: 0 },
  media: {
    maxWidth: (w) => w - 74,
    maxHeight: (w) => 0.7 * w + 100,
    // A photo at least as wide as its info row and 22 (about 115, estimate).
    minWidth: 115,
    minHeight: 120,
    radius: 15,
    // Above a caption: bottom-right 4 (bottom-left 3: android.css).
    captionRadius: 4,
    inset: 2,
    sampleTail: false,
    blurFill: false,
    box: androidMediaBox,
  },
  // A video's duration at its top-left: 4.5 in, 18 tall, 4 at each side, radius 4, 12 white
  // (ChatMessageCell.java:15950-15990).
  duration: { top: 4.5, left: 4.5, height: 18, padX: 4, radius: 4, fontSize: 12, pad: null, gif: 'GIF' },
  play: { size: 44, iconSize: 18 },
  album: { gap: 2, inset: 0, layout: androidAlbumLayout },
  // A 32 circle 10 right of the body with the 24 share icon; its bottom 6 above the body's (or
  // centred beside a short bubble) is drawn by android.css (ChatMessageCell.java:21612-21660).
  shareButton: { size: 32, gap: 10, bottom: 0, iconSize: 24, hover: false },
  // Reactions under the text (android.md 4.11): 26 tall, radius 13, the emoji 20 at 8, 4 to the
  // count in 12 Roboto Medium, 8 after it; 4 apart both ways (ReactionsLayoutInBubble.java:356-393).
  reactions: {
    height: 26,
    radius: 13,
    padStart: 8,
    padEnd: 8,
    emoji: 20,
    emojiGap: 4,
    fontSize: 12,
    fontWeight: 500,
    gap: 4,
    rowGap: 4,
    top: 0,
    outside: false,
    outsideTail: true,
    count: androidCount,
    meta: { gap: 10, end: 0, drop: 14 },
  },
  // The comments bar (android.md 4.10): 43 tall, the 24 icon 12 in, the text in 14 Roboto Medium
  // 11 after it, the 24 arrow 6 from the end (ChatMessageCell.java:23348-23494).
  comments: {
    height: 43,
    padStart: 12,
    padEnd: 6,
    padY: 0,
    fontSize: 14,
    fontWeight: 500,
    icons: true,
    iconSize: 24,
    textGap: 11,
    minBubbleWidth: 0,
    label: commentsLabel,
  },
  // A link preview: the site's name, the title and the description in (16 x 2 + 10) / 3 = 14,
  // the text 10 from the box's left (its 3 px bar in it), 5 under its top and 7 over its bottom,
  // and its lines at most 11.33 from the box's right, the box being 0.33 wider at the left and 1
  // at the right than the text's column (ChatMessageCell.java:7800-8180, 8825-8827, 13858-13878,
  // 15447-15900; RVW-29c); android.css draws the weights, the 2 between the parts, the box's
  // place, a preview without a site's name and the small picture's place.
  webpage: {
    padding: '5px 11.33px 7px 10px',
    radius: 5,
    fontSize: 14,
    lineHeight: robotoLine,
    barWidth: 3,
    top: 4,
    thumb: 48,
    metaInside: false,
  },
  // Quotes, the links in them and link previews take the channel's colour, their fill at 0.10
  // (ReplyMessageLine.java:274-363); code keeps its own grey.
  peer: {
    palette: androidPalette,
    title: false,
    quote: true,
    quoteLinks: true,
    code: false,
    inlineCode: false,
    linkPreview: true,
    comments: false,
    alpha: 0.1,
  },
  // The 13.0.3 glass top bar (android.md 4.2): 56 tall over the chat, with three pieces 46 tall
  // (the back circle at 6, the pill with the avatar and the name centred between, the menu
  // circle 6 from the right: android.css); the avatar 42, the name in 17.5 Roboto Medium over
  // "N subscribers" in 13.5 (ChatAvatarContainer.java:757-786, the weight an estimate).
  header: {
    height: 56,
    avatar: 42,
    titleSize: 17.5,
    titleWeight: 500,
    titleLineHeight: robotoLine,
    subSize: 13.5,
    subLineHeight: robotoLine,
    centered: false,
    gap: 6,
    padX: 6,
    radius: 0,
    float: { top: 0, side: 0 },
    fade: 0,
    back: true,
    menu: true,
    buttonSize: 46,
    initials: androidInitials,
    initial: { size: 18, weight: 500, font: null },
    subscribers: subscribersLabel,
  },
  hour12: true,
  messageDir: false,
  // Inline buttons (android.md 4.7): 44 tall, 5 apart in a row and 4 between rows, 3.5 under the
  // body and 1 past each of its sides, radius 6.75 and 17 at the last row's outer corners; the
  // label in 15 Roboto Medium, 7.5 from each side; the link mark 10 at 3 from the top-right; a
  // style's colour at 0.7 over the fill; the keyboard may grow to the chat width - 15.
  keyboard: {
    wrap: false,
    height: 44,
    gap: 5,
    rowGap: 4,
    top: 3.5,
    overhang: 1,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.2,
    padX: 7.5,
    radius: 6.75,
    lastRowRadius: 17,
    iconSize: 10,
    iconTop: 3,
    iconEnd: 3,
    styleAlpha: 0.7,
    maxWidth: (w) => w - 15,
  },
  // The private chat (PRV-02), read from the app and not measured yet (calibrate: O-02): the
  // owner's 384 x 829 chat area; own messages on the right; the service line's pill in the
  // wallpaper's fill (wallpaper/android.ts fillParts); "typing..." written out; the glass island
  // 44 tall, 9 over the bottom and the gesture bar (the 69 under the list, wallpaper/android.ts)
  // with send in it; the bottom keyboard under it in the system keyboard's place; the toast over
  // the island and the alert a dialog under the bot's name; the empty chat's card in the fill and
  // START on the island; the commands over it, each description before its command.
  chat: {
    height: 829,
    gap: 4,
    out: { marginLeft: 52, marginRight: 11, checkWidth: 15, checkHeight: 10 },
    service: { height: 26, padX: 9, radius: 13, fontSize: 14, fontWeight: 500, margin: 8 },
    status: { bot: 'bot', dots: 'text' },
    composer: {
      height: 44,
      float: { side: 6, bottom: 25 },
      radius: 22,
      padX: 4,
      fontSize: 18,
      iconSize: 24,
      gap: 0,
      parts: ['menu', 'emoji', 'field', 'keyboard', 'attach', 'send'],
      send: null,
      placeholder: 'Message',
    },
    menuButton: { height: 32, padX: 12, radius: 16, fontSize: 15, fontWeight: 500, label: 'Menu' },
    replyKeyboard: {
      over: false,
      height: 248,
      padding: 10,
      gap: 10,
      buttonHeight: 42,
      radius: 4,
      fontSize: 16,
      fontWeight: 400,
    },
    toast: { place: 'bottom', offset: 8, radius: 8, padding: '12px 16px', fontSize: 15, maxWidth: 360 },
    alert: {
      width: 320,
      radius: 12,
      padding: '22px 24px 8px',
      fontSize: 16,
      title: true,
      titleSize: 20,
      button: 'OK',
      buttonSize: 15,
      buttonAlign: 'end',
    },
    empty: {
      width: 280,
      radius: 16,
      padding: '12px 14px',
      title: 'What can this bot do?',
      titleSize: 15,
      fontSize: 15,
      gap: 6,
    },
    start: { height: 44, label: 'Start', fontSize: 16, fontWeight: 500, uppercase: true, filled: false, radius: 22 },
    commands: {
      rowHeight: 36,
      avatar: 0,
      fontSize: 16,
      subSize: 14,
      padX: 16,
      radius: 16,
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
    bar: 5,
    footerHeight: 32,
    footerSize: 14,
    right: '#5ec15a',
    wrong: '#e5574f',
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
      height: 48,
      gap: 0,
      radius: 0,
      padX: 14,
      line: 2,
      title: eventLabels.pinned,
      titleSize: 15,
      fontSize: 15,
    },
    gift: {
      width: 230,
      radius: 16,
      padding: '14px 16px',
      picture: 96,
      titleSize: 16,
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
    // The copy bar's icon: the app's own msg_copy (MessageObject.java:1069; RVW-29c).
    codeCopy: 'var(--tg-art-code-copy)',
    play: null,
    // BackDrawable's arrow, drawn by code in the app (android.css).
    back: 'var(--tg-android-back)',
    menu: 'var(--tg-art-menu)',
  },
  light: {
    bubble: '#ffffff',
    text: '#000000',
    link: '#3579ab',
    meta: '#a3a9b0',
    views: '#a3a9b0',
    accent: '#4e91cb',
    codeText: '#000000',
    codeBg: 'transparent',
    preBg: 'rgba(111, 136, 158, 0.1)',
    preText: '#000000',
    preBar: '#6f889e',
    preHeaderBg: 'rgba(111, 136, 158, 0.08)',
    preLabel: '#6f889e',
    preIcon: '#6f889e',
    quoteBg: 'rgba(78, 145, 203, 0.1)',
    quoteBar: '#4e91cb',
    webpageBg: 'rgba(78, 145, 203, 0.1)',
    webpageAccent: '#4e91cb',
    spoilerDots: '#000000',
    header: 'transparent',
    headerText: '#1a1c1f',
    headerSubtext: '#858b93',
    headerBorder: 'transparent',
    headerShadow: 'none',
    headerIcon: '#1a1c1f',
    headerButton: '#f0f6ed',
    headerFade: 'transparent',
    share: '#9eb382',
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: 'rgba(15, 22, 31, 0.16)',
    tailShadow: 'rgba(15, 22, 31, 0.16)',
    mediaMetaBg: 'rgba(0, 0, 0, 0.24)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: 'rgba(90, 156, 110, 0.6)',
    mediaShade: 'transparent',
    durationBg: 'rgba(0, 0, 0, 0.4)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.45)',
    playIcon: '#ffffff',
    reactionBg: 'rgba(106, 169, 223, 0.137)',
    reactionText: '#4e91cb',
    reactionOutsideBg: '#5a9c6e',
    reactionOutsideText: '#ffffff',
    commentsText: '#4e91cb',
    commentsIcon: '#4c94ce',
    commentsBorder: '#dfe4e9',
    button: '#5a9c6e',
    buttonText: '#ffffff',
    buttonSuccess: '#40b135',
    buttonPrimary: '#519bda',
    buttonDanger: '#db4646',
    // The private chat (PRV-02; calibrate: O-02); the island takes the top bar's glass.
    outBubble: '#effedd',
    outText: '#000000',
    outLink: '#2678b6',
    outMeta: '#70b15c',
    outCheck: '#5db050',
    outOutline: 'transparent',
    outShadow: 'rgba(15, 22, 31, 0.16)',
    serviceBg: 'rgba(0, 0, 0, 0.2)',
    serviceText: '#ffffff',
    typing: '#4e91cb',
    composer: '#f0f6ed',
    composerText: '#000000',
    composerPlaceholder: '#a3a9b0',
    composerIcon: '#8e959b',
    composerBorder: 'transparent',
    send: '#4e91cb',
    menuButton: '#5aa8e8',
    menuButtonText: '#ffffff',
    replyPanel: '#e8ebf0',
    replyButton: '#ffffff',
    replyButtonText: '#36474f',
    replyButtonShadow: '0 1px 0 rgba(0, 0, 0, 0.15)',
    toast: 'rgba(36, 36, 36, 0.9)',
    toastText: '#ffffff',
    alert: '#ffffff',
    alertText: '#222222',
    alertButton: '#4991cc',
    scrim: 'rgba(0, 0, 0, 0.3)',
    empty: 'rgba(0, 0, 0, 0.2)',
    emptyText: '#ffffff',
    start: '#3a8ccf',
    startText: '#3a8ccf',
    commands: '#ffffff',
    commandsText: '#222222',
    commandsSubtext: '#8a8a8a',
  },
  dark: {
    bubble: '#1f2123',
    text: '#fafafa',
    link: '#79c4fc',
    meta: '#7d7f81',
    views: '#787c80',
    accent: '#79c4fc',
    codeText: '#fafafa',
    codeBg: 'transparent',
    preBg: 'rgba(255, 255, 255, 0.12)',
    preText: '#fafafa',
    preBar: '#ffffff',
    preHeaderBg: 'rgba(255, 255, 255, 0.072)',
    preLabel: '#ffffff',
    preIcon: '#ffffff',
    quoteBg: 'rgba(121, 196, 252, 0.1)',
    quoteBar: '#79c4fc',
    webpageBg: 'rgba(121, 196, 252, 0.1)',
    webpageAccent: '#79c4fc',
    spoilerDots: '#fafafa',
    header: 'transparent',
    headerText: '#ffffff',
    headerSubtext: 'rgba(242, 242, 242, 0.451)',
    headerBorder: 'transparent',
    headerShadow: 'none',
    headerIcon: '#ffffff',
    headerButton: '#171718',
    headerFade: 'transparent',
    share: '#394050',
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: 'rgba(0, 0, 0, 0.03)',
    tailShadow: 'rgba(0, 0, 0, 0.03)',
    mediaMetaBg: 'rgba(0, 0, 0, 0.24)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: 'rgba(44, 48, 60, 0.6)',
    mediaShade: 'transparent',
    durationBg: 'rgba(0, 0, 0, 0.4)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.45)',
    playIcon: '#ffffff',
    reactionBg: 'rgba(80, 152, 233, 0.153)',
    reactionText: '#ffffff',
    reactionOutsideBg: '#2c303c',
    reactionOutsideText: '#ffffff',
    commentsText: '#79c4fc',
    commentsIcon: '#79c4fc',
    commentsBorder: '#636363',
    button: '#2c303c',
    buttonText: '#ffffff',
    buttonSuccess: '#40b135',
    buttonPrimary: '#229af0',
    buttonDanger: '#db4646',
    // The private chat (PRV-02; calibrate: O-02); the island takes the top bar's glass.
    outBubble: '#3e6696',
    outText: '#ffffff',
    outLink: '#8ecbff',
    outMeta: '#a8c8eb',
    outCheck: '#8ec5f8',
    outOutline: 'transparent',
    outShadow: 'rgba(0, 0, 0, 0.16)',
    serviceBg: 'rgba(0, 0, 0, 0.3)',
    serviceText: '#ffffff',
    typing: '#79c4fc',
    composer: '#171718',
    composerText: '#ffffff',
    composerPlaceholder: 'rgba(255, 255, 255, 0.4)',
    composerIcon: 'rgba(255, 255, 255, 0.55)',
    composerBorder: 'transparent',
    send: '#79c4fc',
    menuButton: '#3e88c5',
    menuButtonText: '#ffffff',
    replyPanel: '#1c1c1d',
    replyButton: '#2f2f31',
    replyButtonText: '#ffffff',
    replyButtonShadow: '0 1px 0 rgba(0, 0, 0, 0.4)',
    toast: 'rgba(50, 50, 52, 0.95)',
    toastText: '#ffffff',
    alert: '#1c1c1d',
    alertText: '#ffffff',
    alertButton: '#79c4fc',
    scrim: 'rgba(0, 0, 0, 0.5)',
    empty: 'rgba(0, 0, 0, 0.3)',
    emptyText: '#ffffff',
    start: '#79c4fc',
    startText: '#79c4fc',
    commands: '#1c1c1d',
    commandsText: '#ffffff',
    commandsSubtext: 'rgba(255, 255, 255, 0.5)',
  },
}
