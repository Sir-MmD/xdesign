import { desktopAlbumLayout } from '../albumLayout.desktop'
import { codeLanguage } from '../codeLanguages'
import { lookFonts } from '../fonts'
import { desktopMediaBox } from '../media.desktop'
import type { PeerColor, PeerPalette } from '../peerColors'
import { firstLetter } from '../time'
import { eventLabels, pollLabels, sheetLabels, subscribersLabel, unlockLabel } from './labels'
import type { SkinTokens } from './tokens'

/**
 * Telegram Desktop 7.3.3 at its 100 % interface scale, light "Classic" and dark "Tinted"
 * (docs/plan/29-owner-list-2026-10-22.md section 8.4, TGP-05): every value from the
 * measurement sheet .dev/upd29/tg/desktop.md, which names each one's source in tdesktop
 * (ui/chat/chat.style, chat_helpers.style, lib_ui's basic.style and colors.palette, the night
 * theme, history_view_message.cpp and the others); what the tokens cannot draw is in
 * desktop.css, the album in albumLayout.desktop.ts, a single photo or video in
 * media.desktop.ts and the chat's background in wallpaper/desktop.ts.
 */

/**
 * The fill of a quote and a link preview in the channel's color: alpha 30 of 255
 * (chat_style.cpp:861-879); desktop.css draws their bar at 229 of 255.
 */
const fillAlpha = 30 / 255

/** A peer color: the avatar's gradient, the same in both themes, and the name's color in each. */
function peer(top: string, bottom: string, light: string, dark: string): PeerColor {
  return { avatar: { light: [top, bottom], dark: [top, bottom] }, tint: { light, dark } }
}

/**
 * Desktop's seven peer colors (red, orange, violet, green, cyan, blue, pink): the avatars'
 * gradients (empty_userpic.cpp:277-310), and the channel's name, its quotes and their links
 * (historyPeer*NameFg by chat_style.cpp:1500-1505 from colors.palette and the night theme).
 */
const palette: PeerPalette = [
  peer('#ff845e', '#d45246', '#c03d33', '#fb6169'),
  peer('#febb5b', '#f68136', '#ce671b', '#faa357'),
  peer('#b694f9', '#6c61df', '#8544d6', '#b48bf2'),
  peer('#9ad164', '#46ba43', '#4fad2d', '#85de85'),
  peer('#5bcbe3', '#359ad4', '#2996ad', '#62d4e3'),
  peer('#5caffa', '#408acf', '#168acd', '#65bdf3'),
  peer('#ff8aac', '#d95574', '#cd4073', '#ff5694'),
]

/**
 * Lang::FormatCountToShort (lang_tag.cpp:920-946): under 10,000 as it is ("1234"), then cut
 * (not rounded) to one decimal: "12.3K", "12K", "1.2M", "3B".
 */
function shortCount(count: number): string {
  const n = Math.max(0, Math.trunc(count))
  const shorten = (divider: number, unit: string) => {
    const tenths = Math.floor(n / (divider / 10))
    const decimal = tenths % 10
    return `${String(Math.floor(tenths / 10))}${decimal > 0 ? `.${String(decimal)}` : ''}${unit}`
  }
  if (n >= 1_000_000_000) return shorten(1_000_000_000, 'B')
  if (n >= 1_000_000) return shorten(1_000_000, 'M')
  if (n >= 10_000) return shorten(1000, 'K')
  return String(n)
}

/** The view count of the info row, at least 1 (BottomInfo::layoutViewsText). */
function viewsLabel(count: number): string {
  return shortCount(Math.max(count, 1))
}

/** The comments bar's label (history_item.cpp:4320-4330): "Leave a comment", "1 comment", "12.3K comments". */
function commentsLabel(count: number): string {
  if (count <= 0) return 'Leave a comment'
  return `${shortCount(count)} ${count === 1 ? 'comment' : 'comments'}`
}

/** The top bar's status (history_view_top_bar_widget.cpp:1997-2003): "12,345 subscribers", or "channel" without a count. */
function subscribers(count: number | undefined): string {
  return count === undefined || count <= 0 ? 'channel' : subscribersLabel(count)
}

/** 18 px lines (Open Sans at 13 px), as a share of the 13 px size. */
const line = 18 / 13

