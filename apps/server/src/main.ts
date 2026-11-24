// The xDesign server (docs/plan/02-architecture.md): opens the database (running its
// migrations), registers the routes of every area and live editing (src/live/), and listens on
// the helper's Unix socket or, in `make dev` and the desktop app (DESK-01, src/desktop/), on TCP,
// then starts the jobs (src/jobs.ts). The settings come from the environment (src/config.ts).
import { chmodSync, rmSync } from 'node:fs'

import { createApp, serveWeb } from './app.ts'
import { ensureDevOwner } from './auth/dev-owner.ts'
import { oauthJob } from './claude/oauth.ts'
import { config } from './config.ts'
import { closeDatabase, openDatabase } from './db/index.ts'
import { trashJob } from './designs/trash.ts'
import { versionsJob } from './designs/versions.ts'
import { applyStagedRestore, desktopBackupJob, setStop } from './desktop/backups.ts'
import { checkDataFolder, keepNewestVersion } from './desktop/dataFolder.ts'
import { desktopGate, refuseNotInDesktop } from './desktop/http.ts'
import { ensureDesktopPerson } from './desktop/person.ts'
import { startJobs, stopJobs } from './jobs.ts'
import { attachLive } from './live/server.ts'
import { register as registerAuth } from './routes/auth.ts'
import { register as registerClaude } from './routes/claude.ts'
import { register as registerComments } from './routes/comments.ts'
import { register as registerDesigns } from './routes/designs.ts'
import { register as registerDesktop } from './routes/desktop.ts'
import { register as registerDesktopBackups } from './routes/desktopBackups.ts'
import { register as registerHttps } from './routes/https.ts'
import { register as registerMaintenance } from './routes/maintenance.ts'
import { register as registerMcp } from './routes/mcp.ts'
import { register as registerMedia } from './routes/media.ts'
import { register as registerMembers } from './routes/members.ts'
import { register as registerOAuth } from './routes/oauth.ts'
import { register as registerSettings } from './routes/settings.ts'
import { register as registerSite } from './routes/site.ts'
import { register as registerTemplates } from './routes/templates.ts'
import { register as registerVersions } from './routes/versions.ts'

import { register as registerViewLinks } from './routes/viewLinks.ts'
import { version } from './version.ts'

if (config.desktop) {
  // DESK-02: a restore the Backups page staged goes in place here, before the database opens.
  applyStagedRestore()
  await checkDataFolder(config.dbPath)
}
openDatabase(config.dbPath)
if (config.desktop) {
  keepNewestVersion()
  await ensureDesktopPerson()
}

const app = await createApp(config)
app.addHook('onClose', (_instance, done) => {
  stopJobs()
  closeDatabase()
  done()
})
if (config.desktop) {
  // Before the routes: what the desktop app does not have answers 404 not_in_desktop.
  refuseNotInDesktop(app)
}
// Live editing on /live: its documents are saved before the database closes.
attachLive(app, config)

registerSite(app)
registerAuth(app)
registerMembers(app)
registerDesigns(app)
registerComments(app)
registerMedia(app)
registerSettings(app)
registerHttps(app)
registerMaintenance(app)
registerVersions(app)
registerTemplates(app)

registerViewLinks(app)

registerClaude(app)
registerMcp(app)
registerOAuth(app)
registerDesktop(app)
registerDesktopBackups(app)
await serveWeb(app, config.webDir, config.basePath, config.desktop ? desktopGate : undefined)

let stopping = false
function stop(code: number): void {
  if (!stopping) {
    stopping = true
    void app.close().then(() => process.exit(code))
  }
}
function stopNow(): void {
  stop(0)
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, stopNow)
}
// XD_STOP_ON_STDIN: the desktop app's shell (and WIN-02's Windows server) stops the server by
// closing its standard input, which also ends it when the app itself ends abruptly.
if (config.stopOnStdin) {
  process.stdin.once('end', stopNow).once('close', stopNow).resume()
}
// DESK-02: a restore stops the server the same way, with exit code 75 (restart).
setStop(stop)

if (config.socket) {
  // A socket file left by a previous run that did not stop cleanly would block listen().
  rmSync(config.socket, { force: true })
  await app.listen({ path: config.socket })
  // The helper's front runs as the same user; nobody else may connect.
  chmodSync(config.socket, 0o660)
} else {
  // `make dev`, the desktop app, and on Windows the port the helper's front picked for this start
  // (XD_PROXY_SECRET, src/front.ts); a port taken in the meantime ends this start, and the front
  // picks another for the next.
  await app.listen({ host: '127.0.0.1', port: config.port })
}
app.log.info({ version, mode: config.mode, dataDir: config.dataDir, webDir: config.webDir }, 'xDesign server started')
startJobs([trashJob, versionsJob, oauthJob, ...(config.desktop ? [desktopBackupJob] : [])])
if (config.dev) {
  await ensureDevOwner(config.dataDir)
}
