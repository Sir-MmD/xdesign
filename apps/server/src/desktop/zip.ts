// The desktop app's backup files are zips (docs/plan/18 section 9.5, DESK-02). fflate's streaming
// Zip writes them a file at a time, each deflated or stored as it is read, so a large media folder
// never sits in memory. The reader is strict, as the server's backups are (07 section 5): it reads
// the central directory and takes only plain files, stored or deflated, unencrypted, each named
// once, in order and without overlaps, and never more bytes than an entry says. fflate writes no
// ZIP64, so a zip stays under 4 GB and 65,535 files, and the reader refuses ZIP64.
import { createHash } from 'node:crypto'
import { open, rm, type FileHandle } from 'node:fs/promises'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createInflateRaw } from 'node:zlib'

import { Zip, ZipDeflate, ZipPassThrough, type FlateError } from 'fflate'

// A file's bytes and hex SHA-256.
export interface FileSum {
  size: number
  sha256: string
}

// A file that is not a zip the reader takes.
export class BadZip extends Error {}

const localSignature = 0x04034b50
const centralSignature = 0x02014b50
const endSignature = 0x06054b50
const localHeaderSize = 30
const centralHeaderSize = 46
const endSize = 22
// The 32-bit and 16-bit fields that mean "see ZIP64".
const zip64Size = 0xffffffff
const zip64Count = 0xffff

const stored = 0
const deflated = 8

// Hashes and counts what passes, and refuses more bytes than expected.
function sumOf(expected: number, sum: FileSum): Transform {
  const hash = createHash('sha256')
  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      sum.size += chunk.length
      if (sum.size > expected) {
        done(new BadZip('An entry holds more bytes than it says.'))
        return
      }
      hash.update(chunk)
      done(null, chunk)
    },
    flush(done) {
      sum.sha256 = hash.digest('hex')
      done()
    },
  })
}

export interface ZipOptions {
  // Deflated (the database and backup.json) or stored as it is (media, mostly compressed already).
  deflate: boolean
  mtime: Date
}

export class ZipWriter {
  private readonly path: string
  private readonly handle: FileHandle
  private readonly zip: Zip
  private chunks: Uint8Array[] = []
  private failure: FlateError | null = null

  private constructor(path: string, handle: FileHandle) {
    this.path = path
    this.handle = handle
    // fflate hands over the zip's bytes as they are made; flush() writes them in order.
    this.zip = new Zip((error, chunk) => {
      if (error) {
        this.failure ??= error
      } else {
        this.chunks.push(chunk)
      }
    })
  }

  // A new file at `path` (never an existing one), readable only by its owner.
  static async create(path: string): Promise<ZipWriter> {
    return new ZipWriter(path, await open(path, 'wx', 0o600))
  }

  private async flush(): Promise<void> {
    if (this.failure) {
      throw this.failure
    }
    const chunks = this.chunks
    this.chunks = []
    for (const chunk of chunks) {
      let written = 0
      while (written < chunk.length) {
        written += (await this.handle.write(chunk, written)).bytesWritten
      }
    }
  }

  // Adds one file from its chunks; answers its bytes and SHA-256 as written.
  async add(
    name: string,
    source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
    options: ZipOptions,
  ): Promise<FileSum> {
    const entry = options.deflate ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name)
    entry.mtime = options.mtime
    this.zip.add(entry)
    const hash = createHash('sha256')
    let size = 0
    for await (const chunk of source) {
      hash.update(chunk)
      size += chunk.length
      entry.push(chunk)
      await this.flush()
    }
    entry.push(new Uint8Array(0), true)
    await this.flush()
    return { size, sha256: hash.digest('hex') }
  }

  // The central directory, then the file is synced and closed.
  async finish(): Promise<void> {
    this.zip.end()
    await this.flush()
    await this.handle.sync()
    await this.handle.close()
  }

  // Closes and removes the unfinished file.
  async abort(): Promise<void> {
    this.zip.terminate()
    await this.handle.close().catch(() => undefined)
    await rm(this.path, { force: true })
  }
}

export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  // Where its local header starts, and where the next entry (or the central directory) starts.
  offset: number
  end: number
}

export interface ZipLimits {
  // The most entries, and the most bytes of the central directory.
  entries: number
  directoryBytes: number
  // Whether a name may be an entry's (the caller's layout).
  name: (name: string) => boolean
}

// The Unix file type in the high half of the external attributes: none or a plain file; and
// MS-DOS's directory bit.
const unixTypeMask = 0o170000
const unixFile = 0o100000
const dosDirectory = 0x10

export class ZipReader {
  readonly entries: readonly ZipEntry[]
  private readonly handle: FileHandle

  private constructor(handle: FileHandle, entries: ZipEntry[]) {
    this.handle = handle
    this.entries = entries
  }

  // Opens the zip and reads its central directory; BadZip when it is not one the reader takes.
  static async open(path: string, limits: ZipLimits): Promise<ZipReader> {
    const handle = await open(path, 'r')
    try {
      return new ZipReader(handle, await readDirectory(handle, limits))
    } catch (error) {
      await handle.close()
      throw error
    }
  }

  async close(): Promise<void> {
    await this.handle.close()
  }

