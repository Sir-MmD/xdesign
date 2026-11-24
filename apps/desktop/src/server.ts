// The server child (docs/plan/18 section 9.2): the same server bundle the Linux helper runs
// (helper/internal/front/child.go), started with Node.js on 127.0.0.1 at port 47823 or a free one,
// with a new key at each start; its output goes to the log. It stops when its standard input closes
// (XD_STOP_ON_STDIN), so it also stops when the app itself ends abruptly.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

import type { Log } from './log.ts'
import type { Paths } from './paths.ts'

export const preferredPort = 47823
// The server asks to be started again (a restore staged its files).
export const exitRestart = 75
// The server cannot use this data folder; its last line on standard error says why.
export const exitDataFolder = 78
const sentencePrefix = 'xdesign-desktop-error: '
// The end of the server's standard error kept for that line.
const tailChars = 8 * 1024

// GET /api/health every readyEveryMs until it answers 200, for at most readyWithinMs; each request
// gets healthTimeoutMs.
const readyEveryMs = 250
const readyWithinMs = 60 * 1000
const healthTimeoutMs = 2 * 1000
// How long the server has to stop after its standard input closed before it is killed.
const stopWithinMs = 10 * 1000

export interface Exit {
  // null when a signal ended it or it never started.
  code: number | null
  signal: NodeJS.Signals | null
  // Why the process did not start at all (Node.js missing, for example).
  error: string | undefined
  // After exit 78: the server's sentence for the window.
  sentence: string | undefined
}

export interface Server {
  port: number
  key: string
  // http://127.0.0.1:<port>
  origin: string
  child: ChildProcessWithoutNullStreams
  // Settles once the process ended and its output is in the log.
  exited: Promise<Exit>
  ended: boolean
}

// Listens on the port of 127.0.0.1 (0: one the system gives) and closes again; the port it got.
function probe(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const listener = createServer()
    listener.once('error', reject)
    listener.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      const address = listener.address()
      listener.close(() => {
        if (address !== null && typeof address === 'object') {
          resolve(address.port)
        } else {
          reject(new Error('The port listener has no address.'))
        }
      })
    })
  })
}

// 47823, or a free port when another program holds it (R-350).
async function choosePort(): Promise<number> {
  try {
    return await probe(preferredPort)
  } catch {
    return probe(0)
  }
}

// The system's own variables (PATH, HOME, APPDATA, TEMP...) without the shell's XD_ variables and
// NODE_ENV, as the helper passes them (appEnv in child.go), then the contract's.
function serverEnv(paths: Paths, port: number, key: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith('XD_') && name !== 'NODE_ENV') {
      env[name] = value
    }
  }
  return {
    ...env,
    NODE_ENV: 'production',
    XD_DESKTOP: '1',
    XD_DESKTOP_KEY: key,
    XD_DESKTOP_PREFERRED_PORT: String(preferredPort),
    XD_DATA_DIR: paths.data,
    XD_PORT: String(port),
    XD_PUBLIC_URL: `http://127.0.0.1:${String(port)}`,
    XD_BASE_PATH: '/',
    XD_WEB_DIR: paths.web,
    XD_LOG_LEVEL: 'info',
    XD_STOP_ON_STDIN: '1',
  }
}

// The last line of the standard error that starts with the prefix, without it.
function sentenceIn(tail: string): string | undefined {
  const line = tail
    .split(/\r?\n/)
    .reverse()
    .find((text) => text.startsWith(sentencePrefix))
  return line?.slice(sentencePrefix.length).trim() || undefined
}

export async function startServer(paths: Paths, log: Log): Promise<Server> {
  const port = await choosePort()
  const key = randomBytes(32).toString('hex')
  // The standard streams are pipes: the input stays open while the server should run.
  const child = spawn(paths.node, [paths.script], {
    cwd: paths.app,
    env: serverEnv(paths, port, key),
    windowsHide: true,
  })
  log.info('server starting', { port, pid: child.pid, node: paths.node, script: paths.script })

  let tail = ''
  child.stdout.on('data', (chunk: Buffer) => {
    log.write(chunk)
  })
  child.stderr.on('data', (chunk: Buffer) => {
    log.write(chunk)
    tail = (tail + chunk.toString('utf8')).slice(-tailChars)
  })
  child.stdin.on('error', () => {
    // The pipe breaks when the server has ended; its exit tells the rest.
  })

  const server: Server = {
    port,
    key,
    origin: `http://127.0.0.1:${String(port)}`,
    child,
    ended: false,
    exited: new Promise<Exit>((resolve) => {
      let error: string | undefined
      child.on('error', (cause) => {
        error = cause.message
        // It never started: no 'close' may follow.
        if (child.pid === undefined) {
          resolve({ code: null, signal: null, error, sentence: undefined })
        }
      })
      child.once('close', (code, signal) => {
        resolve({ code, signal, error, sentence: code === exitDataFolder ? sentenceIn(tail) : undefined })
      })
    }),
  }
  void server.exited.then((exit) => {
    server.ended = true
    log.info(exit.error === undefined ? 'server exited' : 'server did not start', { ...exit, pid: child.pid })
  })
  return server
}

async function healthy(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(healthTimeoutMs) })
    await response.body?.cancel()
    return response.status === 200
  } catch {
    return false // not listening yet
  }
}

// 'ready' when the server answers, 'exited' when it ended first, 'late' after 60 seconds.
export async function waitReady(server: Server, log: Log): Promise<'ready' | 'exited' | 'late'> {
  const started = Date.now()
  while (!server.ended) {
    if (await healthy(server.origin)) {
      log.info('server ready', { pid: server.child.pid, ms: Date.now() - started })
      return 'ready'
    }
    if (Date.now() - started >= readyWithinMs) {
      log.warn('server did not answer in time', { pid: server.child.pid, ms: Date.now() - started })
      return 'late'
    }
    await sleep(readyEveryMs)
  }
  return 'exited'
}

// Closes the server's standard input and waits for its exit; after 10 seconds it is killed.
export async function stopServer(server: Server, log: Log): Promise<void> {
  if (server.ended) {
    return
  }
  log.info('stopping the server', { pid: server.child.pid })
  server.child.stdin.end()
  const kill = setTimeout(() => {
    log.warn('killing the server', { pid: server.child.pid, afterMs: stopWithinMs })
    server.child.kill('SIGKILL')
  }, stopWithinMs)
  await server.exited
  clearTimeout(kill)
}
