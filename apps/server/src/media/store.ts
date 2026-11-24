// Uploaded files on disk (docs/plan/02 section 6): <data>/media/<first 2>/<sha256>, one file per
// content for the whole server, shared by every media row with that hash. An upload streams into
// media/tmp/ while it is hashed, and moves to its place once it passed the checks.
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { access, mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Readable } from 'node:stream'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { nanoid } from 'nanoid'

import { config } from '../config.ts'

const mediaDir = join(config.dataDir, 'media')
const tmpDir = join(mediaDir, 'tmp')

// Where the file with this SHA-256 (hex) is kept.
export function mediaPath(sha256: string): string {
  return join(mediaDir, sha256.slice(0, 2), sha256)
}

export interface TempFile {
  path: string
  sha256: string
  bytes: number
}

// Writes the stream into a new temporary file, hashing it on the way. On a failure (the stream
// destroyed with an error, for one) the file is removed and the error thrown.
export async function writeTemp(source: Readable): Promise<TempFile> {
  await mkdir(tmpDir, { recursive: true })
  const path = join(tmpDir, nanoid())
  const hash = createHash('sha256')
  let bytes = 0
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk)
      bytes += chunk.length
      done(null, chunk)
    },
  })
  try {
    await pipeline(source, tap, createWriteStream(path, { flags: 'wx' }))
  } catch (error) {
    await rm(path, { force: true })
    throw error
  }
  return { path, sha256: hash.digest('hex'), bytes }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

// Moves the temporary file to its content's place. A file already there is kept (the same bytes),
// and the temporary one removed.
export async function keepTemp(temp: TempFile): Promise<void> {
  const target = mediaPath(temp.sha256)
  if (await exists(target)) {
    await rm(temp.path, { force: true })
    return
  }
  await mkdir(dirname(target), { recursive: true })
  await rename(temp.path, target)
}
