// Maintenance (docs/plan/07 sections 5, 6.2 and 8), for the site owner: the server's status,
// Backups, Update, Go back and (M17, docs/plan/19 section 4) Uninstall xDesign, through the Go
// helper's control socket. The app passes the helper's answers through with the names in
// camelCase and the times in UTC milliseconds (null for none); the helper's refusals keep their
// plain words. Requests for the root helper (an update, a rollback, a restore, a domain or address
// change, an uninstall) answer the request; `maintenance` follows its progress and result.
import { z } from 'zod'

import { time } from '../common.ts'
import { defineRoute } from '../route.ts'

// A time the helper may leave out or send as zero.
const helperTime = time.nullish()

// A backup's name: `xdesign-<time>` or `pre-update-<version>-<time>`.
const backupName = z.string().regex(/^[\w.+-]{1,200}$/, 'Not a backup name.')
// An upload's ID: 32 lower-case hex digits.
const uploadId = z.string().regex(/^[0-9a-f]{32}$/, 'Not an upload ID.')

// A request written for the root helper (07 section 6.2): update, rollback, restore, domain,
// address or uninstall.
export const maintenanceRequest = z.object({
  id: z.string(),
  kind: z.string(),
  requestedAt: helperTime,
  update: z.object({ file: z.string() }).optional(),
  rollback: z.object({ to: z.string() }).optional(),
  restore: z.object({ backup: z.string() }).optional(),
  domain: z.object({ domain: z.string() }).optional(),
  address: z.object({ port: z.number(), basePath: z.string() }).optional(),
  uninstall: z.object({ keepData: z.boolean() }).optional(),
})
export type MaintenanceRequest = z.output<typeof maintenanceRequest>

// The step the root helper is at, and how far the whole request is.
export const maintenanceProgress = z.object({
  id: z.string(),
  kind: z.string(),
  step: z.string(),
  title: z.string(),
  percent: z.number().int().optional(),
  detail: z.string().optional(),
  at: helperTime,
})
export type MaintenanceProgress = z.output<typeof maintenanceProgress>

// How the last request ended, in plain words.
export const maintenanceResult = z.object({
  id: z.string(),
  kind: z.string(),
  ok: z.boolean(),
  message: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  // An update that failed after xDesign stopped and went back by itself.
  rolledBack: z.boolean().optional(),
  failureLog: z.string().optional(),
  // The backup a restore made of the site first.
  backup: z.string().optional(),
  // The site's address after a domain or address change.
  address: z.string().optional(),
  at: helperTime,
})
export type MaintenanceResult = z.output<typeof maintenanceResult>

export const backupEntry = z.object({
  name: z.string(),
  file: z.string(),
  // daily, manual or pre-update.
  kind: z.string(),
  version: z.string(),
  createdAt: helperTime,
  size: z.number(),
})
export type BackupEntry = z.output<typeof backupEntry>

// The check of an uploaded file (07 section 6.2 step 2).
export const updateCheck = z.object({
  // Names the checked upload for installUpdate; empty when it was refused.
  uploadId: z.string(),
  expiresAt: helperTime,
  file: z.string(),
  sizeBytes: z.number(),
  sha256: z.string(),
  packedAs: z.string().optional(),
  version: z.string(),
  fromVersion: z.string(),
  // "1.0.0 to 1.1.0", "CPU: amd64", "Checksum: matches", ...: the checks that passed.
  rows: z.array(z.string()),
  warnings: z.array(z.string()),
  // Why the file cannot be installed here.
  refusal: z.string().optional(),
  // The release notes, when the file carries them.
  releaseNotes: z.string().optional(),
})
export type UpdateCheck = z.output<typeof updateCheck>

