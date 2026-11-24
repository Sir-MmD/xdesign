// The app's settings, read once from the environment: the Go helper passes them to its child
// from /etc/xdesign/config.toml (docs/plan/07 sections 1 and 3). The defaults suit `make dev`.
import { join, resolve } from 'node:path'

import type { ServerMode } from '@xdesign/api'
import { z } from 'zod'

// A web base path (xWriter's CheckBasePath): `/`, or 1 to 3 parts of 4 to 64 letters, digits, - or
// _ between slashes.
const basePathPattern = /^\/(?:[A-Za-z0-9_-]{4,64}\/){0,3}$/

// The helper's secrets on Windows: 32 random bytes in hex.
const secretPattern = /^[0-9a-f]{64}$/

const environment = z.object({
  // The data folder: the database, media and backups; created if missing.
  XD_DATA_DIR: z.string().min(1).default('.dev/data'),
  // The HTTP port on 127.0.0.1 when no socket is set (the port Vite proxies to; on Windows the
  // port the helper's front picks at each start).
  XD_PORT: z.coerce.number().int().min(1).max(65535).default(5174),
  // A Unix socket to listen on instead: the helper's front (/run/xdesign/app.sock).
  XD_SOCKET: z.string().min(1).optional(),
  // WIN-02: on Windows the helper's front reaches the app on XD_PORT and adds this secret of the
  // start to every request in X-Xdesign-Proxy (docs/plan/18 section 8.2).
  XD_PROXY_SECRET: z.string().regex(secretPattern, 'not a proxy secret: 64 lower-case hex characters').optional(),
  // The built SPA (apps/web/dist, app/web in a release), served with a fallback to index.html.
  XD_WEB_DIR: z.string().min(1).optional(),
  // The site's address: the Origin that changing requests must come from, and with XD_BASE_PATH
  // the base of links. Only its origin counts (scheme, host and port).
  XD_PUBLIC_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:5173'),
  // The secret path the whole site is served under (docs/plan/16 section 4): random in an
  // install (`/k3v9x2m1q8wz7r4t/`), `/` in `make dev`.
  XD_BASE_PATH: z
    .string()
    .regex(
      basePathPattern,
      'not a web base path: it starts and ends with / and has 1 to 3 parts of 4 to 64 letters, digits, - or _ between the slashes, for example /k3v9x2m1q8wz7r4t/',
    )
    .default('/'),
  XD_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // The Go helper's control socket (/run/xdesign/control.sock): HTTPS, backups, updates and the
  // server's status. `make dev` runs without the helper.
  XD_CONTROL_SOCKET: z.string().min(1).optional(),
  // WIN-02: on Windows the helper's control server instead, on 127.0.0.1, with the secret every
  // call carries in Authorization: Bearer.
  XD_CONTROL_URL: z.url({ protocol: /^http$/ }).optional(),
  XD_CONTROL_SECRET: z.string().regex(secretPattern, 'not a control secret: 64 lower-case hex characters').optional(),
  // Set by `make dev`: Vite's addresses also pass the Origin check, and the dev owner is made.
  XD_DEV: z.stringbool().default(false),
  // DESK-01: the desktop app's server (docs/plan/18 section 9.3), set by its Electron shell: one
  // person without sign-in, the routes of what the app lacks refused.
  XD_DESKTOP: z.stringbool().default(false),
  // The shell's random key of this start, which signs its window in (/api/desktop/enter).
  XD_DESKTOP_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'not a desktop key: 64 lower-case hex characters')
    .optional(),
  // The port the shell tries first (47823); it used another when a program held that one.
  XD_DESKTOP_PREFERRED_PORT: z.coerce.number().int().min(1).max(65535).default(47823),
  // Stop cleanly when standard input closes: how the desktop app's shell stops the server.
  XD_STOP_ON_STDIN: z.stringbool().default(false),
})

// DESK-01: the desktop app's server.
export interface DesktopConfig {
  key: string
  preferredPort: number
}

export interface Config {
  dataDir: string
  // <dataDir>/xdesign.db
  dbPath: string
  port: number
  socket: string | undefined
  // XD_PROXY_SECRET (Windows).
  proxySecret: string | undefined
  // Behind the helper's front: its Unix socket (Linux) or its proxy secret (Windows). The site is
  // HTTPS then, and the X-Forwarded headers of the front are trusted.
  behindFront: boolean
  webDir: string | undefined
  // XD_BASE_PATH: starts and ends with `/`.
  basePath: string
  // The origin of XD_PUBLIC_URL, without a trailing slash: the site's own pages.
  origin: string
  // The site's address, the base of every link it makes: the origin and the base path without its
  // last slash (`https://design.example.com:34567/k3v9x2m1q8wz7r4t`; the origin alone with `/`).
  publicUrl: string
  logLevel: z.output<typeof environment>['XD_LOG_LEVEL']
  controlSocket: string | undefined
  // XD_CONTROL_URL with XD_CONTROL_SECRET (Windows).
  controlUrl: string | undefined
  controlSecret: string | undefined
  // `make dev` (XD_DEV=1).
  dev: boolean
  // XD_DESKTOP=1 with its key; null on a server.
  desktop: DesktopConfig | null
  // What /api/health and /api/me say: 'desktop' with XD_DESKTOP=1.
  mode: ServerMode
  stopOnStdin: boolean
}

export function readConfig(vars: NodeJS.ProcessEnv): Config {
  const parsed = environment.safeParse(vars)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`The environment is not valid: ${problems.join('; ')}`)
  }
  const env = parsed.data
  let desktop: DesktopConfig | null = null
  if (env.XD_DESKTOP) {
    if (env.XD_DESKTOP_KEY === undefined) {
      throw new Error('The environment is not valid: XD_DESKTOP_KEY: needed with XD_DESKTOP=1')
    }
    desktop = { key: env.XD_DESKTOP_KEY, preferredPort: env.XD_DESKTOP_PREFERRED_PORT }
  }
  if ((env.XD_CONTROL_URL === undefined) !== (env.XD_CONTROL_SECRET === undefined)) {
    throw new Error('The environment is not valid: XD_CONTROL_URL and XD_CONTROL_SECRET: both or neither')
  }
  const dataDir = resolve(env.XD_DATA_DIR)
  const origin = new URL(env.XD_PUBLIC_URL).origin
  return {
    dataDir,
    dbPath: join(dataDir, 'xdesign.db'),
    port: env.XD_PORT,
    socket: env.XD_SOCKET,
    proxySecret: env.XD_PROXY_SECRET,
    behindFront: env.XD_SOCKET !== undefined || env.XD_PROXY_SECRET !== undefined,
    webDir: env.XD_WEB_DIR === undefined ? undefined : resolve(env.XD_WEB_DIR),
    basePath: env.XD_BASE_PATH,
    origin,
    publicUrl: origin + env.XD_BASE_PATH.slice(0, -1),
    logLevel: env.XD_LOG_LEVEL,
    controlSocket: env.XD_CONTROL_SOCKET,
    controlUrl: env.XD_CONTROL_URL,
    controlSecret: env.XD_CONTROL_SECRET,
    dev: env.XD_DEV,
    desktop,
    mode: desktop ? 'desktop' : 'server',
    stopOnStdin: env.XD_STOP_ON_STDIN,
  }
}

export const config = readConfig(process.env)
