// The desktop app's backups (docs/plan/18 section 9.5, DESK-02): one zip per backup in
// <userData>/backups/ beside the data folder, xdesign-backup-<UTC time as YYYYMMDD-HHMMSS>.zip,
// written under a partial name and renamed: backup.json first (the app's version, the time, the
// kind and every file with its bytes and SHA-256), the database copied with SQLite's online
// backup, and the media folder. 14 are kept, every kind together, the oldest removed first. One
// backup, restore or deletion runs at a time. A restore checks the whole file, makes a backup of
// the app as it is, unpacks the database and media into a staging folder of the data folder, and
// the server restarts (exit 75, src/routes/desktopBackups.ts): at the next start, before the
// database opens, the staged files replace the old ones.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout as sleep } from 'node:timers/promises'

import { desktopBackupKinds, type DesktopBackup, type DesktopBackupKind } from '@xdesign/api'
import { nanoid } from 'nanoid'
import { z } from 'zod'

import { config } from '../config.ts'
import { getDb } from '../db/index.ts'
import { ApiError } from '../errors.ts'
import type { Job } from '../jobs.ts'
import { log } from '../log.ts'
import { version } from '../version.ts'
import { compareVersions, exitRestart } from './dataFolder.ts'
import { BadZip, ZipReader, ZipWriter, type FileSum, type ZipLimits } from './zip.ts'

const hourMs = 60 * 60 * 1000
const dayMs = 24 * hourMs
const keepBackups = 14

// <userData>/backups, beside <userData>/data (XD_DATA_DIR).
const backupsDir = join(dirname(config.dataDir), 'backups')

// The staging folder of a restore in the data folder: `.partial` while it is unpacked, then
// renamed; the old database and media move aside until the swap is done.
const stagingPartial = join(config.dataDir, 'restore-staging.partial')
const staging = join(config.dataDir, 'restore-staging')
const replaced = join(config.dataDir, 'restore-replaced')

const metaName = 'backup.json'
const databaseName = 'xdesign.db'
const mediaName = 'media'

// A backup's file name, with its UTC time.
const backupName = /^xdesign-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.zip$/
// A media file as the store keeps it (src/media/store.ts): <first 2 of the SHA-256>/<SHA-256>.
const mediaFile = /^media\/([0-9a-f]{2})\/\1[0-9a-f]{62}$/

// fflate writes no ZIP64: a zip holds at most 65,535 files and 4 GiB, with room for the headers.
const maxFiles = 65_000
const maxBytes = 4_000_000_000
const maxMetaBytes = 32 * 1024 * 1024
const readChunk = 256 * 1024

export const notBackupText = 'This is not an xDesign backup.'
const tooLargeText = 'The designs and their files are over 4 GB, too large for a backup.'

// backup.json.
const backupMeta = z.object({
  version: z.string().max(100),
  createdAt: z.iso.datetime(),
  kind: z.enum(desktopBackupKinds),
  files: z
    .array(
      z.object({
        path: z.string().max(200),
        size: z.number().int().min(0),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      }),
    )
    .max(maxFiles),
})
type BackupMeta = z.output<typeof backupMeta>

const zipLimits: ZipLimits = {
  entries: maxFiles + 1,
  directoryBytes: 32 * 1024 * 1024,
  name: (name) => name === metaName || name === databaseName || mediaFile.test(name),
}

// What the list shows of each backup, by name: the files never change once renamed.
const entries = new Map<string, DesktopBackup>()

function isMissing(error: unknown): boolean {
  return (error as { code?: unknown }).code === 'ENOENT'
}

function nameOf(at: Date): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return `xdesign-backup-${stamp}.zip`
}

function timeOfName(name: string): number {
  const parts = backupName.exec(name)?.slice(1).map(Number) ?? []
  const [year = 0, month = 1, day = 1, hours = 0, minutes = 0, seconds = 0] = parts
  return Date.UTC(year, month - 1, day, hours, minutes, seconds)
}

// The backups' file names, oldest first.
async function backupNames(): Promise<string[]> {
  try {
    const found = await readdir(backupsDir, { withFileTypes: true })
    return found
      .filter((entry) => entry.isFile() && backupName.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    if (isMissing(error)) {
      return []
    }
    throw error
  }
}

// One backup, restore or deletion at a time, in the order asked; `busy` counts the backups and
// restores asked for and not done.
let queue: Promise<unknown> = Promise.resolve()
let busy = 0

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task)
  queue = run.catch(() => undefined)
  return run
}