export const maintenanceRoutes = {
  // Maintenance's status: the app's version, and the helper's GET /status (null with `problem`
  // when the helper does not answer, as in `make dev`).
  serverStatus: defineRoute({
    key: 'serverStatus',
    method: 'GET',
    path: '/api/maintenance/status',
    response: z.object({
      version: z.string(),
      server: z
        .object({
          version: z.string(),
          // port (xDesign serves HTTPS itself on its port), or dev.
          mode: z.string(),
          address: z.string(),
          uptimeSeconds: z.number(),
          app: z.object({ state: z.string(), restarts: z.number().int() }),
          storage: z
            .object({
              databaseBytes: z.number(),
              mediaBytes: z.number(),
              mediaFiles: z.number().int(),
              freeBytes: z.number(),
              problem: z.string().optional(),
            })
            .optional(),
          https: z.object({
            method: z.string().optional(),
            state: z.string().optional(),
            expiresAt: helperTime,
            lastProblem: z.string().optional(),
          }),
        })
        .nullable(),
      problem: z.string().nullable(),
    }),
    auth: 'siteOwner',
  }),
  // The maintenance helper's state, the request waiting, the progress, the last result and the
  // build that runs.
  maintenance: defineRoute({
    key: 'maintenance',
    method: 'GET',
    path: '/api/maintenance',
    response: z.object({
      // ready, off, missing or development, with why it cannot carry out requests.
      helper: z.object({ state: z.string(), message: z.string().optional() }),
      pending: maintenanceRequest.nullable(),
      progress: maintenanceProgress.nullable(),
      last: maintenanceResult.nullable(),
      running: z.object({ version: z.string(), startedAt: helperTime }),
    }),
    auth: 'siteOwner',
  }),
  backups: defineRoute({
    key: 'backups',
    method: 'GET',
    path: '/api/backups',
    response: z.object({ backups: z.array(backupEntry), spaceUsed: z.number(), running: z.boolean() }),
    auth: 'siteOwner',
  }),
  // "Make a backup now": answered when the backup is made.
  makeBackup: defineRoute({
    key: 'makeBackup',
    method: 'POST',
    path: '/api/backups',
    response: backupEntry,
    auth: 'siteOwner',
  }),
  // "Download": the backup's .tar.zst (not JSON; the page opens the path).
  backupFile: defineRoute({
    key: 'backupFile',
    method: 'GET',
    path: '/api/backups/:name',
    params: z.object({ name: backupName }),
    response: z.instanceof(Uint8Array),
    auth: 'siteOwner',
  }),
  deleteBackup: defineRoute({
    key: 'deleteBackup',
    method: 'DELETE',
    path: '/api/backups/:name',
    params: z.object({ name: backupName }),
    response: z.object({ deleted: z.string() }),
    auth: 'siteOwner',
  }),
  // "Restore": the request for the root helper (07 section 5.4).
  restoreBackup: defineRoute({
    key: 'restoreBackup',
    method: 'POST',
    path: '/api/backups/:name/restore',
    params: z.object({ name: backupName }),
    response: maintenanceRequest,
    auth: 'siteOwner',
  }),
  // "Upload and check": a multipart form with the new xdesign file (or a packed file holding
  // it), SHA256SUMS and SHA256SUMS.sig under `files`, streamed to the helper, which checks it.
  uploadUpdate: defineRoute({
    key: 'uploadUpdate',
    method: 'POST',
    path: '/api/maintenance/uploads',
    multipart: true,
    response: updateCheck,
    auth: 'siteOwner',
  }),
  // The check of an upload again (it waits 30 minutes).
  updateCheck: defineRoute({
    key: 'updateCheck',
    method: 'GET',
    path: '/api/maintenance/uploads/:uploadId',
    params: z.object({ uploadId }),
    response: updateCheck,
    auth: 'siteOwner',
  }),
  discardUpdate: defineRoute({
    key: 'discardUpdate',
    method: 'DELETE',
    path: '/api/maintenance/uploads/:uploadId',
    params: z.object({ uploadId }),
    response: z.object({ discarded: z.string() }),
    auth: 'siteOwner',
  }),
  // "Install and restart": the request for the root helper.
  installUpdate: defineRoute({
    key: 'installUpdate',
    method: 'POST',
    path: '/api/maintenance/update',
    body: z.object({ uploadId }),
    response: maintenanceRequest,
    auth: 'siteOwner',
  }),
  // The "Go back" card: the kept releases older than the running one.
  releases: defineRoute({
    key: 'releases',
    method: 'GET',
    path: '/api/maintenance/releases',
    response: z.object({
      keepReleases: z.number().int(),
      running: z.string(),
      previous: z.array(
        z.object({
          version: z.string(),
          installedAt: helperTime,
          // allowed, needs_restore or missing.
          rollback: z.string(),
          // The backup made before the update from this release.
          backup: z.string().optional(),
          // Why going back is not possible.
          note: z.string().optional(),
        }),
      ),
    }),
    auth: 'siteOwner',
  }),
  // "Roll back to <version>", with "Also restore the data from before the update".
  rollback: defineRoute({
    key: 'rollback',
    method: 'POST',
    path: '/api/maintenance/rollback',
    body: z.object({ to: z.string().min(1).max(100), restoreData: z.boolean() }),
    response: maintenanceRequest,
    auth: 'siteOwner',
  }),
  // "Uninstall xDesign" (docs/plan/19 section 4): "Keep the data" or "Remove everything". The root
  // helper starts the uninstaller apart from xDesign, which then stops; never Claude's (Q-85).
  uninstall: defineRoute({
    key: 'uninstall',
    method: 'POST',
    path: '/api/maintenance/uninstall',
    body: z.object({ keepData: z.boolean() }),
    response: maintenanceRequest,
    auth: 'siteOwner',
  }),
}
