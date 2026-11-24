// Asking first (docs/plan/17 section 13.4, D-658, MCP-01b), as xWriter: an action that cannot be
// undone, or a route that needs "Confirm it's you", runs through Claude only once the person said
// Yes. When Claude's app can show questions (MCP elicitation in form mode), xDesign asks in the chat
// itself, on the call's own stream ("<the action in words>, <the item's name>?" with Yes and No),
// waiting up to 10 minutes; Claude cannot answer it for the person. When it cannot (a No in under 3
// seconds marks the key "can't show questions"), the call answers the question with a ticket:
// Claude shows it to the person and runs the call again with confirm: true and the ticket, which
// works once within 10 minutes for that exact call (the key, the person, the tool, the action with
// its whole input, and the question). A key whose "Ask first" the site owner turned off is never
// asked: its actions run at once, and the answer says so. Tickets live in memory: a restart drops
// them, and Claude asks again. A connected app (MCP-03a) is the second kind of Principal, with its
// own switches.
import { createHash, randomBytes } from 'node:crypto'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ErrorCode, McpError, type RequestId } from '@modelcontextprotocol/sdk/types.js'

import type { Via } from '../auth/calls.ts'
import { log } from '../log.ts'
import { markCannotAsk, viaNouns, type KeyUser } from './keys.ts'

const minuteMs = 60 * 1000
// How long a question waits for the person's answer; no answer is a No.
const askWaitMs = 10 * minuteMs
// A No this soon comes from the app itself, not from a person who read the question.
const fastAnswerMs = 3000
// How long a ticket works; past maxTickets the oldest ones end early.
const ticketMs = 10 * minuteMs
const maxTickets = 10000
// The SDK's error of a question that got no answer within askWaitMs.
const requestTimeout: number = ErrorCode.RequestTimeout

// The key or the connected app (MCP-03a) a call comes through, its person and its switches.
export interface Principal {
  via: Via
  userId: string
  askFirst: boolean
  cannotAsk: boolean
}

export function principalOf(key: KeyUser): Principal {
  return {
    via: key.via,
    userId: key.id,
    askFirst: key.askFirst,
    cannotAsk: key.cannotAsk,
  }
}

// The line of an answer that ran without asking.
export function ranUnasked(principal: Principal): string {
  return `Ran without asking: Ask first is off for this ${viaNouns[principal.via.kind]}.`
}

function markCannotShow(principal: Principal): void {
  markCannotAsk(principal.via)
  log.info({ via: principal.via }, "Claude's app answered a question in under 3 seconds: it can't show questions")
}

// What a call says to its question where Claude's app cannot ask the person itself.
export interface Said {
  confirm?: boolean | undefined
  ticket?: string | undefined
}

// What the asking needs of the tool call: the session's server, and the call's request ID and
// signal, so the question goes on the call's own stream and ends with it.
export interface CallContext {
  server: McpServer
  requestId: RequestId
  signal: AbortSignal
}

// A question: its words, and the call it is about (the tool, the action and its whole input),
// which its ticket binds.
export interface Question {
  words: string
  tool: string
  action: string
  input: Record<string, unknown>
}

// The answer of an action that did not run: the question, the ticket that a Yes through Claude's
// own answer carries, and what happened, for Claude.
export interface NotDone {
  action: string
  done: false
  question: string
  ticket?: string
  note: string
}

export type Asked = { run: true; unasked: boolean } | { run: false; answer: NotDone }

// JSON with every object's names in order, so the same input written another way is the same call.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries.map(([name, item]) => [name, canonical(item)]))
  }
  return value
}

// What a ticket answers: the principal, the person, the tool, the action, its input and the words.
function bindingOf(principal: Principal, question: Question): string {
  const { via, userId } = principal
  const bound = [via.kind, via.id, userId, question.tool, question.action, canonical(question.input), question.words]
  return createHash('sha256').update(JSON.stringify(bound)).digest('hex')
}

// The tickets that work, by token, the oldest first.
const tickets = new Map<string, { binding: string; expires: number }>()

function issueTicket(binding: string): string {
  const now = Date.now()
  for (const [token, ticket] of tickets) {
    if (ticket.expires > now && tickets.size < maxTickets) {
      break
    }
    tickets.delete(token)
  }
  const token = randomBytes(16).toString('base64url')
  tickets.set(token, { binding, expires: now + ticketMs })
  return token
}

// Uses a ticket for a call: true when it still worked and binds this very call. The first call
// that names a ticket ends it, whatever call it is.
function takeTicket(token: string | undefined, binding: string): boolean {
  const name = token?.trim() ?? ''
  const ticket = tickets.get(name)
  if (!ticket) {
    return false
  }
  tickets.delete(name)
  return ticket.expires > Date.now() && ticket.binding === binding
}

function notDone(question: Question, note: string, ticket?: string): Asked {
  return {
    run: false,
    answer: { action: question.action, done: false, question: question.words, ...(ticket && { ticket }), note },
  }
}

// The answer of a call that needs the person's Yes through Claude's own answer, with a new ticket.
function needsYes(question: Question, binding: string, first: string): Asked {
  const again = `Show the person the question, and once they say Yes call ${question.tool} again with the same action and input, confirm: true and this answer's ticket. The ticket works once, within 10 minutes.`
  return notDone(question, `${first} ${again}`, issueTicket(binding))
}

// Whether Claude's app shows questions: it announced elicitation in form mode, and no fast No
// marked its key.
function canElicit(principal: Principal, call: CallContext): boolean {
  return !principal.cannotAsk && call.server.server.getClientCapabilities()?.elicitation?.form !== undefined
}

// Asks the person before the call runs, as the principal's switches and Claude's app allow.
export async function askFirst(
  principal: Principal,
  question: Question,
  said: Said,
  call: CallContext,
): Promise<Asked> {
  if (!principal.askFirst) {
    return { run: true, unasked: true }
  }
  const binding = bindingOf(principal, question)
  if (canElicit(principal, call)) {
    const asked = Date.now()
    try {
      const answer = await call.server.server.elicitInput(
        { mode: 'form', message: question.words, requestedSchema: { type: 'object', properties: {} } },
        { relatedRequestId: call.requestId, signal: call.signal, timeout: askWaitMs },
      )
      if (answer.action === 'accept') {
        return { run: true, unasked: false }
      }
      if (Date.now() - asked >= fastAnswerMs) {
        return notDone(question, 'The person said No, so nothing was done. Do not run it again unless they ask for it.')
      }
      markCannotShow(principal)
      return needsYes(question, binding, "This action asks the person first, and this app can't show questions.")
    } catch (error) {
      if (call.signal.aborted) {
        return notDone(question, 'The call was cancelled before the person answered, so nothing was done.')
      }
      if (error instanceof McpError && error.code === requestTimeout) {
        return notDone(question, 'The person did not answer within 10 minutes, so nothing was done.')
      }
      log.warn({ err: error }, "Claude's app could not ask the person, so the action needs confirm")
    }
  }
  if (said.confirm !== true) {
    return needsYes(question, binding, 'This action asks the person first, and this app cannot ask them itself.')
  }
  if (takeTicket(said.ticket, binding)) {
    return { run: true, unasked: false }
  }
  return needsYes(
    question,
    binding,
    "Nothing was done: the person's Yes counts only with the ticket of an answer that held this very question, once and within 10 minutes.",
  )
}
