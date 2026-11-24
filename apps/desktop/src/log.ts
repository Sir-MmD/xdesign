// The desktop app's log (docs/plan/18 section 9.2): the server's standard output and error as they
// come, and the shell's own lines in the server's JSON line format (pino's level numbers), appended to
// <userData>/logs/xdesign.log. At 10 MB a new file starts and the older ones move to xdesign.log.1 to
// .5 (5 kept). Writing is best effort: a full disk or a locked file loses lines, never the app.
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

const maxBytes = 10 * 1024 * 1024
const kept = 5

export interface Log {
  path: string
  // A chunk of the server's output.
  write: (chunk: Uint8Array) => void
  info: (msg: string, fields?: Record<string, unknown>) => void
  warn: (msg: string, fields?: Record<string, unknown>) => void
}

// xdesign.log.4 becomes .5 (the old .5 goes), ..., xdesign.log becomes .1.
function rotate(path: string): void {
  rmSync(`${path}.${String(kept)}`, { force: true })
  for (let n = kept - 1; n >= 1; n--) {
    if (existsSync(`${path}.${String(n)}`)) {
      renameSync(`${path}.${String(n)}`, `${path}.${String(n + 1)}`)
    }
  }
  renameSync(path, `${path}.1`)
}

// The file opens at the first line.
export function openLog(path: string): Log {
  let fd: number | undefined
  let size = 0

  const write = (chunk: Uint8Array): void => {
    try {
      if (fd === undefined) {
        mkdirSync(dirname(path), { recursive: true })
        fd = openSync(path, 'a')
        size = fstatSync(fd).size
      }
      if (size > 0 && size + chunk.length > maxBytes) {
        closeSync(fd)
        fd = undefined
        rotate(path)
        fd = openSync(path, 'a')
        size = 0
      }
      writeSync(fd, chunk)
      size += chunk.length
    } catch {
      // Best effort, as above; the next line tries again.
    }
  }

  const line = (level: number, msg: string, fields: Record<string, unknown> = {}): void => {
    write(Buffer.from(`${JSON.stringify({ level, time: Date.now(), from: 'desktop', ...fields, msg })}\n`))
  }

  return {
    path,
    write,
    info: (msg, fields) => {
      line(30, msg, fields)
    },
    warn: (msg, fields) => {
      line(40, msg, fields)
    },
  }
}
