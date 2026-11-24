// Rate limits of signing in (docs/plan/02-architecture.md section 8 item 1): 5 failed tries per
// 15 minutes per IP address and per username, kept in memory (a restart forgets them). Wrong
// two-factor codes (TFA-01) count as sign-in tries. Claude's tool calls (MCP-01a, D-661): 120 a
// minute for each API key or connected app; the OAuth endpoints (MCP-03a): 60 requests a minute
// for each IP address.
import { ApiError } from '../errors.ts'

const maxTries = 5
const windowMs = 15 * 60 * 1000
// Past this many keys, every key's old tries are dropped at once.
const sweepAt = 10_000

export class TryLimit {
  // The times of the failed tries of each key ("ip:<address>", "username:<username>").
  private readonly tries = new Map<string, number[]>()
  // The answer's text once the tries are used.
  private readonly message: string

  constructor(message: string) {
    this.message = message
  }

  private recent(key: string, now: number): number[] {
    const times = (this.tries.get(key) ?? []).filter((at) => at > now - windowMs)
    if (times.length === 0) {
      this.tries.delete(key)
    } else {
      this.tries.set(key, times)
    }
    return times
  }

  // Answers 429 too_many_tries while any of the keys has used its tries (with `message` instead of
  // the limit's own text when given: the sign-in code step's).
  check(keys: string[], message = this.message): void {
    const now = Date.now()
    if (keys.some((key) => this.recent(key, now).length >= maxTries)) {
      throw new ApiError('too_many_tries', message)
    }
  }

  // Counts a failed try for each key.
  fail(keys: string[]): void {
    const now = Date.now()
    if (this.tries.size > sweepAt) {
      for (const key of [...this.tries.keys()]) {
        this.recent(key, now)
      }
    }
    for (const key of keys) {
      this.tries.set(key, [...this.recent(key, now), now])
    }
  }

  // Forgets the failed tries of a key and the same tries counted for the other keys of their
  // requests (one failed try stamps every key with one time).
  forget(key: string): void {
    const times = new Set(this.tries.get(key))
    this.tries.delete(key)
    if (times.size === 0) {
      return
    }
    for (const [other, at] of this.tries) {
      const left = at.filter((time) => !times.has(time))
      if (left.length === 0) {
        this.tries.delete(other)
      } else {
        this.tries.set(other, left)
      }
    }
  }
}

// The keys of a request: its IP address, and the username it is about when there is one.
export function tryKeys(ip: string, username?: string): string[] {
  return username === undefined ? [`ip:${ip}`] : [`ip:${ip}`, `username:${username}`]
}

export const signInTries = new TryLimit('Too many tries. Wait 15 minutes or ask the site owner to set a new password.')

// USER-02: "Set password" forgets the failed tries of the member's username, and the same tries
// counted for the addresses they came from, so a member locked out by wrong tries signs in with
// the new password at once.
export function forgetSignInTries(username: string): void {
  signInTries.forget(`username:${username}`)
}

const callWindowMs = 60 * 1000

// Calls in a sliding minute for each key: past `max`, a call answers 429 too_many_tries.
export class CallLimit {
  // The times of the calls of each key in the last minute.
  private readonly calls = new Map<string, number[]>()
  private readonly max: number
  private readonly message: string

  constructor(max: number, message: string) {
    this.max = max
    this.message = message
  }

  // Counts a call of the key, or refuses it once the key made `max` calls in the last minute.
  take(key: string): void {
    const now = Date.now()
    if (this.calls.size > sweepAt) {
      for (const [old, times] of this.calls) {
        if (times.every((at) => at <= now - callWindowMs)) {
          this.calls.delete(old)
        }
      }
    }
    const times = (this.calls.get(key) ?? []).filter((at) => at > now - callWindowMs)
    if (times.length >= this.max) {
      this.calls.set(key, times)
      throw new ApiError('too_many_tries', this.message)
    }
    this.calls.set(key, [...times, now])
  }
}

// One xdesign_edit_design call counts once, however many edits it makes.
export const claudeCalls = new CallLimit(120, 'Too many calls. Wait a minute.')
// MCP-03a: the authorize, token and registration endpoints together, for each IP address.
export const oauthCalls = new CallLimit(60, 'Too many requests from this address. Wait a minute.')
