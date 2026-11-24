// The app's one window (docs/plan/18 section 9.2): "xDesign", at least 1000 x 680, its size and place
// kept in <userData>/window.json, and locked down as Electron's security guide says: context
// isolation, no Node.js in the page, sandboxed; it shows only its own pages and the server's origin,
// opens no other window, and sends links to other sites to the default browser.
import { readFileSync, writeFileSync } from 'node:fs'

import { BrowserWindow, nativeTheme, screen, session, shell, type Rectangle } from 'electron'

import { appName } from './identity.ts'
import { startAgainUrl } from './pages.ts'
import type { Paths } from './paths.ts'

const minWidth = 1000
const minHeight = 680
const firstWidth = 1280
const firstHeight = 800
// A kept place is used when at least this much of the window is on a screen that still exists.
const visibleWidth = 200
const visibleHeight = 100

// What the page may ask for, from the server's origin only: copying (the Claude card's command)
// and full screen.
const allowedPermissions = new Set(['clipboard-sanitized-write', 'fullscreen'])

export interface WindowHooks {
  // The origin of the running server (http://127.0.0.1:<port>), the only site the window shows.
  origin: () => string | undefined
  // The "Start again" button of a problem page.
  startAgain: () => void
}

interface Place extends Rectangle {
  maximized: boolean
}

function isPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const fields = value as Record<string, unknown>
  return (
    ['x', 'y', 'width', 'height'].every((name) => Number.isFinite(fields[name])) &&
    typeof fields.maximized === 'boolean'
  )
}

function onScreen(place: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea }) => {
    const width = Math.min(place.x + place.width, workArea.x + workArea.width) - Math.max(place.x, workArea.x)
    const height = Math.min(place.y + place.height, workArea.y + workArea.height) - Math.max(place.y, workArea.y)
    return width >= visibleWidth && height >= visibleHeight
  })
}

// The kept size, and the kept place when it is still on a screen; the first start centers the window
// on the main screen.
function startPlace(file: string): Partial<Place> & { width: number; height: number } {
  let kept: unknown
  try {
    kept = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    kept = undefined // the first start, or a file nobody can read
  }
  const { workArea } = screen.getPrimaryDisplay()
  if (!isPlace(kept)) {
    return {
      width: Math.max(minWidth, Math.min(firstWidth, workArea.width)),
      height: Math.max(minHeight, Math.min(firstHeight, workArea.height)),
    }
  }
  const size = { width: Math.max(minWidth, kept.width), height: Math.max(minHeight, kept.height) }
  return onScreen(kept) ? { ...size, x: kept.x, y: kept.y, maximized: kept.maximized } : size
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

export function createWindow(paths: Paths, hooks: WindowHooks): BrowserWindow {
  const place = startPlace(paths.windowState)
  const window = new BrowserWindow({
    title: appName,
    width: place.width,
    height: place.height,
    ...(place.x !== undefined && place.y !== undefined ? { x: place.x, y: place.y } : { center: true }),
    minWidth,
    minHeight,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#fafafa',
    ...(paths.icon === undefined ? {} : { icon: paths.icon }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Spell checking would download dictionaries; the app stays offline.
      spellcheck: false,
    },
  })
  window.once('ready-to-show', () => {
    if (place.maximized === true) {
      window.maximize()
    }
    window.show()
  })
  // The title stays "xDesign" whatever the page calls itself.
  window.on('page-title-updated', (event) => {
    event.preventDefault()
  })
  window.on('close', () => {
    const kept: Place = { ...window.getNormalBounds(), maximized: window.isMaximized() }
    try {
      writeFileSync(paths.windowState, `${JSON.stringify(kept)}\n`)
    } catch {
      // The next start takes the first place.
    }
  })

  const isApp = (url: string): boolean => {
    const origin = hooks.origin()
    return origin !== undefined && originOf(url) === origin
  }
  // http and https links of other sites open in the default browser; anything else goes nowhere.
  const openOutside = (url: string): void => {
    if (/^https?:/i.test(url) && !isApp(url)) {
      void shell.openExternal(url)
    }
  }
  const contents = window.webContents
  contents.on('will-navigate', (event) => {
    if (event.url === startAgainUrl) {
      event.preventDefault()
      hooks.startAgain()
    } else if (!isApp(event.url)) {
      event.preventDefault()
      openOutside(event.url)
    }
  })
  contents.on('will-redirect', (event) => {
    if (!isApp(event.url)) {
      event.preventDefault()
      openOutside(event.url)
    }
  })
  contents.setWindowOpenHandler(({ url }) => {
    if (url === startAgainUrl) {
      hooks.startAgain()
    } else {
      openOutside(url)
    }
    return { action: 'deny' }
  })
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(allowedPermissions.has(permission) && isApp(details.requestingUrl))
  })
  return window
}
