// The info row's counters and time (docs/plan/10-frontend.md section 8.9), and the counts of
// reactions and the avatar's letters as each app writes them (29 section 8.4, TGP-02).
import type { PreviewOptions } from '../../core/types'
import type { SkinTokens } from './skins/tokens'

/** "1.2K" for large view counts, as Telegram writes them. */
export function formatViews(n: number): string {
  if (n < 1000) return String(n)
  const scaled = n < 1_000_000 ? n / 1000 : n / 1_000_000
  const unit = n < 1_000_000 ? 'K' : 'M'
  return `${scaled < 10 ? scaled.toFixed(1).replace(/\.0$/, '') : String(Math.floor(scaled))}${unit}`
}

/**
 * A video's duration as the apps write it in its pill: "0:07", "12:30", "1:02:03" (29 section
 * 8.4); pad 'hours' writes the hours in two digits (Web A "01:02:03", duration.ts:99-111) and
 * 'minutes' the minutes always in two (Desktop "00:07", format_values.cpp:137-140; TGP-02).
 */
export function formatDuration(seconds: number, pad: 'hours' | 'minutes' | null = null): string {
  const total = Math.max(0, Math.floor(seconds))
  const s = String(total % 60).padStart(2, '0')
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  if (h > 0) return `${pad === 'hours' ? String(h).padStart(2, '0') : String(h)}:${String(m).padStart(2, '0')}:${s}`
  return `${pad === 'minutes' ? String(m).padStart(2, '0') : String(m)}:${s}`
}

/**
 * The time of the post: 24-hour on Web, 12-hour in the apps, unless the option says; the hour
 * in the look's form (SkinTokens.meta.hour: Web K "03:07 PM", TGP-02).
 */
export function formatTime(iso: string, skin: SkinTokens, options: PreviewOptions, timeZone?: string): string {
  const hour12 = options.timeFormat === 'auto' ? skin.hour12 : options.timeFormat === '12'
  const date = new Date(iso)
  const format: Intl.DateTimeFormatOptions = { hour: skin.meta.hour, minute: '2-digit', hour12 }
  try {
    return new Intl.DateTimeFormat('en-US', { ...format, timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', format).format(date)
  }
}

/** Web K's reaction count (formatNumber with two decimals, reaction.ts:1035): "999", "1.23K", "1.2K", "12.35K", "1.5M". */
export function webkCount(count: number): string {
  if (count <= 0) return '0'
  const units = ['', 'K', 'M', 'B', 'T']
  const unit = Math.min(Math.floor(Math.log(count) / Math.log(1000)), units.length - 1)
  return `${String(parseFloat((count / 1000 ** unit).toFixed(2)))}${units[unit] ?? ''}`
}

/**
 * Android's reaction count (AndroidUtilities.formatWholeNumber(count, 0) in float,
 * AndroidUtilities.java:4062-4111, ReactionsLayoutInBubble.java:908): "999", "1.2K" for 1234,
 * but "1K" for 1200 or 1500, as a whole number of tenths drops its decimal there.
 */
export function androidCount(count: number): string {
  if (count <= 0) return '0'
  if (count < 1000) return String(count)
  const units = ['', 'K', 'M', 'B', 'T', 'P']
  let num = Math.fround(count)
  let rest = count
  let unit = 0
  while (rest >= 1000 && unit < units.length - 1) {
    rest = Math.trunc(rest / 1000)
    num = Math.fround(num / 1000)
    unit++
  }
  if (num < 0.1) return '0'
  const tenths = Math.fround(num * 10)
  const label = tenths === Math.trunc(tenths) ? String(Math.trunc(num)) : (Math.trunc(tenths) / 10).toFixed(1)
  return `${label}${units[unit] ?? ''}`
}

/**
 * iOS's reaction count (countString, DefaultPresentationStrings.swift:99-125): "999", "1.2K"
 * (its tenths are the hundreds over 102, so 1999 is "1.9K"), "1.2M", and billions as "T".
 */
export function iosCount(count: number): string {
  const n = Math.max(0, Math.trunc(count))
  const short = (whole: number, tenth: number, unit: string) =>
    `${String(whole)}${tenth > 0 ? `.${String(tenth)}` : ''}${unit}`
  if (n >= 1e9) return short(Math.floor(n / 1e9), Math.floor((n % 1e9) / 1e8), 'T')
  if (n >= 1e6) return short(Math.floor(n / 1e6), Math.floor((n % 1e6) / 1e5), 'M')
  if (n >= 1000) return short(Math.floor(n / 1000), Math.floor((n % 1000) / 102), 'K')
  return String(n)
}

/** A title's first letter, capital: the avatar's letter in Desktop and iOS. */
export function firstLetter(title: string): string {
  return new Intl.Segmenter().segment(title.trim()).containing(0)?.segment.toUpperCase() ?? '?'
}

/** Web A's letter (getFirstLetters(title, 1), textFormat.ts:32-48, Avatar.tsx:262-264): the first word's first letter once punctuation is dropped. */
export function webAInitial(title: string): string {
  const word =
    title
      .replace(/[.,!@#$%^&*()_+=\-`~[\]/\\{}:"|<>?]+/g, '')
      .trim()
      .split(/\s+/)[0] ?? ''
  return firstLetter(word === '' ? title : word)
}

/** A text's first character as the reader sees it (an emoji with its joiners), or undefined for an empty text. */
function firstCharacter(text: string): string | undefined {
  return new Intl.Segmenter().segment(text).containing(0)?.segment
}

/** Web K's letters (getAbbreviation.ts, getPeerInitials.ts; capitals by _avatar.scss): the first letters of the title's first and last words. */
export function webkInitials(title: string): string {
  const words = title.trim().split(' ')
  const first = firstCharacter(words[0] ?? '')
  if (first === undefined) return '?'
  const last = words.length > 1 ? (firstCharacter(words[words.length - 1] ?? '') ?? '') : ''
  return (first + last).toUpperCase()
}

/**
 * Android's letters (AvatarDrawable.getAvatarSymbols, AvatarDrawable.java:509-542, capitals at
 * :717): a channel's title is its first name, so its first letter and, when a later word follows
 * a space, the letter the code takes at the first letter's length in the title (in effect the
 * title's second letter: "Tech News" is "TE").
 */
export function androidInitials(title: string): string {
  const first = firstCharacter(title)
  if (first === undefined) return '?'
  let later = false
  for (let a = title.length - 1; a >= 0; a--) {
    if (title[a] === ' ' && a !== title.length - 1 && title[a + 1] !== ' ') {
      later = true
      break
    }
  }
  const second = later ? (firstCharacter(title.slice(first.length)) ?? '') : ''
  return (first + second).toUpperCase()
}
