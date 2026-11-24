// The export (docs/plan/06 section 2), built in the browser (D-13) from packages/spec's export
// functions and the picture maker:
//   <design-idname>-<UTC date>.xdesign.zip
//     spec.json               toSpec with the checks of the moment
//     design.md               toMarkdown with the pictures' paths (and the open comments)
//     HOW-TO-READ.md          the guide for builders
//     bot-spec.schema.json    the JSON Schema of spec.json (what make gen writes to packages/spec/schema/)
//     media/                  every uploaded file, named <idName>.<ext>, fetched with the session
//     pictures/               <step idName>.<language>.png, bot-profile, empty-chat, commands-menu
// fflate's synchronous zip is used: its asynchronous one starts workers from blob: addresses,
// which the Content Security Policy does not allow.
import { routes } from '@xdesign/api'
import {
  check,
  type Design,
  HOW_TO_READ,
  type Lang,
  type MediaId,
  mediaFiles,
  type OpenQuestion,
  specChecks,
  specJsonSchema,
  toIdName,
  toMarkdown,
  toSpec,
} from '@xdesign/spec'
import { strToU8, zipSync, type Zippable } from 'fflate'

import { call } from '@/api/client'
import { mediaUrl } from '@/api/media'
import { makePictures, picturePath, type PictureLook, picturesOf } from '@/export/pictures'

/** What the export is doing, for its progress line. */
export type ExportProgress = { stage: 'media' | 'pictures'; done: number; total: number } | { stage: 'zip' }

export interface ExportOptions {
  /** The languages exported (the default one is always among them). */
  langs: readonly Lang[]
  /** The languages that get pictures: all exported ones, the default one, or none. */
  pictureLangs: readonly Lang[]
  look: PictureLook
  /** The version of the design's document. */
  docVersion: number
  /** The design whose open comments design.md lists as "Open questions" (06 section 1); none without it. */
  commentsOf?: string | undefined
  /** The name of the exported version (HIST-02: a named version, or now just named). */
  versionName?: string | null | undefined
  signal?: AbortSignal | undefined
  onProgress?: ((progress: ExportProgress) => void) | undefined
}

/** `coffee_shop-2026-11-23.xdesign.zip`: the design name as an ID name and the UTC date. */
export function zipName(design: Design, now: Date): string {
  return `${toIdName(design.name, '', new Set(), 'design_')}-${now.toISOString().slice(0, 10)}.xdesign.zip`
}

/** The design's open comment threads as design.md lists them, oldest first. */
async function openQuestions(designId: string, signal: AbortSignal | undefined): Promise<OpenQuestion[]> {
  const { threads } = await call(routes.comments, { params: { id: designId } }, { signal })
  return threads
    .filter((thread) => thread.resolvedAt === null)
    .reverse()
    .map(({ anchor, comments }) => ({
      ...(anchor.on === 'map' ? {} : { stepId: anchor.stepId, title: anchor.title }),
      ...(anchor.on === 'button' && { buttonId: anchor.buttonId }),
      ...(anchor.on === 'text' && { lang: anchor.lang }),
      comments: comments.map((comment) => ({
        author: comment.author?.name ?? 'A removed member',
        at: new Date(comment.createdAt).toISOString(),
        body: comment.body,
      })),
    }))
}

/** "xDesign 1.0.0", with the server's version. */
async function exportedBy(): Promise<string> {
  try {
    const { version } = await call(routes.health)
    return `xDesign ${version}`
  } catch {
    return 'xDesign'
  }
}

/**
 * Builds the zip of an export, with the pictures it made by their paths (for the picture cache);
 * throws the signal's reason when stopped.
 */
export async function buildExport(
  design: Design,
  options: ExportOptions,
): Promise<{ name: string; zip: Uint8Array; pictures: ReadonlyMap<string, Blob> }> {
  const { langs, signal, onProgress } = options
  const now = new Date()
  const exportedAt = now.toISOString()
  const issues = check(design)
  const files = mediaFiles(design)
  const questions = options.commentsOf === undefined ? undefined : await openQuestions(options.commentsOf, signal)
  const mediaFile = (item: { id: MediaId }) => files.get(item.id) ?? `media/${item.id}`
  const spec = toSpec(design, {
    languages: langs,
    checks: specChecks(issues),
    exportedBy: await exportedBy(),
    exportedAt,
    docVersion: options.docVersion,
    versionName: options.versionName ?? null,
    mediaFile,
  })
  const zip: Zippable = {
    'spec.json': strToU8(`${JSON.stringify(spec, null, 2)}\n`),
    'HOW-TO-READ.md': strToU8(HOW_TO_READ),
    'bot-spec.schema.json': strToU8(`${JSON.stringify(specJsonSchema(), null, 2)}\n`),
  }

  // The uploaded files, as the server keeps them (stored, not compressed again).
  const uploaded = Object.values(design.media).filter((item) => item.serverId !== '')
  for (const [index, item] of uploaded.entries()) {
    onProgress?.({ stage: 'media', done: index, total: uploaded.length })
    const url = mediaUrl(item.serverId)
    const response = await fetch(url, { credentials: 'same-origin', signal: signal ?? null }).catch(
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        return undefined
      },
    )
    if (!response?.ok) throw new Error(`The file ${item.name} could not be fetched. Try again.`)
    zip[mediaFile(item)] = [new Uint8Array(await response.arrayBuffer()), { level: 0 }]
  }

  const pictures = await makePictures(design, picturesOf(design, options.pictureLangs), {
    look: options.look,
    date: exportedAt,
    signal,
    onProgress: (done, total) => {
      onProgress?.({ stage: 'pictures', done, total })
    },
  })
  for (const [path, png] of pictures) zip[path] = [new Uint8Array(await png.arrayBuffer()), { level: 0 }]

  zip['design.md'] = strToU8(
    toMarkdown(design, {
      languages: langs,
      checks: issues,
      pictures: (name, lang) => {
        const path = picturePath(name, lang)
        return pictures.has(path) ? path : null
      },
      exportedAt,
      version: options.docVersion,
      versionName: options.versionName ?? null,
      mediaFile,
      ...(questions && { openQuestions: questions }),
    }),
  )
  signal?.throwIfAborted()
  onProgress?.({ stage: 'zip' })
  // Let the progress line show before the zip takes the main thread.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { name: zipName(design, now), zip: zipSync(zip, { level: 6 }), pictures }
}

/** Hands a file to the browser's downloads. */
export function download(name: string, data: Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10_000)
}