export const desktop: SkinTokens = {
  id: 'desktop',
  label: 'Desktop',
  // The chat column of a 1440 px window: 1440 - 1440 x 5/14 for the chat list (core_settings.h:1077).
  frameWidth: 926,
  // msgMargin's top 6, and its bottom 2 with historyPaddingBottom 8 (chat.style:52, 205).
  list: { top: 6, bottom: 10 },
  // msgMaxWidth 430, and the column less msgMargin's left 16 and right 56 (chat.style:14, 52).
  bubbleMaxWidth: (w) => Math.min(430, w - 72),
  // No floor: the bubble shrinks to its name or its text (160 is only the text's layout floor).
  bubbleMinWidth: 0,
  bubbleMinHeight: 0,
  bubbleMarginLeft: 16,
  // msgMargin's right 56 less the share button's 13 and 31.
  bubbleMarginRight: 12,
  // The bubble's shape repeated 2 px lower, without blur (message_bubble.cpp:194-205, 300-324).
  bubbleShadow: { y: 2, blur: 0, spread: 0 },
  outlineWidth: 0,
  fontFamily: `${lookFonts.desktop.text}, ${lookFonts.desktop.persian}, "Open Sans Variable", "Vazirmatn Variable", sans-serif`,
  fontSize: 13,
  lineHeight: line,
  boldWeight: 600,
  links: { underline: false },
  // 18 px emoji with 1 px on each side (desktop.css adds the one before), on top of the line;
  // a premium emoji round(18 x 1.12) = 20, centred on the line (desktop.css).
  emoji: { scale: 18 / 13, customScale: 20 / 13, gap: 1, align: 'top' },
  // One to three emoji alone on one line: 36 px each, without a bubble (chat.style:594-597).
  bigEmoji: {
    size: ({ count, lines }) => (lines === 1 && count >= 1 && count <= 3 ? 36 : null),
    rule: 'strict',
    single: null,
  },
  // The channel's name, semibold 13 in an 18 px line; the text right under it, media 5 px lower.
  title: { show: true, size: 13, weight: 600, lineHeight: line, gap: 0, mediaGap: 5 },
  metaFontSize: 13,
  meta: {
    // msgPadding's right 11 less msgDateDelta.x 2, and its bottom 8 less msgDateDelta.y 5.
    right: 9,
    bottom: 3,
    height: 18,
    padding: 0,
    // The eye, 16 x 11 (desktop.css sets its height), at the start of a 20 px slot: 4 px to
    // the count, then 8 px (historyViewsSpace) to the time.
    iconSize: 16,
    iconGap: 8,
    countGap: 4,
    timeGap: 0,
    viewsFirst: false,
    rtl: 'last',
    form: 'joined',
    views: viewsLabel,
    hour: 'numeric',
    // skipBlockWidth: the info row's width + 10; a line of 13 px when it does not fit.
    reserve: 10,
    dropHeight: 13,
    // msgDateImgDelta 4 and msgDateImgPadding 8 x 2: a 22 px pill, fully round.
    overlay: { right: 4, bottom: 4, height: 22, padStart: 8, padEnd: 8, radius: 11 },
  },
  padding: { top: 8, right: 11, bottom: 8, left: 11, footer: 8 },
  // mediaInBubbleSkip between media and the caption, msgPadding's bottom under it (before the
  // comments bar too).
  caption: { top: 5, bottom: 8, footer: 8 },
  // bubbleRadiusLarge and bubbleRadiusSmall (chat.style:326-327).
  radius: { main: 16, small: 6, aboveKeyboard: 6 },
  // bubble_tail.png 6 x 10, traced from its @3x mask; none above buttons or under media.
  tail: {
    path: 'M6 0H5.78C4.67 4.44 3.6 7.35 0 9.03V10H6Z',
    viewBox: '0 0 6 10',
    width: 6,
    height: 10,
    left: -6,
    bottom: 0,
    squareCorner: true,
    aboveKeyboard: false,
    underMedia: false,
    // No shadow of its own: the bubble's 2 px band goes on under it (desktop.css, RVW-29c).
    shadow: { y: 0, blur: 0 },
  },
  // historyTextStyle's blockquote (chat_helpers.style:1282-1297): 4 px outside, 2 inside, the
  // mark mini_quote at 4 / 4, the arrow at 6 / 4; three lines folded, cut without a fade.
  quote: {
    collapsedLines: 3,
    barWidth: 3,
    radius: 5,
    padStart: 10,
    padEnd: 20,
    padBlock: 4,
    padY: 2,
    fontSizeDelta: 0,
    lineHeight: null,
    fade: 0,
    icon: { width: 16, height: 12, top: 4, end: 4 },
    expand: { width: 12, height: 8, end: 6, bottom: 4 },
    // Its arrow only over three lines (text_renderer.cpp:410-447, text.cpp:1809-1813); the bar on
    // the left whatever the text (text.cpp:351).
    foldLong: true,
    direction: 'ltr',
    wideAt: null,
    first: null,
  },
  // Monospace at the text's size and line; a block's 20 px header with the language (or
  // "copy") at 10 / 2 and mini_copy at 2 / 4 from its end, padding 2 / 4 / 2 / 10, 4 px
  // outside (chat_helpers.style:1298-1305); a block widens the bubble up to the column.
  code: {
    fontFamily: '"Cascadia Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
    fontSize: 13,
    blockFontSize: 13,
    lineHeight: line,
    radius: 5,
    inlinePadding: '0',
    blockPadding: '2px 4px 2px 10px',
    blockMargin: 4,
    barWidth: 3,
    header: { fontSize: 13, fontWeight: 400, padding: '2px 4px 0 10px', mono: true, height: 20 },
    noLanguage: 'copy',
    copyMark: true,
    wideBubble: (w) => w - 72,
    // The language as it is written (text.cpp:1686-1695).
    language: codeLanguage.desktop,
    sizes: null,
    copyBar: null,
    first: null,
  },
  // Rich posts are not in the sheet: the shared rules.
  rich: { gap: null, marker: null, tableRadius: 0 },
  // Particles 1.5 to 2 px, about one in each 3 px square at a time (spoiler_mess.cpp:36-53;
  // an estimate of the animation), over the text's rectangles without rounding.
  spoiler: { dot: 0.75, cell: 3, radius: 0 },
  media: {
    maxWidth: () => 430,
    maxHeight: () => 430,
    minWidth: 200,
    minHeight: 100,
    radius: 16,
    captionRadius: 0,
    inset: 0,
    sampleTail: false,
    blurFill: true,
    box: desktopMediaBox,
  },
  // A video's time at 4 / 4: a 22 px pill, 8 px at its sides (history_view_video_status.cpp:30-74).
  duration: { top: 4, left: 4, height: 22, padX: 8, radius: 11, fontSize: 13, pad: 'minutes', gif: null },
  // A 44 px circle with history_file_play 32 x 32.
  play: { size: 44, iconSize: 32 },
  album: { gap: 4, inset: 0, layout: desktopAlbumLayout },
  // historyFastShareSize 31, 13 px from the bubble, its bottom 5 px above the bubble's.
  shareButton: { size: 31, gap: 13, bottom: 5, iconSize: 24, hover: false },
  // 22 px pills (2 + 18 + 2), 5 px before the emoji and 7 after the count, 3 between them, 4
  // apart, 5 px under the text; under media without a caption, under the bubble.
  reactions: {
    height: 22,
    radius: 11,
    padStart: 5,
    padEnd: 7,
    emoji: 18,
    emojiGap: 3,
    fontSize: 13,
    fontWeight: 600,
    gap: 4,
    rowGap: 4,
    top: 5,
    outside: true,
    outsideTail: true,
    count: shortCount,
    meta: { gap: 10, end: 3, drop: 13 },
  },
  // historyCommentsButtonHeight 40: history_comments at 9, the label 10 px after it, the arrow
  // 8 px from the end (chat.style:557-560).
  comments: {
    height: 40,
    padStart: 9,
    padEnd: 8,
    padY: 0,
    fontSize: 13,
    fontWeight: 600,
    icons: true,
    iconSize: 24,
    textGap: 10,
    minBubbleWidth: 0,
    label: commentsLabel,
  },
  // historyPagePreview: the quote's box, padding 10 / 5 / 7 / 7 (chat.style:107-109), 5 px under the text.
  webpage: {
    padding: '5px 7px 7px 10px',
    radius: 5,
    fontSize: 13,
    lineHeight: line,
    barWidth: 3,
    top: 5,
    thumb: 90,
    metaInside: true,
  },
  peer: {
    palette,
    title: true,
    quote: true,
    quoteLinks: true,
    code: false,
    inlineCode: false,
    linkPreview: true,
    comments: false,
    alpha: fillAlpha,
  },
  // 54 px, no picture in a two-column window: the name at 17 / 8, the status at 17 / 28
  // (history_view_top_bar_widget.cpp:545-556; desktop.css puts the 2 px between them).
  header: {
    height: 54,
    avatar: 0,
    titleSize: 13,
    titleWeight: 600,
    titleLineHeight: line,
    subSize: 13,
    subLineHeight: line,
    centered: false,
    gap: 0,
    padX: 17,
    radius: 0,
    float: null,
    fade: 0,
    back: false,
    menu: false,
    buttonSize: 40,
    initials: firstLetter,
    initial: { size: 0, weight: 600, font: null },
    subscribers,
  },
  hour12: true,
  messageDir: false,
  // msgBotKbButton (chat.style:275-287): 36 px rows 2 px apart and under the bubble, the text
  // at 8 from the top and 10 from the sides, the marks 10 x 10 at 4 / 4; corners 6, the last
  // row's outer ones 16; a colored button is its color alone (element.cpp:219-282).
  keyboard: {
    wrap: false,
    height: 36,
    gap: 2,
    rowGap: 2,
    top: 2,
    overhang: 0,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: line,
    padX: 10,
    radius: 6,
    lastRowRadius: 16,
    iconSize: 10,
    iconTop: 4,
    iconEnd: 4,
    styleAlpha: 1,
    maxWidth: null,
  },
  // The private chat (PRV-02), read from the app and not measured yet (calibrate: O-02): the
  // 900 px window's chat column; own messages on the right; the service line's pill in the
  // wallpaper's service color; "typing" with its dots after it; the compose bar across the
  // bottom with a line over it, "Write a message..." and send in it; the bottom keyboard under
  // the bar; the toast in the middle and the alert a box; the empty chat's card in the service
  // color and START on the bar; the commands over the bar, each command before its description.
  chat: {
    height: 900,
    gap: 6,
    out: { marginLeft: 16, marginRight: 12, checkWidth: 16, checkHeight: 11 },
    service: { height: 22, padX: 8, radius: 11, fontSize: 13, fontWeight: 600, margin: 10 },
    status: { bot: 'bot', dots: 'after' },
    composer: {
      height: 46,
      float: null,
      radius: 0,
      padX: 4,
      fontSize: 13,
      iconSize: 24,
      gap: 0,
      parts: ['menu', 'attach', 'field', 'keyboard', 'emoji', 'send'],
      send: null,
      placeholder: 'Write a message...',
    },
    menuButton: { height: 30, padX: 10, radius: 15, fontSize: 13, fontWeight: 600, label: 'Menu' },
    replyKeyboard: {
      over: false,
      height: 200,
      padding: 10,
      gap: 8,
      buttonHeight: 38,
      radius: 8,
      fontSize: 13,
      fontWeight: 600,
    },
    toast: { place: 'middle', offset: 0, radius: 8, padding: '11px 20px', fontSize: 13, maxWidth: 380 },
    alert: {
      width: 320,
      radius: 8,
      padding: '24px 24px 12px',
      fontSize: 14,
      title: false,
      titleSize: 16,
      button: 'OK',
      buttonSize: 14,
      buttonAlign: 'end',
    },
    empty: {
      width: 270,
      radius: 12,
      padding: '12px 16px',
      title: 'What can this bot do?',
      titleSize: 14,
      fontSize: 13,
      gap: 6,
    },
    start: { height: 46, label: 'Start', fontSize: 14, fontWeight: 600, uppercase: true, filled: false, radius: 0 },
    commands: {
      rowHeight: 40,
      avatar: 0,
      fontSize: 13,
      subSize: 13,
      padX: 16,
      radius: 0,
      rows: 5,
      commandFirst: true,
    },
  },
  // Polls and quizzes, paid media and dice (MSG-03), read from the app and not measured yet
  // (calibrate: O-02): the question over the type line, round marks before the options, a line
  // under each option until the vote, then the percentage, the bar and the footer's count.
  poll: {
    questionSize: 14,
    questionWeight: 600,
    typeSize: 13,
    typeGap: 6,
    optionSize: 14,
    optionHeight: 32,
    optionGap: 4,
    mark: 18,
    markGap: 10,
    bar: 4,
    footerHeight: 28,
    footerSize: 13,
    right: '#4db362',
    wrong: '#d55959',
    labels: { ...pollLabels, results: 'View results' },
  },
  paid: {
    blur: 24,
    height: 32,
    padX: 12,
    radius: 16,
    fontSize: 13,
    fontWeight: 600,
    label: unlockLabel,
  },
  dice: { size: 160 },
  // Invoices and their payment sheet (PAY-02), read from the app and not measured yet (calibrate:
  // O-02): the title over the description, then the photo with the price in the pill over media.
  invoice: {
    titleSize: 14,
    titleWeight: 600,
    priceSize: 13,
    label: 'INVOICE',
    sheet: { radius: 6, ...sheetLabels },
  },
  // The pinned bar, a gift's card and Restart (EVT-02): read from the app, calibrate: O-02.
  events: {
    pinned: {
      height: 46,
      gap: 0,
      radius: 0,
      padX: 12,
      line: 2,
      title: eventLabels.pinned,
      titleSize: 13,
      fontSize: 13,
    },
    gift: {
      width: 236,
      radius: 12,
      padding: '12px 14px',
      picture: 88,
      titleSize: 14,
      title: eventLabels.gift,
      fontSize: 13,
      button: eventLabels.view,
    },
    restart: eventLabels.restart,
  },
  // Desktop's own art (art/desktop/, white on black: luminance masks).
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
  // colors.palette (Classic).
  light: {
    bubble: '#ffffff',
    text: '#000000',
    link: '#168acd',
    meta: '#a0acb6',
    views: '#a0acb6',
    accent: '#168acd',
    codeText: '#4e7391',
    codeBg: 'transparent',
    preBg: 'rgba(78, 115, 145, 0.118)',
    preText: '#4e7391',
    preBar: 'rgba(78, 115, 145, 0.898)',
    preHeaderBg: 'rgba(78, 115, 145, 0.298)',
    preLabel: '#4e7391',
    preIcon: 'rgba(78, 115, 145, 0.6)',
    quoteBg: 'rgba(22, 138, 205, 0.118)',
    quoteBar: '#168acd',
    webpageBg: 'rgba(22, 138, 205, 0.118)',
    webpageAccent: '#168acd',
    spoilerDots: '#a0acb6',
    header: '#ffffff',
    headerText: '#222222',
    headerSubtext: '#999999',
    headerBorder: 'rgba(0, 0, 0, 0.094)',
    headerShadow: 'none',
    headerIcon: '#999999',
    headerButton: 'transparent',
    headerFade: 'transparent',
    share: 'rgba(81, 124, 65, 0.498)',
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: 'rgba(116, 142, 162, 0.161)',
    tailShadow: 'rgba(116, 142, 162, 0.161)',
    mediaMetaBg: 'rgba(0, 0, 0, 0.329)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: 'rgba(255, 255, 255, 0.784)',
    bigEmojiMetaBg: 'rgba(81, 124, 65, 0.498)',
    mediaShade: 'rgba(0, 0, 0, 0.188)',
    durationBg: 'rgba(0, 0, 0, 0.329)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.329)',
    playIcon: '#ffffff',
    reactionBg: 'rgba(64, 167, 227, 0.12)',
    reactionText: '#168acd',
    reactionOutsideBg: 'rgba(81, 124, 65, 0.498)',
    reactionOutsideText: '#ffffff',
    commentsText: '#168acd',
    commentsIcon: '#168acd',
    commentsBorder: 'rgba(160, 172, 182, 0.3)',
    button: 'rgba(81, 124, 65, 0.498)',
    buttonText: '#ffffff',
    buttonSuccess: 'rgba(72, 157, 56, 0.702)',
    buttonPrimary: 'rgba(55, 142, 174, 0.702)',
    buttonDanger: 'rgba(201, 84, 62, 0.702)',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#effdde',
    outText: '#000000',
    outLink: '#168acd',
    outMeta: '#6cc264',
    outCheck: '#5dc452',
    outOutline: 'transparent',
    outShadow: 'rgba(96, 173, 81, 0.255)',
    serviceBg: 'rgba(81, 124, 65, 0.498)',
    serviceText: '#ffffff',
    typing: '#168acd',
    composer: '#ffffff',
    composerText: '#000000',
    composerPlaceholder: '#999999',
    composerIcon: '#999999',
    composerBorder: 'rgba(0, 0, 0, 0.094)',
    send: '#40a7e3',
    menuButton: '#40a7e3',
    menuButtonText: '#ffffff',
    replyPanel: '#ffffff',
    replyButton: '#e4ebf2',
    replyButtonText: '#222222',
    replyButtonShadow: 'none',
    toast: 'rgba(0, 0, 0, 0.7)',
    toastText: '#ffffff',
    alert: '#ffffff',
    alertText: '#000000',
    alertButton: '#168acd',
    scrim: 'rgba(0, 0, 0, 0.5)',
    empty: 'rgba(81, 124, 65, 0.498)',
    emptyText: '#ffffff',
    start: '#168acd',
    startText: '#168acd',
    commands: '#ffffff',
    commandsText: '#000000',
    commandsSubtext: '#999999',
  },
  // night.tdesktop-theme (Tinted), the keys it lacks from colors.palette.
  dark: {
    bubble: '#182533',
    text: '#f5f5f5',
    link: '#70baf5',
    meta: '#6d7f8f',
    views: '#6d7f8f',
    accent: '#71bafa',
    codeText: '#5a8cb7',
    codeBg: 'transparent',
    preBg: 'rgba(0, 0, 0, 0.753)',
    preText: '#5a8cb7',
    preBar: 'rgba(90, 140, 183, 0.898)',
    preHeaderBg: 'rgba(90, 140, 183, 0.298)',
    preLabel: '#5a8cb7',
    preIcon: 'rgba(90, 140, 183, 0.6)',
    quoteBg: 'rgba(101, 189, 243, 0.118)',
    quoteBar: '#65bdf3',
    webpageBg: 'rgba(101, 189, 243, 0.118)',
    webpageAccent: '#65bdf3',
    spoilerDots: '#6d7f8f',
    header: '#17212b',
    headerText: '#f5f5f5',
    headerSubtext: '#708499',
    headerBorder: 'rgba(4, 8, 14, 0.337)',
    headerShadow: 'none',
    headerIcon: '#708499',
    headerButton: 'transparent',
    headerFade: 'transparent',
    share: 'rgba(33, 48, 64, 0.835)',
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: 'rgba(116, 142, 162, 0)',
    tailShadow: 'rgba(116, 142, 162, 0)',
    mediaMetaBg: 'rgba(0, 0, 0, 0.329)',
    mediaMetaText: 'rgba(255, 255, 255, 0.949)',
    mediaMetaIcon: 'rgba(255, 255, 255, 0.784)',
    bigEmojiMetaBg: 'rgba(33, 48, 64, 0.835)',
    mediaShade: 'rgba(0, 0, 0, 0.188)',
    durationBg: 'rgba(0, 0, 0, 0.329)',
    durationText: 'rgba(255, 255, 255, 0.949)',
    playBg: 'rgba(0, 0, 0, 0.329)',
    playIcon: '#efefef',
    reactionBg: 'rgba(63, 150, 208, 0.12)',
    reactionText: '#71bafa',
    reactionOutsideBg: 'rgba(33, 48, 64, 0.835)',
    reactionOutsideText: '#ffffff',
    commentsText: '#6ab2f2',
    commentsIcon: '#6ab2f2',
    commentsBorder: 'rgba(109, 127, 143, 0.3)',
    button: 'rgba(33, 48, 64, 0.835)',
    buttonText: '#ffffff',
    buttonSuccess: 'rgba(72, 157, 56, 0.702)',
    buttonPrimary: 'rgba(55, 142, 174, 0.702)',
    buttonDanger: 'rgba(201, 84, 62, 0.702)',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#2b5278',
    outText: '#f5f5f5',
    outLink: '#70baf5',
    outMeta: '#7da8d3',
    outCheck: '#72bcfd',
    outOutline: 'transparent',
    outShadow: 'rgba(116, 142, 162, 0)',
    serviceBg: 'rgba(33, 48, 64, 0.835)',
    serviceText: '#ffffff',
    typing: '#71bafa',
    composer: '#17212b',
    composerText: '#f5f5f5',
    composerPlaceholder: '#5d6c80',
    composerIcon: '#6c7883',
    composerBorder: 'rgba(4, 8, 14, 0.337)',
    send: '#5288c1',
    menuButton: '#5288c1',
    menuButtonText: '#ffffff',
    replyPanel: '#17212b',
    replyButton: '#232e3c',
    replyButtonText: '#f5f5f5',
    replyButtonShadow: 'none',
    toast: 'rgba(0, 0, 0, 0.7)',
    toastText: '#ffffff',
    alert: '#17212b',
    alertText: '#f5f5f5',
    alertButton: '#71bafa',
    scrim: 'rgba(0, 0, 0, 0.5)',
    empty: 'rgba(33, 48, 64, 0.835)',
    emptyText: '#ffffff',
    start: '#71bafa',
    startText: '#71bafa',
    commands: '#17212b',
    commandsText: '#f5f5f5',
    commandsSubtext: '#708499',
  },
}
