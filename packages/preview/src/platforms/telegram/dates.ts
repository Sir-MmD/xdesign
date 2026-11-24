// Formatted dates (docs/plan/19-x-proxies-server-media.md section 7.3): the apps draw a
// formatted_date entity in each reader's own language and time zone in place of its text
// (core.telegram.org/api/entities, date entities). The preview draws it for the viewer:
// the browser's language and zone.

/** What a formatted date shows, the flags of MTProto's messageEntityFormattedDate. */
export interface DateFlags {
  relative: boolean
  dayOfWeek: boolean
  shortDate: boolean
  longDate: boolean
  shortTime: boolean
  longTime: boolean
}

/** The Bot API's date_time_format: r alone, or up to one each of w, d or D, t or T in that order. */
const formatPattern = /^(?:r|w?[dD]?[tT]?)$/

/** The flags of a date format; undefined when it is not one. */
export function parseDateFormat(format: string): DateFlags | undefined {
  if (!formatPattern.test(format)) return undefined
  return {
    relative: format === 'r',
    dayOfWeek: format.includes('w'),
    shortDate: format.includes('d'),
    longDate: format.includes('D'),
    shortTime: format.includes('t'),
    longTime: format.includes('T'),
  }
}

/** Whether the apps draw a date for the flags; without any they show the text, as a link. */
export function drawsDate(flags: DateFlags): boolean {
  return Object.values(flags).some(Boolean)
}

const DAY = 86_400

/** The units of a relative date, largest first, in seconds. */
const relativeUnits: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['day', DAY],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>()
const dateFormats = new Map<string, Intl.DateTimeFormat>()

function relativeFormat(numeric: 'always' | 'auto'): Intl.RelativeTimeFormat {
  let format = relativeFormats.get(numeric)
  if (!format) {
    format = new Intl.RelativeTimeFormat(undefined, { numeric })
    relativeFormats.set(numeric, format)
  }
  return format
}

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options)
  let format = dateFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(undefined, options)
    dateFormats.set(key, format)
  }
  return format
}

/**
 * A relative date as the apps write it: "in 10 seconds", "3 minutes ago", "in 1 day",
 * rounded down to the largest whole unit; "now" within a second.
 */
export function relativeDate(unixSeconds: number, nowMs: number): string {
  const diff = unixSeconds - Math.floor(nowMs / 1000)
  const distance = Math.abs(diff)
  for (const [unit, size] of relativeUnits) {
    if (distance >= size) {
      const amount = Math.floor(distance / size)
      return relativeFormat('always').format(diff < 0 ? -amount : amount, unit)
    }
  }
  return relativeFormat('auto').format(0, 'second')
}

/**
 * The absolute forms in the apps' order (MTProto's): the day of the week, then the time
 * (short, or long with seconds), then the date (short, with its year only when it is not
 * this year, or long), joined by commas.
 */
export function absoluteDate(unixSeconds: number, flags: DateFlags, nowMs: number): string {
  const date = new Date(unixSeconds * 1000)
  const parts: string[] = []
  if (flags.dayOfWeek) parts.push(dateFormat({ weekday: 'long' }).format(date))
  if (flags.shortTime || flags.longTime) {
    parts.push(
      dateFormat({ hour: 'numeric', minute: '2-digit', ...(flags.longTime ? { second: '2-digit' } : {}) }).format(date),
    )
  }
  if (flags.shortDate) {
    const thisYear = date.getFullYear() === new Date(nowMs).getFullYear()
    parts.push(dateFormat({ day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) }).format(date))
  } else if (flags.longDate) {
    parts.push(dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(date))
  }
  return parts.join(', ')
}
