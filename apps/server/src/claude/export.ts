// The server-side export (docs/plan/06 section 7.3): spec.json and design.md of a design's stored
// document or of one of its versions (HIST-01), made with packages/spec's export functions from
// the stored Yjs state as the browser's export makes them. The Claude link and the MCP connector
// (CL-02) use it. The plain design, its checks and the files made from them are kept in memory
// per design and doc_version (a version per its ID): the last `keepExports`, fewer when their
// states and files pass `keepBytes` together.
import { createHash } from 'node:crypto'

import {
  check,
  decodeDoc,
  type Design,
  type Issue,
  type Lang,
  type MediaId,
  mediaFiles,
  type OpenQuestion,
  readDesign,
  specChecks,
  toMarkdown,
  toSpec,
} from '@xdesign/spec'
import { and, eq } from 'drizzle-orm'

import { getDb } from '../db/index.ts'
import { designDocs, designs, versions } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import { readThreads } from '../routes/comments.ts'
import { version as appVersion } from '../version.ts'
import { pictureSet, pictureViews } from './pictures.ts'

const keepExports = 16
const keepBytes = 64 * 1024 * 1024
// The files of one export kept for its languages and pictures; older ones are made again.
const keepFiles = 8

export interface DesignExport {
  // Its key among the kept exports.
  key: string
  designId: string
  // The version asked for, null for the stored document.
  versionId: string | null
  versionName: string | null
  docVersion: number
  design: Design
  issues: Issue[]
  // When it was made, as an ISO 8601 time.
  exportedAt: string
  // The size of the state it was read from, for the memory bound.
  stateBytes: number
  // The files made from it by their key (the kind, the languages and the pictures).
  files: Map<string, string>
}

const exports = new Map<string, DesignExport>()

function weight(exp: DesignExport): number {
  let bytes = exp.stateBytes
  for (const text of exp.files.values()) {
    bytes += text.length
  }
  return bytes
}

// The export becomes the newest kept one; the oldest ones past the bounds go (never this one).
function keep(exp: DesignExport): DesignExport {
  exports.delete(exp.key)
  exports.set(exp.key, exp)
  let total = 0
  for (const kept of exports.values()) {
    total += weight(kept)
  }
  for (const [key, old] of exports) {
    if (key === exp.key || (exports.size <= keepExports && total <= keepBytes)) {
      break
    }
    exports.delete(key)
    total -= weight(old)
  }
  return exp
}

function made(
  key: string,
  source: Pick<DesignExport, 'designId' | 'versionId' | 'versionName' | 'docVersion'>,
  state: Uint8Array,
): DesignExport {
  const design = readDesign(decodeDoc(state))
  const exportedAt = new Date().toISOString()
  return keep({ key, ...source, design, issues: check(design), exportedAt, stateBytes: state.length, files: new Map() })
}

// The version of `?version=`: its ID, else a named version by its name ignoring case (names are
// unique per design).
function findVersion(designId: string, nameOrId: string) {
  const db = getDb()
  const fields = { id: versions.id, name: versions.name, docVersion: versions.docVersion }
  const byId = db
    .select(fields)
    .from(versions)
    .where(and(eq(versions.designId, designId), eq(versions.id, nameOrId)))
    .get()
  if (byId) {
    return byId
  }
  const lower = nameOrId.toLocaleLowerCase()
  const named = db
    .select(fields)
    .from(versions)
    .where(and(eq(versions.designId, designId), eq(versions.kind, 'named')))
    .all()
    .find((row) => row.name?.toLocaleLowerCase() === lower)
  if (!named) {
    throw new ApiError('not_found', 'This version was not found.')
  }
  return named
}

// The export of the design's stored document, or of the version `nameOrId`. Runs without awaits,
// so the stored state and its doc_version are read together.
export function exportOf(designId: string, nameOrId?: string): DesignExport {
  const db = getDb()
  if (nameOrId !== undefined) {
    const found = findVersion(designId, nameOrId)
    const key = `${designId}#${found.id}`
    const cached = exports.get(key)
    if (cached) {
      return keep(cached)
    }
    const row = db.select({ state: versions.state }).from(versions).where(eq(versions.id, found.id)).get()
    if (!row) {
      throw new ApiError('not_found', 'This version was not found.')
    }
    const source = { designId, versionId: found.id, versionName: found.name, docVersion: found.docVersion }
    return made(key, source, row.state)
  }
  const design = db.select({ docVersion: designs.docVersion }).from(designs).where(eq(designs.id, designId)).get()
  if (!design) {
    throw new ApiError('not_found', 'This design was not found.')
  }
  const key = `${designId}@${String(design.docVersion)}`
  const cached = exports.get(key)
  if (cached) {
    return keep(cached)
  }
  const row = db.select({ state: designDocs.state }).from(designDocs).where(eq(designDocs.designId, designId)).get()
  if (!row) {
    throw new ApiError('not_found', 'This design has no document yet.')
  }
  return made(key, { designId, versionId: null, versionName: null, docVersion: design.docVersion }, row.state)
}