  // Inflates the entry into `target` while it is counted and hashed: BadZip when its bytes are
  // not what the directory says.
  async copy(entry: ZipEntry, target: Writable): Promise<FileSum> {
    const header = Buffer.alloc(localHeaderSize)
    await readExactly(this.handle, header, entry.offset)
    const nameLength = header.readUInt16LE(26)
    const start = entry.offset + localHeaderSize + nameLength + header.readUInt16LE(28)
    const name = Buffer.alloc(nameLength)
    await readExactly(this.handle, name, entry.offset + localHeaderSize)
    if (
      header.readUInt32LE(0) !== localSignature ||
      header.readUInt16LE(8) !== entry.method ||
      name.toString('utf8') !== entry.name ||
      start + entry.compressedSize > entry.end
    ) {
      throw new BadZip(`The local header of ${entry.name} does not match the directory.`)
    }
    const source =
      entry.compressedSize === 0
        ? Readable.from([])
        : this.handle.createReadStream({ start, end: start + entry.compressedSize - 1, autoClose: false })
    const sum: FileSum = { size: 0, sha256: '' }
    const counted = sumOf(entry.size, sum)
    try {
      await (entry.method === deflated
        ? pipeline(source, createInflateRaw(), counted, target)
        : pipeline(source, counted, target))
    } catch (error) {
      // zlib's errors (Z_DATA_ERROR, ...) are a damaged entry; the target's are the disk's.
      const code = (error as { code?: unknown }).code
      throw typeof code === 'string' && code.startsWith('Z_') ? new BadZip(`${entry.name} is damaged.`) : error
    }
    if (sum.size !== entry.size) {
      throw new BadZip(`${entry.name} holds fewer bytes than it says.`)
    }
    return sum
  }

  // The whole entry in memory (backup.json); the caller checked its size.
  async read(entry: ZipEntry): Promise<Buffer> {
    const chunks: Buffer[] = []
    await this.copy(
      entry,
      new Writable({
        write(chunk: Buffer, _encoding, done) {
          chunks.push(chunk)
          done()
        },
      }),
    )
    return Buffer.concat(chunks)
  }
}

async function readExactly(handle: FileHandle, buffer: Buffer, position: number): Promise<void> {
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
  if (bytesRead !== buffer.length) {
    throw new BadZip('The zip ends too early.')
  }
}

// The end of central directory record (no ZIP64, one disk), then each entry of the directory.
async function readDirectory(handle: FileHandle, limits: ZipLimits): Promise<ZipEntry[]> {
  const { size: fileSize } = await handle.stat()
  if (fileSize < endSize) {
    throw new BadZip('This is not a zip.')
  }
  // The record ends the file, after a comment of at most 65,535 bytes.
  const tail = Buffer.alloc(Math.min(fileSize, endSize + 0xffff))
  await readExactly(handle, tail, fileSize - tail.length)
  let at = -1
  for (let i = tail.length - endSize; i >= 0; i--) {
    if (tail.readUInt32LE(i) === endSignature && i + endSize + tail.readUInt16LE(i + 20) === tail.length) {
      at = i
      break
    }
  }
  if (at < 0) {
    throw new BadZip('This is not a zip.')
  }
  const count = tail.readUInt16LE(at + 10)
  const directorySize = tail.readUInt32LE(at + 12)
  const directoryAt = tail.readUInt32LE(at + 16)
  if (
    tail.readUInt16LE(at + 4) !== 0 ||
    tail.readUInt16LE(at + 6) !== 0 ||
    tail.readUInt16LE(at + 8) !== count ||
    count === 0 ||
    count === zip64Count ||
    count > limits.entries ||
    directorySize > limits.directoryBytes ||
    directoryAt + directorySize !== fileSize - tail.length + at
  ) {
    throw new BadZip('This zip is not one the app reads.')
  }
  const directory = Buffer.alloc(directorySize)
  await readExactly(handle, directory, directoryAt)
  const entries: ZipEntry[] = []
  const names = new Set<string>()
  let p = 0
  for (let i = 0; i < count; i++) {
    if (p + centralHeaderSize > directorySize || directory.readUInt32LE(p) !== centralSignature) {
      throw new BadZip('The central directory is damaged.')
    }
    const flags = directory.readUInt16LE(p + 8)
    const method = directory.readUInt16LE(p + 10)
    const compressedSize = directory.readUInt32LE(p + 20)
    const size = directory.readUInt32LE(p + 24)
    const nameLength = directory.readUInt16LE(p + 28)
    const extraLength = directory.readUInt16LE(p + 30)
    const commentLength = directory.readUInt16LE(p + 32)
    const attributes = directory.readUInt32LE(p + 38)
    const offset = directory.readUInt32LE(p + 42)
    const nameEnd = p + centralHeaderSize + nameLength
    if (nameEnd > directorySize) {
      throw new BadZip('The central directory is damaged.')
    }
    const name = directory.toString('utf8', p + centralHeaderSize, nameEnd)
    const unixType = (attributes >>> 16) & unixTypeMask
    if (
      // Encrypted.
      (flags & 1) !== 0 ||
      (method !== stored && method !== deflated) ||
      (method === stored && compressedSize !== size) ||
      compressedSize === zip64Size ||
      size === zip64Size ||
      offset === zip64Size ||
      directory.readUInt16LE(p + 34) !== 0 ||
      (unixType !== 0 && unixType !== unixFile) ||
      (attributes & dosDirectory) !== 0 ||
      names.has(name) ||
      !limits.name(name)
    ) {
      throw new BadZip(`The entry ${name} is not one the app reads.`)
    }
    names.add(name)
    entries.push({ name, method, compressedSize, size, offset, end: directoryAt })
    p = nameEnd + extraLength + commentLength
  }
  if (p !== directorySize) {
    throw new BadZip('The central directory is damaged.')
  }
  // In order, each before the next: no entry overlaps another.
  for (const [i, entry] of entries.entries()) {
    entry.end = entries[i + 1]?.offset ?? directoryAt
    if (entry.offset + localHeaderSize + Buffer.byteLength(entry.name) + entry.compressedSize > entry.end) {
      throw new BadZip(`The entry ${entry.name} overlaps the next.`)
    }
  }
  return entries
}
