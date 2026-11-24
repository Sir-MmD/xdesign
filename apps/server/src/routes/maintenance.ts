// Maintenance (maintenanceRoutes of @xdesign/api, docs/plan/07 sections 5, 6.2 and 8): the
// server's status, Backups, Update, Go back and (docs/plan/19 section 4) Uninstall xDesign, through
// the helper's control socket (src/helper/control.ts). Downloading, deleting and restoring a
// backup, uploading an update, installing it, going back and uninstalling need "Confirm it's
// you"; listing, the status and "Make a backup now" do not. Each change goes to Settings >
// Activity.
import {
  routes,
  type BackupEntry,
  type MaintenanceRequest,
  type RouteResponse,
  type Routes,
  type UpdateCheck,
} from '@xdesign/api'
import type { FastifyInstance } from 'fastify'

import { audit } from '../audit.ts'
import { ApiError } from '../errors.ts'
import { control, controlStream, segment } from '../helper/control.ts'
import { addRoute, type Register } from '../route.ts'
import { version } from '../version.ts'

// The status with the app's version; without the helper, its plain words instead.
function registerStatus(app: FastifyInstance): void {
  addRoute(app, routes.serverStatus, async () => {
    try {
      const server = (await control('GET', '/status')) as RouteResponse<Routes['serverStatus']>['server']
      return { version, server, problem: null }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'no_helper') {
        return { version, server: null, problem: error.message }
      }
      throw error
    }
  })
  addRoute(
    app,
    routes.maintenance,
    async () => (await control('GET', '/maintenance')) as RouteResponse<Routes['maintenance']>,
  )
}

// Maintenance > Backups (07 sections 5.3 and 5.4).
function registerBackups(app: FastifyInstance): void {
  addRoute(app, routes.backups, async () => (await control('GET', '/backups')) as RouteResponse<Routes['backups']>)

  // The helper answers once the backup is made, which takes as long as the site is large.
  addRoute(app, routes.makeBackup, async ({ user }) => {
    const entry = (await control('POST', '/backups', { timeoutMs: 0 })) as BackupEntry
    audit('backup_made', { userId: user.id, detail: { name: entry.name } })
    return entry
  })

  addRoute(
    app,
    routes.backupFile,
    async ({ user, params, reply }) => {
      const { headers, body } = await controlStream('GET', `/backups/${segment(params.name)}`)
      audit('backup_downloaded', { userId: user.id, detail: { name: params.name } })
      reply.header('content-type', headers['content-type'] ?? 'application/zstd')
      reply.header('content-disposition', headers['content-disposition'] ?? 'attachment')
      if (headers['content-length'] !== undefined) {
        reply.header('content-length', headers['content-length'])
      }
      reply.header('cache-control', 'no-store')
      return reply.send(body)
    },
    { confirm: true },
  )

  addRoute(
    app,
    routes.deleteBackup,
    async ({ user, params }) => {
      const answer = (await control('DELETE', `/backups/${segment(params.name)}`)) as { deleted: string }
      audit('backup_deleted', { userId: user.id, detail: { name: params.name } })
      return answer
    },
    { confirm: true },
  )

  addRoute(
    app,
    routes.restoreBackup,
    async ({ user, params }) => {
      const request = (await control('POST', `/backups/${segment(params.name)}/restore`)) as MaintenanceRequest
      audit('restore_started', { userId: user.id, detail: { name: params.name } })
      return request
    },
    { confirm: true },
  )
}

// Maintenance > Update and Go back (07 section 6.2).
function registerUpdates(app: FastifyInstance): void {
  // The browser's multipart form goes to the helper as it comes (xWriter's upload protocol); the
  // helper keeps the files in maintenance/uploads/<id>/ and answers the check.
  addRoute(
    app,
    routes.uploadUpdate,
    async ({ req }) => {
      const type = req.headers['content-type']
      if (!type?.startsWith('multipart/form-data')) {
        throw new ApiError('bad_request', 'Send the new xdesign file as a multipart form.')
      }
      const headers: Record<string, string> = { 'content-type': type }
      const length = req.headers['content-length']
      if (length !== undefined) {
        headers['content-length'] = length
      }
      return (await control('POST', '/maintenance/uploads', {
        stream: req.raw,
        headers,
        timeoutMs: 0,
      })) as UpdateCheck
    },
    { confirm: true },
  )

  addRoute(
    app,
    routes.updateCheck,
    async ({ params }) => (await control('GET', `/maintenance/uploads/${params.uploadId}`)) as UpdateCheck,
  )

  addRoute(
    app,
    routes.discardUpdate,
    async ({ params }) => (await control('DELETE', `/maintenance/uploads/${params.uploadId}`)) as { discarded: string },
  )

  addRoute(
    app,
    routes.installUpdate,
    async ({ user, body }) => {
      const check = (await control('GET', `/maintenance/uploads/${body.uploadId}`)) as UpdateCheck
      const request = (await control('POST', '/maintenance/update', {
        json: { upload_id: body.uploadId },
      })) as MaintenanceRequest
      audit('update_started', { userId: user.id, detail: { from: check.fromVersion, to: check.version } })
      return request
    },
    { confirm: true },
  )

  addRoute(
    app,
    routes.releases,
    async () => (await control('GET', '/maintenance/releases')) as RouteResponse<Routes['releases']>,
  )

  addRoute(
    app,
    routes.rollback,
    async ({ user, body }) => {
      const request = (await control('POST', '/maintenance/rollback', {
        json: { to: body.to, restore_data: body.restoreData },
      })) as MaintenanceRequest
      audit('rollback_started', { userId: user.id, detail: { to: body.to, restoreData: body.restoreData } })
      return request
    },
    { confirm: true },
  )
}

// Maintenance > Uninstall xDesign (docs/plan/19 sections 4 and 5): the request for the root
// helper, which starts the uninstaller apart from xDesign and records the request as done.
function registerUninstall(app: FastifyInstance): void {
  addRoute(
    app,
    routes.uninstall,
    async ({ user, body }) => {
      const request = (await control('POST', '/maintenance/uninstall', {
        json: { keepData: body.keepData },
      })) as MaintenanceRequest
      audit('uninstall_started', { userId: user.id, detail: { keepData: body.keepData } })
      return request
    },
    { confirm: true },
  )
}

export const register: Register = (app) => {
  registerStatus(app)
  registerBackups(app)
  registerUpdates(app)
  registerUninstall(app)
}
