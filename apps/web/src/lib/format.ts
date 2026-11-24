// Sizes and durations for people (Maintenance's status, backups and the update's upload), copied
// from xWriter's web/src/lib/format.ts.

const byteUnits = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

/** "512 bytes", "48.2 MB", "27.5 GB": powers of 1,024, one decimal under 100. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < byteUnits.length - 1) {
    value /= 1024
    unit += 1
  }
  if (unit === 0) return value === 1 ? '1 byte' : `${String(Math.round(value))} bytes`
  const shown = value < 100 ? (Math.round(value * 10) / 10).toString() : String(Math.round(value))
  return `${shown} ${byteUnits[unit] ?? ''}`
}

/** "45 s", "12 min", "2 h 5 min", "3 days 4 h": a duration in seconds, two parts at most. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unknown'
  const total = Math.floor(seconds)
  if (total < 60) return `${String(total)} s`
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) {
    const dayText = days === 1 ? '1 day' : `${String(days)} days`
    return hours > 0 ? `${dayText} ${String(hours)} h` : dayText
  }
  if (hours > 0) return minutes > 0 ? `${String(hours)} h ${String(minutes)} min` : `${String(hours)} h`
  return `${String(minutes)} min`
}
