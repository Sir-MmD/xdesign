// Paragraph directions for the info row (docs/plan/10-frontend.md sections 8.6 and 8.9):
// Telegram's apps with a left-to-right interface put the info row on a line of its own
// under right-to-left text, where Web A floats it at the end of the last line: on the
// right, or on the left in a message that starts right to left. And the report of each
// line's direction for the preview option "Direction of each line" (20 section 4.3.7).
import type { Entity } from './model'

/** How a look places the info row after right-to-left text. */
export type RtlInfoRow =
  /** Web A: floated on the last line (the line makes room for it), else under it. Web A
   * writes the text with dir="auto", so a message whose first strong character is right
   * to left floats it left and mirrors its quotes (_message-content.scss, :dir(rtl)). */
  | 'float'
  /** Desktop: a line of its own when the last paragraph is right to left (lib_ui
   * String::endsWithQuoteOrOtherDirection). */
  | 'last'
  /** Android: a line of its own when any paragraph is right to left (MessageObject.hasRtl). */
  | 'any'
  /** iOS: a line of its own when a line after the last quote is right to left (the last
   * text segment's hasRTL). */
  | 'segment'
  /** Web K: a line of its own when the text holds any right-to-left character, anywhere
   * (bubbles.ts and isRTL.ts; 29 section 8.6). */
  | 'anyChar'

/** Web K's right-to-left characters (isRTL.ts): Hebrew to NKo, and the presentation forms. */
const webkRtlCharacter = /[֑-߿יִ-﷽ﹰ-ﻼ]/

