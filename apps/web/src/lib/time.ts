// Times on the pages, in the person's browser locale: how long ago ("5 minutes ago", "yesterday")
// for the cards of Designs, the members' last seen and the sessions of Account, and the date with
// the time for the Activity list and the tooltips.

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const date = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 24 * 60 * 60],
]

/** "just now", "5 minutes ago", "yesterday", "12 days ago"; a date from 30 days back. */
export function timeAgo(time: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - time) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds >= 30 * 24 * 60 * 60) return date.format(time)
  let unit: Intl.RelativeTimeFormatUnit = 'minute'
  let size = 60
  for (const [name, length] of steps) {
    if (seconds >= length) {
      unit = name
      size = length
    }
  }
  return relative.format(-Math.floor(seconds / size), unit)
}

/** The date: "Nov 23, 2026". */
export function formatDate(time: number): string {
  return date.format(time)
}

/** The date and time: "Nov 23, 2026, 2:05 PM". */
export function formatDateTime(time: number): string {
  return dateTime.format(time)
}
