// "Paste a map link" (docs/plan/04 section 5.4): the coordinates in a Google Maps, Apple Maps or
// OpenStreetMap link, read from the link's own text; nothing is loaded. A short link (such as
// maps.app.goo.gl) carries none until the browser opens it.

export interface Place {
  latitude: number
  longitude: number
}

const number = String.raw`(-?\d{1,3}(?:\.\d+)?)`
// "35.6892,51.3890", "35.6892, 51.3890", "35.6892%2C51.3890" after decoding.
const pair = new RegExp(`${number}\\s*,\\s*${number}`)
// Google's pin of a place: "!3d35.6892!4d51.3890" (the "@" part is only the view's middle).
const googlePin = new RegExp(`!3d${number}!4d${number}`)
// Google's view: "/@35.6892,51.3890,15z".
const googleView = new RegExp(`@${number},${number}`)
// OpenStreetMap's view: "#map=15/35.6892/51.3890".
const osmView = new RegExp(`map=\\d+(?:\\.\\d+)?/${number}/${number}`)
// The query fields that hold "lat,lng": Google (q, query, ll, center, destination, daddr), Apple
// (ll, q, sll, coordinate, daddr).
const fields = ['ll', 'q', 'query', 'coordinate', 'center', 'sll', 'destination', 'daddr']

function place(latitude: string | undefined, longitude: string | undefined): Place | undefined {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { latitude: lat, longitude: lng } : undefined
}

// A link's text with its escapes undone ("%2C" is a comma); as it is when an escape is broken.
function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function match(pattern: RegExp, text: string): Place | undefined {
  const found = pattern.exec(text)
  return found ? place(found[1], found[2]) : undefined
}

/** The coordinates of a map link, or of typed "latitude, longitude"; undefined when it has none. */
export function placeFromLink(text: string): Place | undefined {
  const trimmed = text.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return match(new RegExp(`^${pair.source}$`), trimmed)
  }
  const whole = decode(url.href)
  const pin = match(googlePin, whole)
  if (pin) return pin
  const params = url.searchParams
  const osm = place(params.get('mlat') ?? undefined, params.get('mlon') ?? undefined)
  if (osm) return osm
  for (const field of fields) {
    const value = params.get(field)
    const found = value === null ? undefined : match(pair, value)
    if (found) return found
  }
  return match(googleView, whole) ?? match(osmView, whole) ?? match(pair, decode(url.pathname))
}
