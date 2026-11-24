// Secret tokens of sessions, view-only links and Claude links (docs/plan/02-architecture.md section
// 8): 32 random bytes, given out once (the cookie, the link) and stored only as their SHA-256.
import { createHash, randomBytes, randomInt } from 'node:crypto'

// A new token as the cookie or the link carries it (base64url, 43 characters).
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

// The stored form of a token: the row's key or its token_hash.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const passwordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

// A generated password (init-owner, reset-password, the dev owner): letters and digits without
// the ones that look alike.
export function generatePassword(length = 32): string {
  let password = ''
  for (let i = 0; i < length; i++) {
    password += passwordAlphabet.charAt(randomInt(passwordAlphabet.length))
  }
  return password
}