async function busyWhile<T>(task: () => Promise<T>): Promise<T> {
  busy++
  try {
    return await serial(task)
  } finally {
    busy--
  }
}

async function sumOf(path: string): Promise<FileSum> {
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of createReadStream(path, { highWaterMark: readChunk })) {
    const bytes = chunk as Buffer
    hash.update(bytes)
    size += bytes.length
  }
  return { size, sha256: hash.digest('hex') }
}

// A file of the backup: its path in the zip and where it is read from.
interface Source {
  path: string
  file: string
}

// The media folder's files as the store keeps them, without media/tmp/ (uploads under way).
async function mediaSources(): Promise<Source[]> {
  const dir = join(config.dataDir, mediaName)
  let tops
  try {
    tops = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (isMissing(error)) {
      return []
    }
    throw error
  }
  const sources: Source[] = []
  for (const top of tops) {
    if (!top.isDirectory() || !/^[0-9a-f]{2}$/.test(top.name)) {
      continue
    }
    for (const file of await readdir(join(dir, top.name), { withFileTypes: true })) {
      const path = `${mediaName}/${top.name}/${file.name}`
      if (file.isFile() && mediaFile.test(path)) {
        sources.push({ path, file: join(dir, top.name, file.name) })
      }
    }
  }
  return sources.sort((a, b) => (a.path < b.path ? -1 : 1))
}

// The newest backups only.
async function removeOldBackups(): Promise<void> {
  const names = await backupNames()
  for (const name of names.slice(0, Math.max(0, names.length - keepBackups))) {
    await rm(join(backupsDir, name), { force: true })
    entries.delete(name)
  }
}

// Makes a backup (inside serial): the database's copy and the media are read twice, first for
// backup.json, then into the zip, and a file that changed between the two stops the backup.
async function makeBackup(kind: DesktopBackupKind): Promise<DesktopBackup> {
  await mkdir(backupsDir, { recursive: true, mode: 0o700 })
  let now = new Date()
  // Two backups in one second: the next one waits for the next second.
  while (existsSync(join(backupsDir, nameOf(now)))) {
    await sleep(1000 - (now.getTime() % 1000))
    now = new Date()
  }
  const name = nameOf(now)
  const target = join(backupsDir, name)
  const partial = `${target}.partial`
  const work = `${target}.db.partial`
  try {
    await mkdir(work, { recursive: true })
    const database = join(work, databaseName)
    await getDb().$client.backup(database)
    const sources: Source[] = [{ path: databaseName, file: database }, ...(await mediaSources())]
    if (sources.length > maxFiles) {
      throw new ApiError('too_large', tooLargeText)
    }
    const files: (Source & FileSum)[] = []
    let total = 0
    for (const source of sources) {
      const sum = await sumOf(source.file)
      total += sum.size
      if (total > maxBytes) {
        throw new ApiError('too_large', tooLargeText)
      }
      files.push({ ...source, ...sum })
    }
    const meta: BackupMeta = {
      version,
      createdAt: now.toISOString(),
      kind,
      files: files.map(({ path, size, sha256 }) => ({ path, size, sha256 })),
    }
    const zip = await ZipWriter.create(partial)
    try {
      await zip.add(metaName, [Buffer.from(`${JSON.stringify(meta, null, 2)}\n`)], { deflate: true, mtime: now })
      for (const file of files) {
        const sum = await zip.add(file.path, createReadStream(file.file, { highWaterMark: readChunk }), {
          deflate: file.path === databaseName,
          mtime: now,
        })
        if (sum.size !== file.size || sum.sha256 !== file.sha256) {
          throw new Error(`${file.path} changed while the backup was made.`)
        }
      }
      await zip.finish()
    } catch (error) {
      await zip.abort()
      throw error
    }
    await rename(partial, target)
  } finally {
    await rm(work, { recursive: true, force: true })
    await rm(partial, { force: true })
  }
  await removeOldBackups()
  const entry: DesktopBackup = { name, createdAt: now.getTime(), size: (await stat(target)).size, kind, version }
  log.info({ backup: name, kind, size: entry.size }, 'desktop backup made')
  return entry
}

// "Make a backup now".
export function makeBackupNow(): Promise<DesktopBackup> {
  return busyWhile(() => makeBackup('manual'))
}

