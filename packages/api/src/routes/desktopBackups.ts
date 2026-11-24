// The desktop app's backups (docs/plan/18 section 9.5, DESK-02), for its one person (the site
// owner): zips in <userData>/backups/ beside the data folder, made by hand, every day and before a
// restore, 14 kept. Only in the desktop app: a server registers none of these routes and answers
// 404 not_found as for any unknown path (onlyInDesktop in desktop.ts). A restore answers once the
// files are staged; then the server stops with exit code 75 and the app's shell starts it again
// and reloads the window.
import { z } from 'zod'

import { ok, time } from '../common.ts'
import { defineRoute } from '../route.ts'

// Why the backup was made: the daily one, "Make a backup now", or the one a restore makes first.
export const desktopBackupKinds = ['automatic', 'manual', 'beforeRestore'] as const
export type DesktopBackupKind = (typeof desktopBackupKinds)[number]

// A backup's file name: xdesign-backup-<UTC time as YYYYMMDD-HHMMSS>.zip.
const desktopBackupName = z.string().regex(/^xdesign-backup-\d{8}-\d{6}\.zip$/, 'Not a backup name.')

export const desktopBackup = z.object({
  name: z.string(),
  createdAt: time,
  // The file's bytes.
  size: z.number(),
  kind: z.enum(desktopBackupKinds),
  // The xDesign that made it.
  version: z.string(),
})
export type DesktopBackup = z.output<typeof desktopBackup>

// A restore's answer: the backup of the app as it was, made first. The server restarts next.
export const desktopRestore = z.object({ before: desktopBackup })

export const desktopBackupRoutes = {
  // The backups, newest first; `running` while a backup or a restore is under way.
  desktopBackups: defineRoute({
    key: 'desktopBackups',
    method: 'GET',
    path: '/api/desktop/backups',
    response: z.object({ backups: z.array(desktopBackup), running: z.boolean() }),
    auth: 'siteOwner',
  }),
  // "Make a backup now": answered when the backup is made.
  makeDesktopBackup: defineRoute({
    key: 'makeDesktopBackup',
    method: 'POST',
    path: '/api/desktop/backups',
    response: desktopBackup,
    auth: 'siteOwner',
  }),
  // "Save a copy...": the backup's .zip as an attachment (not JSON; the app's window shows the
  // save dialog).
  desktopBackupFile: defineRoute({
    key: 'desktopBackupFile',
    method: 'GET',
    path: '/api/desktop/backups/:name',
    params: z.object({ name: desktopBackupName }),
    response: z.instanceof(Uint8Array),
    auth: 'siteOwner',
  }),
  deleteDesktopBackup: defineRoute({
    key: 'deleteDesktopBackup',
    method: 'DELETE',
    path: '/api/desktop/backups/:name',
    params: z.object({ name: desktopBackupName }),
    response: z.object({ deleted: z.string() }),
    auth: 'siteOwner',
  }),
  // "Restore": checks the backup, makes a backup of the app as it is, stages the backup's files
  // and answers; then the app restarts with them.
  restoreDesktopBackup: defineRoute({
    key: 'restoreDesktopBackup',
    method: 'POST',
    path: '/api/desktop/backups/:name/restore',
    params: z.object({ name: desktopBackupName }),
    response: desktopRestore,
    auth: 'siteOwner',
  }),
  // "Restore from a file...": a multipart form with one file (a backup saved elsewhere), then as
  // restoreDesktopBackup.
  restoreDesktopBackupFile: defineRoute({
    key: 'restoreDesktopBackupFile',
    method: 'POST',
    path: '/api/desktop/backups/restore',
    multipart: true,
    response: desktopRestore,
    auth: 'siteOwner',
  }),
  // "Open the backups folder": the computer's file manager shows it.
  openDesktopBackupsFolder: defineRoute({
    key: 'openDesktopBackupsFolder',
    method: 'POST',
    path: '/api/desktop/backups/folder',
    response: ok,
    auth: 'siteOwner',
  }),
}
