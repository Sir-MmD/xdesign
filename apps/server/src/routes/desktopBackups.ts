// The desktop app's backups (desktopBackupRoutes of @xdesign/api, docs/plan/18 section 9.5,
// DESK-02): the list, "Make a backup now", "Save a copy...", "Delete", "Restore", "Restore from a
// file..." and "Open the backups folder" (src/desktop/backups.ts). Registered only in desktop
// mode: a server answers 404 not_found as for any unknown path. The app has no Activity and no
// "Confirm it's you", so these routes write no Activity rows and need no confirmation. A restore
// answers first, then the server restarts.
import { createReadStream } from 'node:fs'
import { rm } from 'node:fs/promises'

import { routes } from '@xdesign/api'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { config } from '../config.ts'
import {
  backupPath,
  deleteBackup,
  listBackups,
  makeBackupNow,
  maxUploadBytes,
  notBackupText,
  openBackupsFolder,
  receiveUpload,
  restartServer,
  restoreBackup,
  restoreUpload,
} from '../desktop/backups.ts'
import { ApiError } from '../errors.ts'
import { addRoute, type Register } from '../route.ts'

// The restart waits for the answer to go out, or this long when the window left before it.
const restartLatestMs = 5000

// Once the restore's answer is sent, the server stops with exit code 75 for the shell to start it
// again (main.ts's stop runs once, whichever comes first).
function restartAfter(reply: FastifyReply): void {
  const restart = () => {
    restartServer()
  }
  reply.raw.once('finish', restart).once('close', restart)
  setTimeout(restart, restartLatestMs).unref()
}

// The one file of the form, written to a partial file of the backups folder; other fields are
// ignored.
async function readUpload(req: FastifyRequest): Promise<string> {
  let upload: string | null = null
  const limits = { fileSize: maxUploadBytes, files: 1, fields: 10, fieldSize: 1000 }
  try {
    for await (const part of req.parts({ limits })) {
      if (part.type === 'field') {
        continue
      }
      // A file larger than any backup.
      const tooBig = new ApiError('bad_request', notBackupText)
      part.file.once('limit', () => part.file.destroy(tooBig))
      upload = await receiveUpload(part.file)
      if (part.file.truncated) {
        throw tooBig
      }
    }
  } catch (error) {
    if (upload !== null) {
      await rm(upload, { force: true })
    }
    throw error
  }
  if (upload === null) {
    throw new ApiError('bad_request', 'Choose a backup file.')
  }
  return upload
}

export const register: Register = (app) => {
  if (config.desktop === null) {
    return
  }

  addRoute(app, routes.desktopBackups, () => listBackups())

  addRoute(app, routes.makeDesktopBackup, () => makeBackupNow())

  addRoute(app, routes.desktopBackupFile, async ({ params, reply }) => {
    const { path, size } = await backupPath(params.name)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${params.name}"`)
      .header('content-length', size)
      .header('cache-control', 'no-store')
      .send(createReadStream(path))
  })

  addRoute(app, routes.deleteDesktopBackup, async ({ params }) => {
    await deleteBackup(params.name)
    return { deleted: params.name }
  })

  addRoute(app, routes.restoreDesktopBackup, async ({ params, reply }) => {
    const before = await restoreBackup(params.name)
    restartAfter(reply)
    return { before }
  })

  addRoute(app, routes.restoreDesktopBackupFile, async ({ req, reply }) => {
    const type = req.headers['content-type']
    if (!type?.startsWith('multipart/form-data')) {
      throw new ApiError('bad_request', 'Send the backup file as a multipart form.')
    }
    const before = await restoreUpload(await readUpload(req))
    restartAfter(reply)
    return { before }
  })

  addRoute(app, routes.openDesktopBackupsFolder, async () => {
    await openBackupsFolder()
    return { ok: true as const }
  })
}
