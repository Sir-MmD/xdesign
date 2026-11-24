// The desktop app's main process (docs/plan/18 section 9): one xDesign at a time; its window shows
// "Starting xDesign..." while the server child starts, then enters the app with the key of this
// start, without signing in. Exit 75 starts the server again, exit 78 shows the server's sentence,
// any other exit offers "Start again". Closing the window quits the app on every system, after the
// server stopped.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { app, type BrowserWindow } from 'electron'

import { appId, appName } from './identity.ts'
import { openLog } from './log.ts'
import { setMenu } from './menu.ts'
import { problemPage, startingPage } from './pages.ts'
import { findPaths } from './paths.ts'
import { exitDataFolder, exitRestart, startServer, stopServer, waitReady, type Exit, type Server } from './server.ts'
import { createWindow } from './window.ts'

// The data folder is <appData>/xDesign whatever the package calls itself, and Chromium's own files
// (cache, cookies, local storage) go into its session folder, beside data/, backups/ and logs/.
app.setName(appName)
app.setPath('userData', join(app.getPath('appData'), appName))
app.setPath('sessionData', join(app.getPath('userData'), 'session'))
if (process.platform === 'win32') {
  app.setAppUserModelId(appId)
}

const paths = findPaths()
const log = openLog(paths.log)

let window: BrowserWindow | undefined
// The server of this start, from its spawn until it ended or was stopped on purpose.
let server: Server | undefined
// A start is under way (choosing the port, spawning).
let starting = false
let quitting = false
let stopped = false

function show(url: string): void {
  if (window && !window.isDestroyed()) {
    // A page replaced before it finished loading rejects; nothing to do then.
    window.loadURL(url).catch(() => undefined)
  }
}

// The key signs the window in as the app's one person: /api/desktop/enter answers 302 to /.
function enter(running: Server): void {
  if (window && !window.isDestroyed()) {
    window
      .loadURL(`${running.origin}/api/desktop/enter`, { extraHeaders: `X-Xdesign-Desktop: ${running.key}\n` })
      .catch((error: unknown) => {
        log.warn('the window did not open the app', { error: String(error) })
      })
  }
}

function showStopped(sentence: string, startAgain: boolean): void {
  show(problemPage({ sentence, log: paths.log, startAgain }))
}

// A server that ends while it is the current one: on purpose ones were let go first.
function ended(running: Server, exit: Exit): void {
  if (server !== running) {
    return
  }
  server = undefined
  if (quitting) {
    return
  }
  if (exit.code === exitRestart) {
    void run()
  } else if (exit.code === exitDataFolder) {
    showStopped(exit.sentence ?? 'xDesign stopped unexpectedly.', false)
  } else if (exit.error !== undefined) {
    showStopped(`xDesign did not start: ${exit.error}`, true)
  } else {
    showStopped('xDesign stopped unexpectedly.', true)
  }
}

// Starts the server with a new key and enters the app once it answers.
async function run(): Promise<void> {
  if (starting || server || quitting) {
    return
  }
  starting = true
  show(startingPage())
  let running: Server
  try {
    running = await startServer(paths, log)
  } catch (error) {
    log.warn('server did not start', { error: String(error) })
    showStopped(`xDesign did not start: ${error instanceof Error ? error.message : String(error)}`, true)
    return
  } finally {
    starting = false
  }
  server = running
  void running.exited.then((exit) => {
    ended(running, exit)
  })
  const ready = await waitReady(running, log)
  // 'exited', or it ended right after answering: ended() shows why.
  if (server !== running) {
    return
  }
  if (ready === 'ready') {
    enter(running)
  } else if (ready === 'late') {
    // Let go first, so its exit shows nothing; "Start again" appears once it is gone.
    server = undefined
    await stopServer(running, log)
    showStopped('xDesign did not start in 60 seconds.', true)
  }
}

if (!app.requestSingleInstanceLock()) {
  // Another xDesign runs: it brings its window to the front ('second-instance'), and this one ends.
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) {
        window.restore()
      }
      window.show()
      window.focus()
    }
  })
  // Closing the window quits the app, on macOS too.
  app.on('window-all-closed', () => {
    app.quit()
  })
  // The app ends once the server stopped. A server still being spawned at that moment stops by
  // itself when the app's end closes its standard input.
  app.on('will-quit', (event) => {
    if (stopped) {
      return
    }
    event.preventDefault()
    if (quitting) {
      return
    }
    quitting = true
    const running = server
    void (running ? stopServer(running, log) : Promise.resolve()).finally(() => {
      stopped = true
      app.quit()
    })
  })
  void app.whenReady().then(() => {
    mkdirSync(paths.userData, { recursive: true })
    setMenu(paths, log)
    window = createWindow(paths, {
      origin: () => server?.origin,
      startAgain: () => {
        void run()
      },
    })
    window.on('closed', () => {
      window = undefined
    })
    void run()
  })
}