// The automatic backup: checked every hour, made when the newest backup of any kind is 24 hours
// old or there is none (the first check runs a minute after the start, src/jobs.ts).
export const desktopBackupJob: Job = {
  name: 'desktopBackup',
  everyMs: hourMs,
  run: () =>
    busyWhile(async () => {
      const newest = (await backupNames()).at(-1)
      if (newest !== undefined && Date.now() - timeOfName(newest) < dayMs) {
        return { made: null }
      }
      return { made: (await makeBackup('automatic')).name }
    }),
}

// backup.json, checked: the first entry, its schema, a version, each file once, the database
// among them, and the zip's entries exactly these files with their bytes.
async function readMeta(reader: ZipReader): Promise<BackupMeta> {
  const [first, ...rest] = reader.entries
  if (first?.name !== metaName || first.size > maxMetaBytes) {
    throw new BadZip('The zip does not start with backup.json.')
  }
  let meta: BackupMeta
  try {
    meta = backupMeta.parse(JSON.parse((await reader.read(first)).toString('utf8')))
  } catch (error) {
    throw error instanceof BadZip ? error : new BadZip('backup.json is not valid.')
  }
  const sizes = new Map(meta.files.map((file) => [file.path, file.size]))
  const total = meta.files.reduce((sum, file) => sum + file.size, 0)
  if (
    compareVersions(meta.version, meta.version) === null ||
    sizes.size !== meta.files.length ||
    !sizes.has(databaseName) ||
    total > maxBytes ||
    rest.length !== meta.files.length ||
    rest.some((entry) => entry.name === metaName || sizes.get(entry.name) !== entry.size)
  ) {
    throw new BadZip('backup.json does not match the zip.')
  }
  return meta
}

async function entryOf(name: string): Promise<DesktopBackup> {
  const kept = entries.get(name)
  if (kept) {
    return kept
  }
  const path = join(backupsDir, name)
  const reader = await ZipReader.open(path, zipLimits)
  try {
    const meta = await readMeta(reader)
    const entry: DesktopBackup = {
      name,
      createdAt: Date.parse(meta.createdAt),
      size: (await stat(path)).size,
      kind: meta.kind,
      version: meta.version,
    }
    entries.set(name, entry)
    return entry
  } finally {
    await reader.close()
  }
}

// The backups, newest first; a file that is not a backup is left out (and logged).
export async function listBackups(): Promise<{ backups: DesktopBackup[]; running: boolean }> {
  const backups: DesktopBackup[] = []
  for (const name of (await backupNames()).reverse()) {
    try {
      backups.push(await entryOf(name))
    } catch (error) {
      log.warn({ err: error, backup: name }, 'a desktop backup could not be read')
    }
  }
  return { backups, running: busy > 0 }
}

// The path of the backup with this name, or not_found.
export async function backupPath(name: string): Promise<{ path: string; size: number }> {
  const path = join(backupsDir, name)
  try {
    const stats = await stat(path)
    if (backupName.test(name) && stats.isFile()) {
      return { path, size: stats.size }
    }
  } catch (error) {
    if (!isMissing(error)) {
      throw error
    }
  }
  throw new ApiError('not_found')
}

export function deleteBackup(name: string): Promise<void> {
  return serial(async () => {
    const { path } = await backupPath(name)
    await rm(path, { force: true })
    entries.delete(name)
    log.info({ backup: name }, 'desktop backup deleted')
  })
}

// Unpacks the backup's database and media into the staging folder, each file checked against its
// bytes and SHA-256 as it is written.
async function unpack(reader: ZipReader, meta: BackupMeta): Promise<void> {
  const sums = new Map(meta.files.map((file) => [file.path, file.sha256]))
  await rm(stagingPartial, { recursive: true, force: true })
  await mkdir(join(stagingPartial, mediaName), { recursive: true })
  try {
    for (const entry of reader.entries.slice(1)) {
      const target = join(stagingPartial, ...entry.name.split('/'))
      await mkdir(dirname(target), { recursive: true })
      const sum = await reader.copy(entry, createWriteStream(target, { flags: 'wx' }))
      if (sum.sha256 !== sums.get(entry.name)) {
        throw new BadZip(`${entry.name} does not match its SHA-256.`)
      }
    }
  } catch (error) {
    await rm(stagingPartial, { recursive: true, force: true })
    throw error
  }
}