/** Letters of right-to-left scripts (bidi classes R and AL) and the RLM and ALM marks. */
const rtlCharacter = /[\u0590-\u08FF\u200F\uFB1D-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u

/** The first strong character: a letter, or a left-to-right, right-to-left or Arabic mark. */
const strongCharacter = /[\p{L}\u061C\u200E\u200F]/u

/** A paragraph's direction from its first strong character (UAX #9 rules P2 and P3);
 * undefined without one (digits, emoji and punctuation only). */
export function paragraphDirection(paragraph: string): 'rtl' | 'ltr' | undefined {
  const first = strongCharacter.exec(paragraph)
  if (!first) return undefined
  return rtlCharacter.test(first[0]) ? 'rtl' : 'ltr'
}

const isRtl = (paragraph: string) => paragraphDirection(paragraph) === 'rtl'

/** Whether the info row takes a line of its own under the text in a look. */
export function infoRowOwnLine(text: string, entities: readonly Entity[], rule: RtlInfoRow): boolean {
  switch (rule) {
    case 'float':
      return false
    case 'last':
      return isRtl(text.slice(text.lastIndexOf('\n') + 1))
    case 'any':
      return text.split('\n').some(isRtl)
    case 'segment': {
      let start = 0
      for (const entity of entities) {
        if (entity.type === 'blockquote') start = Math.max(start, entity.offset + entity.length)
      }
      return text.slice(start).split('\n').some(isRtl)
    }
    case 'anyChar':
      return webkRtlCharacter.test(text)
  }
}

// ---------------------------------------------------------------------------------------------
// The direction of each line (docs/plan/20-cards-kinds-x-admins-docker.md section 4.3.7)
//
// The preview option "Direction of each line" lists, for the final text of a post, how the apps
// show each line (from its first strong character), the invisible marks the line carries and
// the lines that would flip: a @name, #tag, $TICKER or phone number that Telegram shows the
// wrong way round inside right-to-left text. It mirrors the formatter's rules
// (internal/format/direction.go: scanLines, findTokens, lineFlip, and digits.go: phoneAt), so
// the list and the `bidi_flip_risk` warning of the server agree.
// ---------------------------------------------------------------------------------------------

/** The strength of a character: left-to-right (bidi class L), right-to-left (R or AL), or none. */
type Strength = 'L' | 'R' | undefined

const LRM = '\u{200E}'
const RLM = '\u{200F}'
const ALM = '\u{061C}'

/** The names of the three direction marks, for the list and the ticks. */
export const markNames: Readonly<Record<string, { short: string; title: string }>> = {
  [LRM]: { short: 'LRM', title: 'LRM: left-to-right mark' },
  [RLM]: { short: 'RLM', title: 'RLM: right-to-left mark' },
  [ALM]: { short: 'ALM', title: 'ALM: Arabic letter mark' },
}

const isMark = (ch: string) => ch === LRM || ch === RLM || ch === ALM

/** Characters of bidi class R or AL that are not letters: Arabic and Hebrew punctuation. */
const rtlSymbol =
  /[\u{05BE}\u{05C0}\u{05C3}\u{05C6}\u{05F3}\u{05F4}\u{0608}\u{060B}\u{060D}\u{061B}\u{061D}-\u{061F}\u{066D}\u{06D4}]/u

/** The flags: pairs of regional indicators, which are strong left-to-right characters. */
const regionalIndicator = /[\u{1F1E6}-\u{1F1FF}]/u

/** The strength of one character: letters by their script, the marks, flags and Arabic punctuation. */
function strengthOf(ch: string): Strength {
  if (ch === LRM) return 'L'
  if (ch === RLM || ch === ALM) return 'R'
  if (regionalIndicator.test(ch)) return 'L'
  if (/^\p{L}$/u.test(ch)) return rtlCharacter.test(ch) ? 'R' : 'L'
  return rtlSymbol.test(ch) ? 'R' : undefined
}

/** White space as the formatter counts it (Go's unicode.IsSpace). */
const space = /^[\t\n\v\f\r\u{0085}\p{Z}]$/u

/** The character that starts at UTF-16 index `i`, whole when it is a surrogate pair. */
function runeAt(text: string, i: number): string {
  return String.fromCodePoint(text.codePointAt(i) ?? 0)
}

/** The character that ends at index `i` (> 0). */
function runeBefore(text: string, i: number): string {
  const low = text.charCodeAt(i - 1)
  if (low >= 0xdc00 && low < 0xe000 && i >= 2) {
    const high = text.charCodeAt(i - 2)
    if (high >= 0xd800 && high < 0xdc00) return text.slice(i - 2, i)
  }
  return text.charAt(i - 1)
}

const isAsciiLetter = (c: number) => (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)
const isAsciiDigit = (c: number) => c >= 0x30 && c <= 0x39
/** An ASCII letter, digit or underscore: the characters of a @username. */
const isNameUnit = (c: number) => isAsciiLetter(c) || isAsciiDigit(c) || c === 0x5f

/** A character that continues a #hashtag: any astral character, ASCII letters, digits and _, and letters, marks and digits. */
function isWordRune(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0
  if (cp >= 0x10000) return true
  if (cp < 0x80) return isNameUnit(cp)
  return /^[\p{L}\p{M}\p{Nd}]$/u.test(ch)
}

/** A character that makes a following @, # or $ part of a word (an e-mail address, a name). */
function joinsToken(ch: string): boolean {
  return /^[\p{L}\p{Nd}\p{M}_@#$]$/u.test(ch)
}

/** The URLs written as text that Telegram makes links, and the bare domains and e-mail addresses (digits.go linkRanges). */
const textUrl = /(?:\b(?:https?|tg):\/\/|\bwww\.|\b(?:t\.me|telegram\.me|telegram\.dog)\/)[^\s<>"'«»“”‘’]+/giu
const bareDomain =
  /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}\b(?:\/[^\s<>"'«»“”‘’]*)?/giu
const emailAddress =
  /[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}/giu

/** The ranges of the URLs, bare domains and e-mail addresses of a text, where no token is looked for. */
function linkRanges(text: string): [number, number][] {
  const out: [number, number][] = []
  for (const match of text.matchAll(textUrl)) {
    const start = match.index
    let end = start + match[0].length
    // The punctuation that ends a sentence is not part of the URL (format/link.go findURLs).
    while (end > start) {
      const c = text.charAt(end - 1)
      if (!'.,;:!?\'"]}'.includes(c) && (c !== ')' || text.slice(start, end).includes('('))) break
      end--
    }
    if (end > start) out.push([start, end])
  }
  for (const re of [bareDomain, emailAddress]) {
    for (const match of text.matchAll(re)) out.push([match.index, match.index + match[0].length])
  }
  return out
}

/** Entities whose text holds no token (code, pre, custom emoji, formatted dates), and the code ones. */
const maskedTypes: ReadonlySet<string> = new Set(['code', 'pre', 'custom_emoji', 'formatted_date'])
const codeTypes: ReadonlySet<string> = new Set(['code', 'pre'])

function markRange(mask: boolean[], start: number, end: number): void {
  for (let i = Math.max(start, 0); i < end && i < mask.length; i++) mask[i] = true
}

/** A token that flips inside right-to-left text unless an LRM stands before it. */
interface Token {
  start: number
  end: number
  kind: 'sigil' | 'phone'
}

/** The longest $TICKER. */
const MAX_TICKER = 8

/** The @name, #tag or $TICKER that starts at `i` in the line [start, end), if any (format/direction.go sigilAt). */
function sigilAt(text: string, i: number, start: number, end: number): Token | undefined {
  const c = text.charAt(i)
  if ((c !== '@' && c !== '#' && c !== '$') || i + 1 >= end || !isAsciiLetter(text.charCodeAt(i + 1))) return undefined
  if (i > start && joinsToken(runeBefore(text, i))) return undefined
  let j = i + 1
  if (c === '@') {
    while (j < end && isNameUnit(text.charCodeAt(j))) j++
  } else if (c === '#') {
    while (j < end) {
      const ch = runeAt(text, j)
      if (!isWordRune(ch)) break
      j += ch.length
    }
  } else {
    while (j < end && text.charCodeAt(j) >= 0x41 && text.charCodeAt(j) <= 0x5a) j++
    const letters = j - i - 1
    if (letters < 1 || letters > MAX_TICKER || (j < end && isNameUnit(text.charCodeAt(j)))) return undefined
  }
  return { start: i, end: j, kind: 'sigil' }
}

/** A decimal digit that phone numbers are written with: ASCII, Persian and Arabic-Indic. */
function isDecimal(c: number): boolean {
  return isAsciiDigit(c) || (c >= 0x06f0 && c <= 0x06f9) || (c >= 0x0660 && c <= 0x0669)
}

const MIN_PHONE_DIGITS = 7
const MIN_LOCAL_PHONE_DIGITS = 9
const MIN_PHONE_GROUP_AFTER = 3

/**
 * The end of the phone-like number that starts at `i` in the line ending at `end`, or
 * undefined: an optional +, digit groups joined by single spaces or hyphens, at least 7 digits
 * after a +, and without one at least 9 digits in two groups or more, each after the first of
 * at least 3 (format/digits.go phoneAt).
 */
function phoneAt(text: string, i: number, end: number): number | undefined {
  const plus = text.charAt(i) === '+'
  let j = plus ? i + 1 : i
  if (j >= end || !isDecimal(text.charCodeAt(j))) return undefined
  if (i > 0 && /^[\p{L}\p{Nd}\p{M}_+\-.,:/]$/u.test(runeBefore(text, i))) return undefined
  let digits = 0
  let groups = 0
  let shortAfter = false
  let last: number
  for (;;) {
    let k = j
    while (k < end && isDecimal(text.charCodeAt(k))) k++
    if (groups > 0 && k - j < MIN_PHONE_GROUP_AFTER) shortAfter = true
    digits += k - j
    groups++
    const joiner = text.charAt(k)
    if (k + 1 < end && (joiner === ' ' || joiner === '-') && isDecimal(text.charCodeAt(k + 1))) {
      j = k + 1
      continue
    }
    last = k
    break
  }
  if (last < end && /^[\p{L}\p{Nd}]$/u.test(runeAt(text, last))) return undefined
  if (digits < MIN_PHONE_DIGITS) return undefined
  if (!plus && (digits < MIN_LOCAL_PHONE_DIGITS || groups < 2 || shortAfter)) return undefined
  return last
}

/** The tokens of the line [start, end) outside the units `skip` marks, in their order. */
function findTokens(text: string, skip: readonly boolean[], start: number, end: number): Token[] {
  const out: Token[] = []
  for (let i = start; i < end; i++) {
    if (skip[i] === true) continue
    let token = sigilAt(text, i, start, end)
    if (!token) {
      const phoneEnd = phoneAt(text, i, end)
      if (phoneEnd !== undefined) token = { start: i, end: phoneEnd, kind: 'phone' }
    }
    if (!token) continue
    out.push(token)
    i = token.end - 1
  }
  return out
}

/** The strength of the nearest strong character before position `p` in the line that starts at `lineStart`. */
function nearestStrong(text: string, lineStart: number, p: number): Strength {
  for (let i = p; i > lineStart;) {
    const ch = runeBefore(text, i)
    i -= ch.length
    const strength = strengthOf(ch)
    if (strength) return strength
  }
  return undefined
}

/** A token as a reader sees it flipped: the sign of a @name, #tag or $TICKER after the name; the groups of a phone number reversed. */
function flippedToken(token: string, kind: Token['kind']): string {
  if (kind === 'sigil') return token.slice(1) + token.slice(0, 1)
  const plus = token.startsWith('+')
  const body = plus ? token.slice(1) : token
  const groups = body.split(/[ -]/u)
  const joiners = [...body.matchAll(/[ -]/gu)].map((m) => m[0])
  if (plus) groups[0] = `${groups[0] ?? ''}+`
  let out = ''
  for (let i = groups.length - 1; i >= 0; i--) {
    out += groups[i] ?? ''
    if (i > 0) out += joiners[i - 1] ?? ''
  }
  return out
}

/** How the apps show a line: from its first strong character; `auto` without one (the app's own direction decides). */
export type LineDirection = 'rtl' | 'ltr' | 'auto'

/** A token a reader sees the wrong way round. */
export interface LineFlip {
  token: string
  screen: string
  /** The line is right-to-left; false: a phone number in a left-to-right line that follows right-to-left words. */
  inRtlLine: boolean
}

/** One non-empty line of the text, for the list "Direction of each line". */
export interface LineReport {
  /** The line's number; every line break counts, as in the server's warning. */
  number: number
  direction: LineDirection
  /** The first characters of the line; its (invisible) direction marks stay in it, so it reads as in the bubble. */
  text: string
  /** The line goes on after `text`. */
  more: boolean
  /** The direction marks the line carries: "RLM at start", "LRM before @yourchannel". */
  marks: string[]
  flip?: LineFlip
}

/** How many characters of a line the list shows. */
export const LINE_PREVIEW_CHARS = 28

/** The longest token or word the list names in "LRM before ...". */
const NAMED_CHARS = 24

function shorten(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? `${chars.slice(0, max).join('')}...` : text
}

/** The end of a text: the last `max` characters, with "..." in front when it is longer. */
function tail(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? `...${chars.slice(-max).join('')}` : text
}

/**
 * The first `max` characters of a line and whether it goes on. The direction marks stay in
 * the text (they are invisible and not counted), so the list shows the line in the same
 * order as the bubble does.
 */
function lineStart(line: string, max: number): { text: string; more: boolean } {
  let text = ''
  let count = 0
  for (const ch of line.trim()) {
    if (!isMark(ch)) {
      if (count === max) return { text, more: true }
      count++
    }
    text += ch
  }
  return { text, more: false }
}

/**
 * The report of each non-empty line of a post's final text: its direction (the first strong
 * character counts, marks included), its marks, and whether a token in it would flip (a
 * token in a right-to-left line whose nearest strong character before it is right-to-left,
 * with no LRM between; a phone number in a left-to-right line after right-to-left words).
 * Lines that start inside code or pre get no flip check, as on the server.
 */
export function lineReport(text: string, entities: readonly Entity[]): LineReport[] {
  const skip = new Array<boolean>(text.length).fill(false)
  const code = new Array<boolean>(text.length).fill(false)
  for (const entity of entities) {
    const end = entity.offset + entity.length
    if (maskedTypes.has(entity.type)) markRange(skip, entity.offset, end)
    if (codeTypes.has(entity.type)) markRange(code, entity.offset, end)
  }
  for (const [start, end] of linkRanges(text)) markRange(skip, start, end)

  const out: LineReport[] = []
  let start = 0
  let number = 0
  while (start <= text.length) {
    let end = text.indexOf('\n', start)
    if (end < 0) end = text.length
    number++
    if (!Array.from(text.slice(start, end)).every((ch) => space.test(ch))) {
      out.push(reportLine(text, start, end, number, skip, code[start] === true))
    }
    start = end + 1
  }
  return out
}

function reportLine(
  text: string,
  start: number,
  end: number,
  number: number,
  skip: readonly boolean[],
  inCode: boolean,
): LineReport {
  let first: Strength
  for (let i = start; i < end && first === undefined;) {
    const ch = runeAt(text, i)
    i += ch.length
    first = strengthOf(ch)
  }
  const tokens = findTokens(text, skip, start, end)
  const marks: string[] = []
  let onlySpace = true
  for (let i = start; i < end;) {
    const ch = runeAt(text, i)
    const at = i
    i += ch.length
    if (isMark(ch)) {
      const name = markNames[ch]?.short ?? 'Mark'
      const next = tokens.find((token) => token.start === i)
      if (onlySpace) marks.push(`${name} at start`)
      else if (next) marks.push(`${name} before ${shorten(text.slice(next.start, next.end), NAMED_CHARS)}`)
      else marks.push(`${name} after ${tail(text.slice(start, at).trim(), NAMED_CHARS / 2)}`)
    } else if (!space.test(ch)) {
      onlySpace = false
    }
  }
  const shown = lineStart(text.slice(start, end), LINE_PREVIEW_CHARS)
  const report: LineReport = {
    number,
    direction: first === 'R' ? 'rtl' : first === 'L' ? 'ltr' : 'auto',
    text: shown.text,
    more: shown.more,
    marks,
  }
  if (first && !inCode) {
    const rtl = first === 'R'
    for (const token of tokens) {
      const near = nearestStrong(text, start, token.start) ?? first
      if (near !== 'R' || (!rtl && token.kind !== 'phone')) continue
      const written = text.slice(token.start, token.end)
      report.flip = { token: written, screen: flippedToken(written, token.kind), inRtlLine: rtl }
      break
    }
  }
  return report
}
