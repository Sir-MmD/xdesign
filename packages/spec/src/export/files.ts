// What the browser's export and the server's (the Claude link, docs/plan/06 section 7.3) give
// toSpec the same way: the path of each uploaded file in the export, and the checks as spec.json
// lists them.
import type { Issue } from '../checks/issues.ts'
import type { Design } from '../model/design.ts'
import type { MediaId } from '../model/ids.ts'
import { toIdName } from '../names/id-name.ts'
import type { SpecCheck } from './schema.ts'

// File extensions of the upload types (MEDIA-01), for a file whose name has none.
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/gzip': 'tgs',
  'text/plain': 'txt',
}

/**
 * The path of each uploaded file in the zip, `media/<idName>.<ext>`: an ID name made from its
 * uploaded name (unique in the design), and the extension of that name or of its type.
 */
export function mediaFiles(design: Design): Map<MediaId, string> {
  const items = Object.values(design.media).sort((a, b) =>
    a.name === b.name ? (a.id < b.id ? -1 : 1) : a.name < b.name ? -1 : 1,
  )
  const taken = new Set<string>()
  const files = new Map<MediaId, string>()
  for (const item of items) {
    const dot = item.name.lastIndexOf('.')
    const stem = dot > 0 ? item.name.slice(0, dot) : item.name
    const own = dot > 0 ? item.name.slice(dot + 1).toLowerCase() : ''
    const extension = /^[a-z0-9]{1,8}$/.test(own) ? own : (extensions[item.mime] ?? 'bin')
    const name = toIdName(stem, '', taken, 'file_')
    taken.add(name)
    files.set(item.id, `media/${name}.${extension}`)
  }
  return files
}

/** The checks as spec.json lists them; toSpec turns the IDs into ID names. */
export function specChecks(issues: readonly Issue[]): SpecCheck[] {
  return issues.map((issue) => ({
    level: issue.level,
    code: issue.code,
    where: issue.stepId ?? '',
    ...(issue.buttonId !== undefined && { button: issue.buttonId }),
    ...(issue.language !== undefined && { language: issue.language }),
    message: issue.message,
    ...(issue.ignored === true && { ignored: true }),
  }))
}
