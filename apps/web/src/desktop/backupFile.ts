// "Restore from a file..." on the desktop app's Backups page (docs/plan/18 section 9.5, DESK-03):
// when a chosen backup was made, read from its backup.json for the question "Restore this
// backup?", then the file sent to DESK-02's restore route as a multipart form. backup.json is the
// zip's first entry (DESK-02 writes it so, without ZIP64); it is found through the zip's central
// directory, so only a few small slices of a backup of any size are read.
import { routes } from '@xdesign/api'
import { inflateSync, strFromU8 } from 'fflate'
import { z } from 'zod'

import { ApiError, NETWORK_ERROR, routeUrl } from '@/api/client'

/** The server's words for a file that is not a backup (DESK-02). */
export const notABackup = 'This is not an xDesign backup.'

const backupJson = z.object({ version: z.string(), createdAt: z.string() })

// The zip's records: the end of the central directory (22 bytes and a comment of at most 65,535),
// an entry of the central directory (46 bytes and its name) and a file's local header (30 bytes,
// its name and extra field).
const endRecord = 0x06054b50
const directoryEntry = 0x02014b50
const localHeader = 0x04034b50
const jsonName = 'backup.json'
// DESK-02 reads at most 32 MiB of backup.json.
const maxJson = 32 * 1024 * 1024

async function read(file: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer())
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

/** When the backup in `file` was made (UTC milliseconds), or undefined when it is not a backup. */
export async function backupTime(file: File): Promise<number | undefined> {
  try {
    const tailStart = Math.max(0, file.size - 22 - 0xffff)
    const tail = view(await read(file, tailStart, file.size))
    let end = tail.byteLength - 22
    while (end >= 0 && tail.getUint32(end, true) !== endRecord) end--
    if (end < 0) return undefined
    const directory = tail.getUint32(end + 16, true)
    const entryBytes = await read(file, directory, directory + 46 + jsonName.length)
    const entry = view(entryBytes)
    if (entry.getUint32(0, true) !== directoryEntry) return undefined
    const method = entry.getUint16(10, true)
    const packed = entry.getUint32(20, true)
    const size = entry.getUint32(24, true)
    const local = entry.getUint32(42, true)
    const name = entry.getUint16(28, true) === jsonName.length ? strFromU8(entryBytes.subarray(46)) : ''
    if (name !== jsonName) return undefined
    if ((method !== 0 && method !== 8) || size > maxJson || packed > maxJson) return undefined
    const header = view(await read(file, local, local + 30))
    if (header.getUint32(0, true) !== localHeader) return undefined
    const start = local + 30 + header.getUint16(26, true) + header.getUint16(28, true)
    const data = await read(file, start, start + packed)
    const text = strFromU8(method === 8 ? inflateSync(data, { out: new Uint8Array(size) }) : data)
    const parsed = backupJson.safeParse(JSON.parse(text))
    const time = parsed.success ? Date.parse(parsed.data.createdAt) : Number.NaN
    return Number.isFinite(time) ? time : undefined
  } catch {
    // A file too short for its records, a damaged deflate stream or JSON that is not.
    return undefined
  }
}

const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

/** Sends the backup; resolves once the server took it (it starts again with it next). */
export async function restoreFromFile(file: File): Promise<void> {
  const form = new FormData()
  form.set('file', file, file.name)
  let response: Response
  try {
    response = await fetch(routeUrl(routes.restoreDesktopBackupFile), {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'The server could not be reached. Check your connection and try again.')
  }
  const json: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const failure = errorBody.safeParse(json)
    throw failure.success
      ? new ApiError(response.status, failure.data.error.code, failure.data.error.message)
      : new ApiError(response.status, 'server_error', 'Something went wrong on the server. Try again.')
  }
  if (!routes.restoreDesktopBackupFile.response.safeParse(json).success) {
    throw new ApiError(response.status, 'server_error', 'The server sent an answer this page does not understand.')
  }
}