// `?languages=en,fa` as a list (the export functions always add the default language); undefined
// for every language.
export function parseLanguages(text: string | undefined): Lang[] | undefined {
  if (text === undefined || text.trim() === '') {
    return undefined
  }
  const langs = text
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter((lang) => lang !== '')
  return [...new Set(langs)].sort()
}

function file(exp: DesignExport, key: string, make: () => string): string {
  const kept = exp.files.get(key)
  if (kept !== undefined) {
    return kept
  }
  const text = make()
  exp.files.set(key, text)
  for (const old of exp.files.keys()) {
    if (exp.files.size <= keepFiles) {
      break
    }
    exp.files.delete(old)
  }
  keep(exp)
  return text
}

function mediaFileOf(design: Design) {
  const paths = mediaFiles(design)
  return (item: { id: MediaId }) => paths.get(item.id) ?? `media/${item.id}`
}

// spec.json as the export's zip has it.
export function specJson(exp: DesignExport, langs: readonly Lang[] | undefined): string {
  return file(exp, `spec:${langs?.join(',') ?? ''}`, () => {
    const spec = toSpec(exp.design, {
      ...(langs === undefined ? {} : { languages: langs }),
      checks: specChecks(exp.issues),
      exportedBy: `xDesign ${appVersion}`,
      exportedAt: exp.exportedAt,
      docVersion: exp.docVersion,
      versionName: exp.versionName,
      mediaFile: mediaFileOf(exp.design),
    })
    return `${JSON.stringify(spec, null, 2)}\n`
  })
}

// The step ID or Bot setup view a picture name (a step's ID name, or a view) stands for in the
// design; null when it names nothing.
export function pictureKey(design: Design, name: string): string | null {
  if (pictureViews.has(name)) {
    return name
  }
  return Object.values(design.steps).find((step) => step.idName === name)?.id ?? null
}

// The design's open comment threads as design.md lists them ("Open questions"), oldest first, as
// the browser's export makes them.
export function openQuestionsOf(designId: string): OpenQuestion[] {
  return readThreads(designId)
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

export interface DesignMdOptions {
  // Where the pictures are: `<url>/<name>.<language>.png<query>`; `cacheKey` stands for both in
  // the kept files. `note` is the summary's line when the cache has this document's pictures (none
  // by default; the MCP connector names its tool).
  pictures: { url: string; query: string; cacheKey: string; note?: string }
  // The open comment threads listed as "Open questions".
  openQuestions: readonly OpenQuestion[]
}

// design.md, with its pictures when the picture cache has them for this document: none when it is
// empty or newer (a version asked for), with a line that says so; a line with their doc_version
// and time when they are older.
export function designMd(exp: DesignExport, langs: readonly Lang[] | undefined, options: DesignMdOptions): string {
  const { pictures, openQuestions } = options
  const set = pictureSet(exp.designId)
  const usable = set !== null && set.docVersion <= exp.docVersion
  const setKey = set === null ? '' : `${String(set.docVersion)}:${String(set.createdAt)}`
  const questionsKey =
    openQuestions.length === 0 ? '' : createHash('sha256').update(JSON.stringify(openQuestions)).digest('hex')
  return file(exp, `md:${langs?.join(',') ?? ''}:${pictures.cacheKey}:${setKey}:${questionsKey}`, () => {
    let note: string | null = 'Pictures: export from xDesign to get them'
    if (usable && set.docVersion < exp.docVersion) {
      note = `Pictures are from version ${String(set.docVersion)} (${new Date(set.createdAt).toISOString()}); the design changed since`
    } else if (usable) {
      note = pictures.note ?? null
    }
    return toMarkdown(exp.design, {
      ...(langs === undefined ? {} : { languages: langs }),
      checks: exp.issues,
      ...(usable && {
        pictures: (name: string, lang: Lang) => {
          const key = pictureKey(exp.design, name)
          return key !== null && set.has(key, lang) ? `${pictures.url}/${name}.${lang}.png${pictures.query}` : null
        },
      }),
      picturesNote: note,
      exportedAt: exp.exportedAt,
      version: exp.docVersion,
      versionName: exp.versionName,
      mediaFile: mediaFileOf(exp.design),
      openQuestions,
    })
  })
}
