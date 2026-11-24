// The client of the Go helper's control socket (docs/plan/07 section 1, D-33): HTTP with JSON on
// the Unix socket the helper passes as XD_CONTROL_SOCKET, or on Windows (docs/plan/18 section 8.2)
// on 127.0.0.1 at XD_CONTROL_URL with XD_CONTROL_SECRET in Authorization: Bearer. The routes check
// the person first (the site owner, "Confirm it's you"); the helper trusts only its socket or its
// secret. Its answers come back with the names in camelCase and the times in UTC milliseconds; its
// refusals become ApiErrors with its plain words. Without the helper (`make dev`) every call
// answers no_helper.
import { request, type IncomingHttpHeaders, type IncomingMessage, type RequestOptions } from 'node:http'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import type { ApiErrorCode } from '@xdesign/api'

import { config } from '../config.ts'
import { ApiError } from '../errors.ts'
import { log } from '../log.ts'

// An answer of JSON is read up to this size.
const maxAnswer = 4 * 1024 * 1024
// The time a call may wait for the helper without a byte; 0 for the calls that work long (a
// backup, the check of an upload), which the helper bounds itself.
const defaultTimeoutMs = 30_000

const notAnswering = 'The server helper did not answer. Try again in a moment.'

export interface CallOptions {
  // A JSON body, or a stream sent as it is (an upload) with its headers.
  json?: unknown
  stream?: Readable
  headers?: Record<string, string>
  timeoutMs?: number
}

// The helper's status codes as the API's error codes.
function codeOf(status: number): ApiErrorCode {
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 413) return 'too_large'
  if (status >= 400 && status < 500) return 'bad_request'
  return 'server_error'
}

// Where the helper's control server is: its socket, or its address with the secret; null without
// the helper.
function controlTarget(): { where: RequestOptions; authorization?: string } | null {
  if (config.controlSocket !== undefined) {
    return { where: { socketPath: config.controlSocket } }
  }
  if (config.controlUrl !== undefined && config.controlSecret !== undefined) {
    const url = new URL(config.controlUrl)
    return { where: { host: url.hostname, port: url.port }, authorization: `Bearer ${config.controlSecret}` }
  }
  return null
}

// Sends one request and resolves with the answer's head; the body is the caller's to read.
function send(method: string, path: string, options: CallOptions): Promise<IncomingMessage> {
  const target = controlTarget()
  if (target === null) {
    return Promise.reject(new ApiError('no_helper'))
  }
  const json = options.json === undefined ? undefined : JSON.stringify(options.json)
  const headers: Record<string, string> = { ...options.headers }
  if (target.authorization !== undefined) {
    headers.authorization = target.authorization
  }
  if (json !== undefined) {
    headers['content-type'] = 'application/json'
    headers['content-length'] = String(Buffer.byteLength(json))
  }
  return new Promise((resolve, reject) => {
    const req = request(
      { ...target.where, method, path, headers, timeout: options.timeoutMs ?? defaultTimeoutMs },
      resolve,
    )
    req.on('timeout', () => req.destroy(new Error('no answer in time')))
    req.on('error', (error) => {
      log.warn({ err: error, method, path }, 'control socket call failed')
      reject(new ApiError('no_helper', notAnswering))
    })
    if (options.stream) {
      // A cut upload ends the helper's request too, which then drops the part it got.
      pipeline(options.stream, req).catch((error: unknown) => req.destroy(error as Error))
    } else {
      req.end(json)
    }
  })
}

async function readText(answer: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of answer) {
    const part = chunk as Buffer
    size += part.length
    if (size > maxAnswer) {
      answer.destroy()
      throw new ApiError('server_error', 'The server helper sent an answer that is too large.')
    }
    chunks.push(part)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// Throws the helper's refusal: {"error": "<plain words>"} with its status.
async function refuse(answer: IncomingMessage): Promise<never> {
  const status = answer.statusCode ?? 500
  let message: string | undefined
  try {
    const body = JSON.parse(await readText(answer)) as { error?: unknown }
    message = typeof body.error === 'string' && body.error !== '' ? body.error : undefined
  } catch {
    message = undefined
  }
  throw new ApiError(codeOf(status), message)
}

const camel = (name: string) => name.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())

// Keys that hold a time: `created_at`, `expires_at`, `not_before`, `not_after`, and the bare `at`
// of the HTTPS log's entries and of the maintenance progress and result.
const timeKey = /(?:_at|^at|^not_before|^not_after)$/

// An RFC 3339 time in UTC milliseconds; Go's zero time (a field without omitzero) and anything
// that is not a time become null.
function toMs(text: string): number | null {
  const ms = Date.parse(text)
  return Number.isNaN(ms) || ms <= 0 ? null : ms
}

// The helper's JSON as the API writes it: camelCase names, times in milliseconds.
export function fromHelper(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => fromHelper(item))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [camel(name), fromHelper(item, name)]))
  }
  if (typeof value === 'string' && timeKey.test(key)) {
    return toMs(value)
  }
  return value
}

// Calls an endpoint that answers JSON and returns the answer in the API's form.
export async function control(method: string, path: string, options: CallOptions = {}): Promise<unknown> {
  const answer = await send(method, path, options)
  if ((answer.statusCode ?? 500) >= 300) {
    return refuse(answer)
  }
  const text = await readText(answer)
  try {
    return fromHelper(JSON.parse(text))
  } catch {
    throw new ApiError('server_error', 'The server helper sent an answer that is not JSON.')
  }
}

export interface ControlStream {
  headers: IncomingHttpHeaders
  body: IncomingMessage
}

// Calls an endpoint that answers a file (a backup's download): the answer's headers and body.
export async function controlStream(method: string, path: string): Promise<ControlStream> {
  const answer = await send(method, path, { timeoutMs: defaultTimeoutMs })
  if ((answer.statusCode ?? 500) >= 300) {
    return refuse(answer)
  }
  // The download may pause while the browser saves; only the start waits for the helper.
  answer.socket.setTimeout(0)
  return { headers: answer.headers, body: answer }
}

// A path segment of the helper's endpoints (a backup's name, an upload's ID).
export function segment(value: string): string {
  return encodeURIComponent(value)
}