// Restores the backup in this file (inside busyWhile): refused when it is not a desktop backup,
// fails its checks or comes from a newer xDesign; then the backup of the app as it is, and the
// staging folder complete. Answers that backup; the caller restarts the server.
async function restoreFrom(path: string): Promise<DesktopBackup> {
  try {
    const reader = await ZipReader.open(path, zipLimits)
    try {
      const meta = await readMeta(reader)
      if ((compareVersions(meta.version, version) ?? 0) > 0) {
        throw new ApiError(
          'bad_request',
          `This backup is from xDesign ${meta.version}. Use that version or a newer one.`,
        )
      }
      await unpack(reader, meta)
    } finally {
      await reader.close()
    }
  } catch (error) {
    if (error instanceof BadZip) {
      log.warn({ err: error }, 'a desktop backup was refused')
      throw new ApiError('bad_request', notBackupText)
    }
    throw error
  }
  let before: DesktopBackup
  try {
    before = await makeBackup('beforeRestore')
    await rm(staging, { recursive: true, force: true })
    await rename(stagingPartial, staging)
  } catch (error) {
    await rm(stagingPartial, { recursive: true, force: true })
    throw error
  }
  log.info({ before: before.name }, 'a desktop backup is staged; the server restarts')
  return before
}

export function restoreBackup(name: string): Promise<DesktopBackup> {
  return busyWhile(async () => restoreFrom((await backupPath(name)).path))
}

// "Restore from a file...": the upload is written to a partial file of the backups folder (removed
// on a failure, and at the next start), then restored and removed.
export async function receiveUpload(file: Readable): Promise<string> {
  await mkdir(backupsDir, { recursive: true, mode: 0o700 })
  const upload = join(backupsDir, `upload-${nanoid()}.partial`)
  try {
    await pipeline(file, createWriteStream(upload, { flags: 'wx', mode: 0o600 }))
  } catch (error) {
    await rm(upload, { force: true })
    throw error
  }
  return upload
}

export async function restoreUpload(upload: string): Promise<DesktopBackup> {
  try {
    return await busyWhile(() => restoreFrom(upload))
  } finally {
    await rm(upload, { force: true })
  }
}

// The largest upload: a backup is never larger.
export const maxUploadBytes = maxBytes + 64 * 1024 * 1024

// How main.ts stops the server with a code (its one stop()).
let stopWith: (code: number) => void = (code) => process.exit(code)

export function setStop(stop: (code: number) => void): void {
  stopWith = stop
}

// After a restore's answer: the server closes (the jobs, live documents, the database) and exits
// with exitRestart; the app's shell starts it again and loads the window again.
export function restartServer(): void {
  stopWith(exitRestart)
}

// "Open the backups folder": the system's opener, detached and without a shell.
export async function openBackupsFolder(): Promise<void> {
  await mkdir(backupsDir, { recursive: true, mode: 0o700 })
  const opener = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(opener, [backupsDir], { detached: true, stdio: 'ignore', shell: false })
      child.once('error', reject).once('spawn', () => {
        child.unref()
        resolve()
      })
    })
  } catch (error) {
    log.warn({ err: error, opener }, 'the backups folder could not be opened')
    throw new ApiError('server_error', 'The backups folder could not be opened.')
  }
}

// Moves `from` to `to` when it is there and `to` is not (a swap that stopped halfway goes on).
function moveFree(from: string, to: string): void {
  if (existsSync(from) && !existsSync(to)) {
    renameSync(from, to)
  }
}

// At start, before the database opens (main.ts): the partial files of a backup or upload that
// stopped go; an incomplete staging folder is removed; a complete one replaces the database (with
// its WAL files) and the media, the old ones moved aside and removed once the swap is done.
export function applyStagedRestore(): void {
  if (existsSync(backupsDir)) {
    for (const name of readdirSync(backupsDir)) {
      if (name.endsWith('.partial')) {
        rmSync(join(backupsDir, name), { recursive: true, force: true })
      }
    }
  }
  if (existsSync(stagingPartial)) {
    rmSync(stagingPartial, { recursive: true, force: true })
    log.warn('an incomplete restore was removed')
  }
  if (existsSync(staging)) {
    mkdirSync(replaced, { recursive: true })
    for (const name of [databaseName, `${databaseName}-wal`, `${databaseName}-shm`, mediaName]) {
      moveFree(join(config.dataDir, name), join(replaced, name))
    }
    for (const name of [databaseName, mediaName]) {
      moveFree(join(staging, name), join(config.dataDir, name))
    }
    rmSync(staging, { recursive: true, force: true })
    log.info('a desktop backup was restored')
  }
  if (existsSync(replaced)) {
    rmSync(replaced, { recursive: true, force: true })
  }
}
