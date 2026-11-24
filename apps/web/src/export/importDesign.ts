// "Import" (docs/plan/06 section 6): an `.xdesign.zip` or a `spec.json` read in the browser
// (fflate), checked with fromSpec (the format version, older ones migrated, the schema in plain
// words), then sent to `POST /api/designs/import`, which makes a new design owned by the importer
// with the ID names and texts kept. The browser then uploads the zip's media files to the new
// design and sets their server IDs in its document. An import never merges into a design.
import { routes } from '@xdesign/api'
import { type Design, designEdits, fromSpec, type MediaId, type MediaItem } from '@xdesign/spec'
import { strFromU8, unzipSync } from 'fflate'

import { ApiError, call, routeUrl } from '@/api/client'
import { openLiveDoc } from '@/export/liveDoc'

/** An export read from a file, ready to import. */
export interface ReadExport {
  spec: unknown
  design: Design
  /** The uploaded files of the design by their path in the zip (`media/...`), and the ones found in the zip. */
  media: Map<string, MediaItem>
  files: Map<string, Uint8Array>
}

export type ReadResult = { ok: true; read: ReadExport } | { ok: false; problems: string[] }

const notAnExport = 'This file is not an .xdesign.zip or a spec.json.'

function failed(...problems: string[]): ReadResult {
  return { ok: false, problems }
}

/** The spec.json of a zip and its media files: at the top, or in the one folder an unpacked export was zipped again in. */
function readZip(bytes: Uint8Array): { text: string; files: Map<string, Uint8Array> } | undefined {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes, { filter: (file) => /(^|\/)(spec\.json$|media\/)/.test(file.name) })
  } catch {
    return undefined
  }
  const spec = Object.keys(entries)
    .filter((name) => name === 'spec.json' || name.endsWith('/spec.json'))
    .sort((a, b) => a.length - b.length)[0]
  const data = spec === undefined ? undefined : entries[spec]
  if (spec === undefined || !data) return undefined
  const folder = spec.slice(0, -'spec.json'.length)
  const files = new Map<string, Uint8Array>()
  for (const [name, file] of Object.entries(entries)) {
    if (name.startsWith(`${folder}media/`) && !name.endsWith('/')) files.set(name.slice(folder.length), file)
  }
  return { text: strFromU8(data), files }
}

/** Reads a dropped or chosen file; its problems are in plain words. */
export async function readExport(file: File): Promise<ReadResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // A zip starts with "PK"; anything else is read as spec.json.
  const zipped = bytes[0] === 0x50 && bytes[1] === 0x4b
  const found = zipped ? readZip(bytes) : { text: strFromU8(bytes), files: new Map<string, Uint8Array>() }
  if (!found) return failed(notAnExport)
  let spec: unknown
  try {
    spec = JSON.parse(found.text)
  } catch {
    return failed(zipped ? 'Its spec.json is not valid JSON.' : notAnExport)
  }
  const result = fromSpec(spec)
  if (!result.ok) {
    return failed(...result.problems.slice(0, 5).map((problem) => `${problem.path} ${problem.message}`.trim()))
  }
  const media = new Map<string, MediaItem>()
  for (const [id, path] of Object.entries(result.files)) {
    const item = result.design.media[id]
    if (item) media.set(path, item)
  }
  return { ok: true, read: { spec, design: result.design, media, files: found.files } }
}

/** "34 steps": as the Designs page counts them (notes and sections are not steps). */
export function stepCount(design: Design): number {
  return Object.values(design.steps).filter((step) => step.kind !== 'note' && step.kind !== 'frame').length
}

// One file to the new design (MEDIA-01's upload form); returns its media ID on the server.
async function upload(designId: string, item: MediaItem, data: Uint8Array): Promise<string> {
  const form = new FormData()
  form.set('kind', item.kind)
  if (item.width !== undefined && item.width >= 1) form.set('width', String(Math.round(item.width)))
  if (item.height !== undefined && item.height >= 1) form.set('height', String(Math.round(item.height)))
  if (item.durationMs !== undefined && item.durationMs >= 0) form.set('durationMs', String(Math.round(item.durationMs)))
  form.set('file', new Blob([data as Uint8Array<ArrayBuffer>], { type: item.mime }), item.name)
  const response = await fetch(routeUrl(routes.uploadMedia, { params: { id: designId } }), {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  })
  const json: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = (json as { error?: { message?: unknown } } | undefined)?.error?.message
    throw new ApiError(response.status, 'upload_failed', typeof message === 'string' ? message : 'The upload failed.')
  }
  const answer = routes.uploadMedia.response.safeParse(json)
  if (!answer.success) throw new ApiError(response.status, 'server_error', 'The upload failed.')
  return answer.data.media.id
}

export interface Imported {
  id: string
  name: string
  /** The files that could not be uploaded, by their names, with the reason. */
  problems: string[]
}

/** "Import as a new design": the new design, then its files; `onProgress` counts the uploads. */
export async function importExport(
  read: ReadExport,
  onProgress: (done: number, total: number) => void,
): Promise<Imported> {
  const { design, files } = await call(routes.importDesign, { body: { spec: read.spec } })
  const uploads = Object.entries(files).flatMap(([id, path]) => {
    const item = read.media.get(path)
    const data = read.files.get(path)
    return item && data ? [{ id, item, data }] : []
  })
  const problems: string[] = []
  const serverIds = new Map<MediaId, string>()
  for (const [index, { id, item, data }] of uploads.entries()) {
    onProgress(index, uploads.length)
    try {
      serverIds.set(id, await upload(design.id, item, data))
    } catch (error) {
      problems.push(`${item.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  onProgress(uploads.length, uploads.length)
  if (serverIds.size > 0) {
    try {
      const live = await openLiveDoc(design.id)
      try {
        const edits = designEdits(live.doc, 'import')
        for (const [id, serverId] of serverIds) edits.media.setServerId(id, serverId)
        await live.saved()
      } finally {
        live.close()
      }
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
    }
  }
  return { id: design.id, name: design.name, problems }
}
