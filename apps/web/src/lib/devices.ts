// Plain words for the account page's "Sessions" (docs/plan/04 section 2): the device of a session
// from its browser's user agent ("Firefox on Linux"); when it was last used is lib/time.ts's.

const browsers: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bChrome\/|\bCriOS\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
]

const systems: [RegExp, string][] = [
  [/\bAndroid\b/, 'Android'],
  [/\biPhone\b|\biPad\b|\biPod\b/, 'iOS'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bLinux\b/, 'Linux'],
]

function first(list: [RegExp, string][], text: string): string | undefined {
  return list.find(([pattern]) => pattern.test(text))?.[1]
}

/** "Firefox on Linux", "Safari on iOS", "Chrome"; "Unknown device" without a user agent. */
export function deviceName(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim() === '') return 'Unknown device'
  const browser = first(browsers, userAgent)
  const system = first(systems, userAgent)
  if (browser !== undefined && system !== undefined) return `${browser} on ${system}`
  return browser ?? system ?? 'Unknown device'
}
