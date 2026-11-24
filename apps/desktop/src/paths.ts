// Where the desktop app finds its parts and keeps its data (docs/plan/18 section 9.7). Packaged,
// Node.js and the app are in Electron's resources folder, where DESK-05 puts them; a developer's run
// takes the repository's build and the Node.js on PATH, or XD_DESKTOP_NODE and XD_DESKTOP_APP.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

export interface Paths {
  // The Node.js runtime that runs the server.
  node: string
  // The folder of server.mjs, with its migrations and native modules; the server's working folder.
  app: string
  script: string
  // The built SPA, the server's XD_WEB_DIR.
  web: string
  // The data folder (<userData>), which Help > "Open data folder" opens.
  userData: string
  // <userData>/data, the server's XD_DATA_DIR.
  data: string
  // <userData>/logs/xdesign.log
  log: string
  // <userData>/window.json: the window's size and place.
  windowState: string
  // The window's icon on Linux (Windows and macOS take the app's own): <resources>/icon.png when the
  // package has it.
  icon: string | undefined
}

// After main.ts has set the data folder.
export function findPaths(): Paths {
  const userData = app.getPath('userData')
  const data = {
    userData,
    data: join(userData, 'data'),
    log: join(userData, 'logs', 'xdesign.log'),
    windowState: join(userData, 'window.json'),
  }
  if (app.isPackaged) {
    const resources = process.resourcesPath
    const appDir = join(resources, 'app')
    const icon = join(resources, 'icon.png')
    return {
      ...data,
      node: join(resources, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
      app: appDir,
      script: join(appDir, 'server.mjs'),
      web: join(appDir, 'web'),
      icon: process.platform === 'linux' && existsSync(icon) ? icon : undefined,
    }
  }
  // The bundle runs as <repo>/apps/desktop/dist/main.mjs, after `make build`.
  const repo = fileURLToPath(new URL('../../../', import.meta.url))
  const appDir = process.env.XD_DESKTOP_APP || join(repo, 'apps', 'server', 'dist')
  return {
    ...data,
    node: process.env.XD_DESKTOP_NODE || 'node',
    app: appDir,
    script: join(appDir, 'server.mjs'),
    web: join(repo, 'apps', 'web', 'dist'),
    icon: undefined,
  }
}
