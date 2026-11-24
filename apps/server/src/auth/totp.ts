// TFA-01: the codes of an authenticator app, TOTP of RFC 6238 by hand with node:crypto as xWriter
// (internal/services/auth/totp): HMAC-SHA1, 6 digits, 30-second steps from the Unix epoch, 20-byte
// secrets written in base32 without padding (RFC 4648), which every common app supports.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const digits = 6
const periodSeconds = 30
const secretBytes = 20
// The name authenticator apps show.
const issuer = 'xDesign'

const rfc4648 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// Base32 without padding in the given alphabet (also the recovery codes' Crockford alphabet).
export function base32(bytes: Buffer, alphabet = rfc4648): string {
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff
    bits += 8
    while (bits >= 5) {
      out += alphabet.charAt((value >>> (bits - 5)) & 31)
      bits -= 5
    }
  }
  if (bits > 0) {
    out += alphabet.charAt((value << (5 - bits)) & 31)
  }
  return out
}

function fromBase32(text: string): Buffer {
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of text) {
    const index = rfc4648.indexOf(char)
    if (index < 0) {
      throw new Error('The authenticator secret is not base32.')
    }
    value = ((value << 5) | index) & 0xffff
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// A new secret, as the database keeps it and the app's "enter a key" field takes it.
export function newTotpSecret(): string {
  return base32(randomBytes(secretBytes))
}

// The time step of a time in milliseconds.
export function totpStep(now: number): number {
  return Math.floor(now / 1000 / periodSeconds)
}

// RFC 4226 section 5.3: the HMAC-SHA1 of the counter, dynamic truncation, the last 6 digits.
function totpCode(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const sum = createHmac('sha1', secret).update(counter).digest()
  const offset = (sum.at(-1) ?? 0) & 0x0f
  const value = sum.readUInt32BE(offset) & 0x7fffffff
  return String(value % 10 ** digits).padStart(digits, '0')
}

// The step whose code is `input` among the step before now, now's and the one after (30 seconds of
// clock drift either way), skipping steps at or below `lastStep` (each code works once); null when
// none matches. Spaces in the input are ignored. Every candidate is compared in constant time.
export function matchTotp(secret: string, input: string, now: number, lastStep: number): number | null {
  const typed = input.replace(/\s/g, '')
  if (!/^\d{6}$/.test(typed)) {
    return null
  }
  const key = fromBase32(secret)
  const current = totpStep(now)
  let matched: number | null = null
  for (let step = current - 1; step <= current + 1; step++) {
    const equal = timingSafeEqual(Buffer.from(totpCode(key, step)), Buffer.from(typed))
    if (equal && step > lastStep && matched === null) {
      matched = step
    }
  }
  return matched
}

// The otpauth address the QR code carries; the domain in the account's name tells sites apart:
// otpauth://totp/xDesign%20(<domain>):<username>?secret=<KEY>&issuer=xDesign&algorithm=SHA1&digits=6&period=30
// (USER-01a: an app set up before usernames keeps its label with the email; its codes still work).
export function totpUri(domain: string, username: string, secret: string): string {
  const label = `${encodeURIComponent(`${issuer} (${domain})`)}:${encodeURIComponent(username)}`
  const query = [
    `secret=${secret}`,
    `issuer=${encodeURIComponent(issuer)}`,
    'algorithm=SHA1',
    `digits=${String(digits)}`,
    `period=${String(periodSeconds)}`,
  ]
  return `otpauth://totp/${label}?${query.join('&')}`
}
