// Claude's calls (docs/plan/17 sections 13.2 and 13.4, MCP-01a): every tool call of the MCP
// connector runs in a scope that holds the key's person and the key. Activity rows written in it
// name the key ("via", src/audit.ts), and a route that xdesign_read or xdesign_change runs through
// the app's own router (app.inject with CallRequest, src/claude/actions.ts) is a request of that
// person (getSessionUser), whose "Confirm it's you" is never open: it stays a step in the browser,
// except for the one call the person said Yes to through Claude, or whose key does not ask first
// (ConfirmedCallRequest, MCP-01b). Only this process makes a CallRequest; a request from the
// network never is one.
import { AsyncLocalStorage } from 'node:async_hooks'
import { Readable } from 'node:stream'

import type { User } from '@xdesign/api'
import type { FastifyRequest } from 'fastify'

import type { SessionUser } from './context.ts'

// The key or (MCP-03a) the connected app a change was made through, as Activity names it: its ID
// (an app's is its grant's) and its name.
export interface Via {
  kind: 'key' | 'app'
  id: string
  name: string
}

interface CallScope {
  user: User
  via: Via
  // The Activity rows written in the call so far.
  rows: number
}

const scope = new AsyncLocalStorage<CallScope>()

// The raw request of an in-process call: light-my-request's `Request` option of app.inject makes
// the request inherit from it.
export class CallRequest extends Readable {}

// MCP-01b: the raw request of the one in-process call the person said Yes to (or whose key does
// not ask first): "Confirm it's you" counts as open for it, and only for it.
export class ConfirmedCallRequest extends CallRequest {}

// Runs a tool call of the key's person in its scope.
export function runCall<T>(user: User, via: Via, run: () => T): T {
  return scope.run({ user, via, rows: 0 }, run)
}

// The key of the call this code runs in, if any.
export function callVia(): Via | undefined {
  return scope.getStore()?.via
}

// Counts an Activity row of the call this code runs in.
export function countCallRow(): void {
  const call = scope.getStore()
  if (call) {
    call.rows += 1
  }
}

// The Activity rows written so far in the call this code runs in.
export function callRows(): number {
  return scope.getStore()?.rows ?? 0
}

// The person of an in-process call's request (null outside a call's scope), or undefined for a
// request from the network.
export function callUserOf(req: FastifyRequest): SessionUser | null | undefined {
  if (!(req.raw instanceof CallRequest)) {
    return undefined
  }
  const call = scope.getStore()
  if (!call) {
    return null
  }
  const confirmedUntil = req.raw instanceof ConfirmedCallRequest ? Number.MAX_SAFE_INTEGER : null
  return { ...call.user, sessionId: '', confirmedUntil }
}
