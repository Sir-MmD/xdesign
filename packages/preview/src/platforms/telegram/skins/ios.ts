import { iosAlbumLayout } from '../albumLayout.ios'
import { codeLanguage } from '../codeLanguages'
import { iosMediaBox } from '../media.ios'
import type { PeerColor, PeerPalette } from '../peerColors'
import { firstLetter, iosCount } from '../time'
import { eventLabels, pollLabels, sheetLabels, subscribersLabel, unlockLabel } from './labels'
import type { SkinTokens } from './tokens'

/**
 * Telegram for iOS (iOS 26) by its measurement sheet, .dev/upd29/tg/ios.md (29 section 8.4,
 * TGP-07): ChatMessageItemCommon.swift, the bubble's layout, DefaultDayPresentationTheme.swift
 * and DefaultDarkPresentationTheme.swift, in pt on a 393 pt iPhone. Estimates of the sheet are
 * marked; the parts the tokens cannot draw (the outline that runs round the tail, the glass of
 * the top bar, the fills from the wallpaper) are in ios.css.
 */

/** The widest bubble (ChatMessageBubbleItemNode): the row less its insets, the avatar room and the bubble's insets. */
function bubbleMaxWidth(frameWidth: number): number {
  const fill = frameWidth <= 500 ? Math.max(1, frameWidth - 36) : Math.max(1, Math.floor(frameWidth * 0.85))
  const width = fill + 32 > frameWidth ? frameWidth - 32 : fill
  return Math.floor(width - 15) - 10 - 2
}

/** compactNumericCountString: "999", "1.2K" (tenths cut, ".0" left out), "3M". */
function viewsLabel(count: number): string {
  const compact = (unit: number, suffix: string) => {
    const tenths = Math.floor((count % unit) / (unit / 10))
    return `${String(Math.floor(count / unit))}${tenths > 0 ? `.${String(tenths)}` : ''}${suffix}`
  }
  if (count >= 1_000_000) return compact(1_000_000, 'M')
  if (count >= 1000) return compact(1000, 'K')
  return String(count)
}

/** "Leave a Comment", "1 Comment", "12 Comments" (Conversation.MessageLeaveComment, MessageViewComments). */
function commentsLabel(count: number): string {
  if (count <= 0) return 'Leave a Comment'
  return `${String(count)} ${count === 1 ? 'Comment' : 'Comments'}`
}

/** Big emoji's text sizes by the most emoji on a line or the lines (ChatMessageStickerItemNode). */
const bigEmojiScale = [1, 0.84, 0.69, 0.53, 0.46, 0.38, 0.32, 0.27, 0.24]

/** A peer color: the avatar's gradient, and the tint of quotes and code, the same in both themes. */
function peer(top: string, bottom: string, tint: string): PeerColor {
  return { avatar: { light: [top, bottom], dark: [top, bottom] }, tint: { light: tint, dark: tint } }
}

/** PeerNameColors and the avatar gradients of the iOS client (sheet 3.5, PNC:68-118). */
const iosPalette: PeerPalette = [
  peer('#ff885e', '#ff516a', '#cc5049'),
  peer('#ffcd6a', '#ffa85c', '#d67722'),
  peer('#82b1ff', '#665fff', '#955cdb'),
  peer('#a0de7e', '#54cb68', '#40a920'),
  peer('#00fcfd', '#4acccd', '#309eba'),
  peer('#72d5fd', '#2a9ef1', '#368ad1'),
  peer('#e0a2f3', '#d669ed', '#c7508b'),
]

const textFont = '-apple-system, BlinkMacSystemFont, "TG Inter SF", "Vazirmatn Variable", sans-serif'

export const ios: SkinTokens = {
  id: 'ios',
  label: 'iOS',
  frameWidth: 393,
  // Under the floating bar: room for the bar's fade (80 px from the top), an estimate.
  list: { top: 30, bottom: 16 },
  bubbleMaxWidth,
  bubbleMinWidth: 32,
  bubbleMinHeight: 33,
  bubbleMarginLeft: 10,
  bubbleMarginRight: 14,
  bubbleShadow: { y: 0, blur: 0, spread: 0 },
  outlineWidth: 0.58,
  fontFamily: textFont,
  fontSize: 17,
  lineHeight: 22.72 / 17,
  boldWeight: 600,
  links: { underline: false },
  // Emoji at the text's size (estimate); a premium emoji's box 24 at 17 (ITE:169, ITE:322).
  emoji: { scale: 1, customScale: 24 / 17, gap: 0, align: '-0.15em' },
  bigEmoji: {
    rule: 'strict',
    single: null,
    size: ({ count, lines, perLine }) =>
      count === 1 ? Math.floor(180 * 0.625) : Math.floor(94 * (bigEmojiScale[Math.max(perLine, lines) - 1] ?? 0.21)),
  },
  title: { show: false, size: 14, weight: 600, lineHeight: 1.25, gap: 4, mediaGap: 4 },
  metaFontSize: 11,
  meta: {
    right: 10,
    bottom: 4,
    height: 14,
    padding: 0,
    iconSize: 12.67,
    iconGap: 3,
    countGap: 3,
    timeGap: 0,
    viewsFirst: false,
    rtl: 'segment',
    form: 'string',
    views: viewsLabel,
    hour: 'numeric',
    reserve: 5,
    dropHeight: 14,
    overlay: { right: 6, bottom: 6, height: 18, padStart: 7, padEnd: 7, radius: 9 },
  },
  // Under the last line the text keeps a line's spacing, 2.43, and the ceiling's half pixel
  // (InteractiveTextComponent.swift:1910-1912, 2015-2018), then its 5.67 inset less the node's 1:
  // 6.38 under the last line box, before a footer 3.38 (the hairline 1 above the node's end).
  // The owner's iOS screenshot gives 11.3 pt from the last baseline to the bubble's edge, 6 under
  // the line box (RVW-29c).
  padding: { top: 4.12, right: 10, bottom: 6.38, left: 10, footer: 3.38 },
  // The caption's top under media is an estimate of the sheet; its bottom is the text's, 3.38
  // before the comments bar (the caption is the same text node).
  caption: { top: 7.12, bottom: 6.38, footer: 3.38 },
  radius: { main: 16, small: 8, aboveKeyboard: 8 },
  // The tail drawn over the round corner (sheet 4.1); it starts 1 px down so its outline meets
  // the bubble's ring instead of crossing it.
  tail: {
    path: 'M0 1H16.5V8.5H9Q9 17 -4.5 17H-4.748A11.5 10.5 0 0 0 0 8.5Z',
    viewBox: '-4.748 0 21.248 17',
    width: 21.248,
    height: 17,
    left: -4.748,
    bottom: 0,
    squareCorner: false,
    aboveKeyboard: false,
    underMedia: true,
    shadow: { y: 0, blur: 0 },
  },
  // 14 px text, 18.71 px lines; 9 px each side, the first line 7 px more for the mark (ios.css).
  quote: {
    collapsedLines: 3,
    barWidth: 3,
    radius: 4,
    padStart: 9,
    padEnd: 9,
    padBlock: 4.78,
    padY: 2,
    fontSizeDelta: -3,
    lineHeight: 18.71,
    fade: 7,
    icon: { width: 9, height: 7, top: 4, end: 4 },
    expand: { width: 16, height: 16, end: 6, bottom: 3 },
    // Folded with its arrow only over three lines (InteractiveTextComponent.swift:2045); the bar on
    // the left and the mark on the right whatever the text (InteractiveTextComponent.swift:3219-3228).
    foldLong: true,
    direction: 'ltr',
    wideAt: null,
    // One that opens the text starts 7 under the text's top, not 6 under a line, so its box is
    // 9.33 under the bubble's (InteractiveTextComponent.swift:1868-1876; RVW-29c).
    first: { margin: 5.21, padY: 2 },
  },
  code: {
    fontFamily: 'Menlo, "TG DejaVu Sans Mono", monospace',
    fontSize: 16,
    blockFontSize: 13,
    lineHeight: 16.95 / 13,
    radius: 4,
    inlinePadding: '0',
    // Under the last line the line spacing the box keeps (1.82 at 13) and its 2 (RVW-29c).
    blockPadding: '1.1px 9px 3.41px 9px',
    blockMargin: 4.78,
    barWidth: 3,
    // The language's line reaches 7 + 7 past its end (InteractiveTextComponent.swift:1649-1651,
    // 1882; RVW-29c).
    header: { fontSize: 14, fontWeight: 600, padding: '3px 14px 0 9px', mono: false, height: null },
    noLanguage: null,
    copyMark: false,
    wideBubble: null,
    // The language capitalized as Swift does, "json" as "Json" (StringWithAppliedEntities.swift:403).
    language: codeLanguage.ios,
    sizes: null,
    copyBar: null,
    // As a quote, one that opens the text starts 7 under its top (RVW-29c).
    first: { margin: 5.21, radius: 4 },
  },
  // Rich posts are not in the sheet: the shared rules.
  rich: { gap: null, marker: null, tableRadius: 0 },
  spoiler: { dot: 0.6, cell: 3, radius: 4 },
  media: {
    maxWidth: () => 302,
    maxHeight: () => 380,
    minWidth: 170,
    minHeight: 74,
    radius: 15,
    captionRadius: 0,
    inset: 1,
    sampleTail: false,
    blurFill: false,
    box: iosMediaBox,
  },
  duration: { top: 6, left: 6, height: 18, padX: 7, radius: 9, fontSize: 11, pad: null, gif: 'GIF' },
  // iOS plays videos in the bubble; the preview keeps a play button.
  play: { size: 50, iconSize: 20 },
  album: { gap: 1, inset: 1, layout: iosAlbumLayout },
  shareButton: { size: 30, gap: 9, bottom: 0, iconSize: 24, hover: false },
  reactions: {
    height: 30,
    radius: 15,
    padStart: 11,
    padEnd: 11,
    emoji: 20,
    emojiGap: 2,
    fontSize: 11,
    fontWeight: 500,
    gap: 6,
    rowGap: 6,
    top: 3,
    outside: true,
    outsideTail: false,
    count: iosCount,
    meta: { gap: 5, end: 0, drop: 14 },
  },
  comments: {
    height: 42,
    padStart: 14,
    padEnd: 8,
    padY: 0,
    fontSize: 17,
    fontWeight: 400,
    icons: true,
    iconSize: 24,
    textGap: 11,
    minBubbleWidth: 0,
    label: commentsLabel,
  },
  // The link preview by ChatMessageAttachedContentNode.swift (not in the sheet; RVW-29c): the
  // site's name, the title (both semibold) and the description in floor(17 x 14 / 17) = 14 on
  // TextNode's lines of floor(16.71) + floor(16 x 0.09) = 17 (200-215, 283-305; TextNode.swift
  // 1778-1781), 3 between the box and its text, 9 at the left with the 3 px bar and 6 at the right
  // (319-320); the box 4.38 under the text's last line box: the text keeps a line's spacing, 2.43,
  // under its last line (InteractiveTextComponent.swift:1910-1912, 2015-2018) and its bottom inset
  // is 5.67 less 3 before the preview (ChatMessageTextBubbleContentNode.swift:248-255); the small
  // picture 54 at 6 / 6 and the info row under the box are in ios.css.
  webpage: {
    padding: '2.52px 6px 3.47px 9px',
    radius: 4,
    fontSize: 14,
    lineHeight: 17 / 14,
    barWidth: 3,
    top: 4.38,
    thumb: 54,
    metaInside: false,
  },
  peer: {
    palette: iosPalette,
    title: false,
    quote: true,
    quoteLinks: false,
    code: true,
    inlineCode: false,
    linkPreview: true,
    comments: false,
    alpha: 0.1,
  },
  // iOS 26: the glass pieces float 6 px down and 16 px in (ios.css draws them).
  header: {
    height: 44,
    avatar: 38,
    titleSize: 17,
    titleWeight: 600,
    titleLineHeight: 21 / 17,
    subSize: 13,
    subLineHeight: 16 / 13,
    centered: true,
    gap: 8,
    padX: 0,
    radius: 0,
    float: { top: 6, side: 16 },
    fade: 80,
    back: true,
    menu: false,
    buttonSize: 44,
    // A channel's letter is its title's first character, capital (PeerUtils.swift:122-129; RVW-29c).
    initials: firstLetter,
    initial: { size: 16, weight: 700, font: `ui-rounded, ${textFont}` },
    subscribers: subscribersLabel,
  },
  hour12: true,
  messageDir: false,
  keyboard: {
    wrap: false,
    height: 42,
    gap: 2,
    rowGap: 2,
    top: 2,
    overhang: 0,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.2,
    padX: 14,
    radius: 8,
    lastRowRadius: 16,
    iconSize: 10,
    iconTop: 5,
    iconEnd: 5,
    styleAlpha: 0.7,
    maxWidth: null,
  },
  // The private chat (PRV-02), read from the app and not measured yet (calibrate: O-02): the
  // 393 x 852 screen; own messages on the right; the service line's pill in the wallpaper's fill
  // (wallpaper/ios.ts fillParts); the dots of "typing" before it; the glass field 40 tall over the
  // home indicator (the 84 under the list, wallpaper/ios.ts) with send in it; the bottom keyboard
  // under it in the system keyboard's place; the toast at the top and the alert the system's;
  // the empty chat's card in the fill and a filled Start button; the commands over the field.
  chat: {
    height: 852,
    gap: 2,
    out: { marginLeft: 52, marginRight: 10, checkWidth: 15, checkHeight: 10 },
    service: { height: 22, padX: 8, radius: 11, fontSize: 13, fontWeight: 600, margin: 8 },
    status: { bot: 'bot', dots: 'before' },
    composer: {
      height: 40,
      float: { side: 8, bottom: 36 },
      radius: 20,
      padX: 4,
      fontSize: 17,
      iconSize: 24,
      gap: 2,
      parts: ['attach', 'menu', 'field', 'keyboard', 'emoji', 'send'],
      send: null,
      placeholder: 'Message',
    },
    menuButton: { height: 32, padX: 12, radius: 16, fontSize: 15, fontWeight: 600, label: 'Menu' },
    replyKeyboard: {
      over: false,
      height: 291,
      padding: 6,
      gap: 6,
      buttonHeight: 44,
      radius: 8,
      fontSize: 16,
      fontWeight: 400,
    },
    toast: { place: 'top', offset: 8, radius: 14, padding: '12px 16px', fontSize: 15, maxWidth: 360 },
    alert: {
      width: 270,
      radius: 14,
      padding: '20px 16px 0',
      fontSize: 13,
      title: true,
      titleSize: 17,
      button: 'OK',
      buttonSize: 17,
      buttonAlign: 'center',
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
    start: { height: 50, label: 'Start', fontSize: 17, fontWeight: 600, uppercase: false, filled: true, radius: 25 },
    commands: {
      rowHeight: 44,
      avatar: 0,
      fontSize: 15,
      subSize: 15,
      padX: 16,
      radius: 16,
      rows: 5,
      commandFirst: true,
    },
  },
  // Polls and quizzes, paid media and dice (MSG-03), read from the app and not measured yet
  // (calibrate: O-02): the question over the type line, round marks before the options, a line
  // under each option until the vote, then the percentage, the bar and the footer's count.
  poll: {
    questionSize: 17,
    questionWeight: 600,
    typeSize: 14,
    typeGap: 8,
    optionSize: 17,
    optionHeight: 40,
    optionGap: 2,
    mark: 22,
    markGap: 12,
    bar: 4,
    footerHeight: 34,
    footerSize: 14,
    right: '#4cd964',
    wrong: '#ff3b30',
    labels: { ...pollLabels, noVotes: 'No Votes', noAnswers: 'Nobody answered yet' },
  },
  paid: {
    blur: 24,
    height: 36,
    padX: 14,
    radius: 18,
    fontSize: 16,
    fontWeight: 600,
    label: unlockLabel,
  },
  dice: { size: 160 },
  // Invoices and their payment sheet (PAY-02), read from the app and not measured yet (calibrate:
  // O-02): the title over the description, then the photo with the price in the pill over media.
  invoice: {
    titleSize: 17,
    titleWeight: 600,
    priceSize: 14,
    label: 'INVOICE',
    sheet: { radius: 10, ...sheetLabels },
  },
  // The pinned bar, a gift's card and Restart (EVT-02): read from the app, calibrate: O-02.
  events: {
    pinned: {
      height: 44,
      gap: 6,
      radius: 22,
      padX: 14,
      line: 2,
      title: eventLabels.pinned,
      titleSize: 15,
      fontSize: 15,
    },
    gift: {
      width: 230,
      radius: 18,
      padding: '14px 16px',
      picture: 96,
      titleSize: 16,
      title: eventLabels.gift,
      fontSize: 15,
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
    codeCopy: null,
    play: null,
    back: null,
    menu: null,
  },
  light: {
    bubble: '#ffffff',
    text: '#000000',
    link: '#004bad',
    meta: '#77828c',
    views: '#77828c',
    accent: '#0088ff',
    codeText: '#000000',
    codeBg: 'transparent',
    preBg: 'rgba(0, 136, 255, 0.1)',
    preText: '#000000',
    preBar: '#0088ff',
    preHeaderBg: 'transparent',
    preLabel: '#0088ff',
    preIcon: '#0088ff',
    quoteBg: 'rgba(0, 136, 255, 0.1)',
    quoteBar: '#0088ff',
    webpageBg: 'rgba(0, 136, 255, 0.1)',
    webpageAccent: '#0088ff',
    spoilerDots: '#77828c',
    header: 'rgba(255, 255, 255, 0.7)',
    headerText: '#000000',
    headerSubtext: '#787878',
    headerBorder: 'transparent',
    headerShadow: 'none',
    headerIcon: '#000000',
    headerButton: 'rgba(255, 255, 255, 0.7)',
    headerFade: 'transparent',
    // The parts drawn from the wallpaper keep these until their fill is measured.
    share: 'rgba(0, 0, 0, 0.2)',
    shareIcon: '#ffffff',
    outline: 'rgba(0, 0, 0, 0.2)',
    shadow: 'transparent',
    tailShadow: 'transparent',
    mediaMetaBg: 'rgba(0, 0, 0, 0.3)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: 'rgba(0, 0, 0, 0.2)',
    mediaShade: 'transparent',
    durationBg: 'rgba(0, 0, 0, 0.3)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.45)',
    playIcon: '#ffffff',
    reactionBg: 'rgba(0, 136, 255, 0.1)',
    reactionText: '#0088ff',
    reactionOutsideBg: 'rgba(0, 0, 0, 0.2)',
    reactionOutsideText: '#ffffff',
    commentsText: '#0088ff',
    commentsIcon: '#0088ff',
    commentsBorder: '#c8c7cc',
    button: 'rgba(0, 0, 0, 0.2)',
    buttonText: '#ffffff',
    buttonSuccess: '#26972c',
    buttonPrimary: '#0088ff',
    buttonDanger: '#ff3b30',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#e1ffc7',
    outText: '#000000',
    outLink: '#004bad',
    outMeta: 'rgba(0, 140, 9, 0.8)',
    outCheck: '#19c700',
    outOutline: 'rgba(0, 0, 0, 0.2)',
    outShadow: 'transparent',
    serviceBg: 'rgba(0, 0, 0, 0.2)',
    serviceText: '#ffffff',
    typing: '#0088ff',
    composer: 'rgba(255, 255, 255, 0.7)',
    composerText: '#000000',
    composerPlaceholder: '#8e8e93',
    composerIcon: '#858e99',
    composerBorder: 'transparent',
    send: '#0088ff',
    menuButton: '#0088ff',
    menuButtonText: '#ffffff',
    replyPanel: '#d1d4da',
    replyButton: '#ffffff',
    replyButtonText: '#000000',
    replyButtonShadow: '0 1px 0 rgba(0, 0, 0, 0.3)',
    toast: 'rgba(0, 0, 0, 0.8)',
    toastText: '#ffffff',
    alert: '#f9f9f9',
    alertText: '#000000',
    alertButton: '#0088ff',
    scrim: 'rgba(0, 0, 0, 0.2)',
    empty: 'rgba(0, 0, 0, 0.2)',
    emptyText: '#ffffff',
    start: '#0088ff',
    startText: '#ffffff',
    commands: '#ffffff',
    commandsText: '#000000',
    commandsSubtext: '#8e8e93',
  },
  dark: {
    bubble: '#2a2334',
    text: '#ffffff',
    link: '#3e88f7',
    meta: 'rgba(255, 255, 255, 0.5)',
    views: 'rgba(255, 255, 255, 0.5)',
    accent: '#3e88f7',
    codeText: '#ffffff',
    codeBg: 'transparent',
    preBg: 'rgba(62, 136, 247, 0.1)',
    preText: '#ffffff',
    preBar: '#3e88f7',
    preHeaderBg: 'transparent',
    preLabel: '#3e88f7',
    preIcon: '#3e88f7',
    quoteBg: 'rgba(62, 136, 247, 0.1)',
    quoteBar: '#3e88f7',
    webpageBg: 'rgba(62, 136, 247, 0.1)',
    webpageAccent: '#3e88f7',
    spoilerDots: 'rgba(255, 255, 255, 0.5)',
    header: 'rgba(28, 28, 28, 0.85)',
    headerText: '#ffffff',
    headerSubtext: 'rgba(255, 255, 255, 0.5)',
    headerBorder: 'transparent',
    headerShadow: 'none',
    headerIcon: '#ffffff',
    headerButton: 'rgba(28, 28, 28, 0.85)',
    headerFade: 'rgba(0, 0, 0, 0.75)',
    share: 'rgba(29, 29, 29, 0.9)',
    shareIcon: '#ffffff',
    outline: 'transparent',
    shadow: 'transparent',
    tailShadow: 'transparent',
    mediaMetaBg: 'rgba(0, 0, 0, 0.3)',
    mediaMetaText: '#ffffff',
    mediaMetaIcon: '#ffffff',
    bigEmojiMetaBg: 'rgba(29, 29, 29, 0.9)',
    mediaShade: 'transparent',
    durationBg: 'rgba(0, 0, 0, 0.3)',
    durationText: '#ffffff',
    playBg: 'rgba(0, 0, 0, 0.45)',
    playIcon: '#ffffff',
    reactionBg: 'rgba(255, 255, 255, 0.07)',
    reactionText: '#ffffff',
    reactionOutsideBg: 'rgba(29, 29, 29, 0.9)',
    reactionOutsideText: '#ffffff',
    commentsText: '#3e88f7',
    commentsIcon: '#3e88f7',
    commentsBorder: '#000000',
    button: 'rgba(29, 29, 29, 0.9)',
    buttonText: '#ffffff',
    buttonSuccess: '#30cf30',
    buttonPrimary: '#3e88f7',
    buttonDanger: '#eb5545',
    // The private chat (PRV-02; calibrate: O-02).
    outBubble: '#3e88f7',
    outText: '#ffffff',
    outLink: '#ffffff',
    outMeta: 'rgba(255, 255, 255, 0.5)',
    outCheck: '#ffffff',
    outOutline: 'transparent',
    outShadow: 'transparent',
    serviceBg: 'rgba(0, 0, 0, 0.3)',
    serviceText: '#ffffff',
    typing: '#3e88f7',
    composer: 'rgba(28, 28, 28, 0.85)',
    composerText: '#ffffff',
    composerPlaceholder: 'rgba(255, 255, 255, 0.4)',
    composerIcon: 'rgba(255, 255, 255, 0.6)',
    composerBorder: 'transparent',
    send: '#3e88f7',
    menuButton: '#3e88f7',
    menuButtonText: '#ffffff',
    replyPanel: '#2c2c2e',
    replyButton: '#5a5a5e',
    replyButtonText: '#ffffff',
    replyButtonShadow: '0 1px 0 rgba(0, 0, 0, 0.5)',
    toast: 'rgba(28, 28, 28, 0.9)',
    toastText: '#ffffff',
    alert: '#1c1c1d',
    alertText: '#ffffff',
    alertButton: '#3e88f7',
    scrim: 'rgba(0, 0, 0, 0.5)',
    empty: 'rgba(0, 0, 0, 0.3)',
    emptyText: '#ffffff',
    start: '#3e88f7',
    startText: '#ffffff',
    commands: '#1c1c1d',
    commandsText: '#ffffff',
    commandsSubtext: 'rgba(255, 255, 255, 0.5)',
  },
}
