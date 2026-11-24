// The picture cache (docs/plan/06 section 7.4): the pictures of a design's last browser export
// (its default language in the chosen look), for the Claude link and the MCP connector. Each is a
// media row of the kind `picture` (its file kept by SHA-256 as every upload) with a `pictures`
// row naming its step and language. A new upload replaces the design's whole set; deleting the
// design forever deletes both rows (foreign keys) and the files (deleteForever).
import { open } from 'node:fs/promises'

import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { getDb } from '../db/index.ts'
import { designs, media, pictures } from '../db/schema.ts'
import { removeUnusedFiles } from '../designs/trash.ts'
import { ApiError } from '../errors.ts'
import { detectType, headBytes } from '../media/detect.ts'
import { readImageSize, type ImageSize } from '../media/image.ts'
import { keepTemp, mediaPath, type TempFile } from '../media/store.ts'

// The media kind of a cached picture; the upload route never makes it.
export const pictureKind = 'picture'

// The Bot setup views with pictures; every other picture is a step's (by its ID).
export const pictureViews: ReadonlySet<string> = new Set(['bot-profile', 'empty-chat', 'commands-menu'])

// The design's cached pictures, all of one upload.
export interface PictureSet {
  docVersion: number
  createdAt: number
  look: string
  has: (key: string, lang: string) => boolean
}

export function pictureSet(designId: string): PictureSet | null {
  const rows = getDb()
    .select({
      stepId: pictures.stepId,
      language: pictures.language,
      look: pictures.look,
      docVersion: pictures.docVersion,
      createdAt: pictures.createdAt,
    })
    .from(pictures)
    .where(eq(pictures.designId, designId))
    .all()
  const [first] = rows
  if (!first) {
    return null
  }
  const keys = new Set(rows.map((row) => `${row.stepId}.${row.language}`))
  return {
    docVersion: first.docVersion,
    createdAt: first.createdAt,
    look: first.look,
    has: (key, lang) => keys.has(`${key}.${lang}`),
  }
}

export interface CachedPicture {
  path: string
  bytes: number
  docVersion: number
}

// The file of a step's (or view's) picture in a language, or null when the cache has none.
export function findPicture(designId: string, key: string, lang: string): CachedPicture | null {
  const row = getDb()
    .select({ sha256: media.sha256, bytes: media.bytes, docVersion: pictures.docVersion })
    .from(pictures)
    .innerJoin(media, eq(media.id, pictures.mediaId))
    .where(and(eq(pictures.designId, designId), eq(pictures.stepId, key), eq(pictures.language, lang)))
    .get()
  return row ? { path: mediaPath(row.sha256), bytes: row.bytes, docVersion: row.docVersion } : null
}

export interface NewPicture {
  // The step's ID or a view of pictureViews.
  key: string
  file: TempFile
}

export interface PictureUpload {
  docVersion: number
  language: string
  look: string
}

// Refuses a file that is not a PNG; the sides of one that is.
async function checkPng(file: TempFile): Promise<ImageSize | null> {
  const handle = await open(file.path)
  try {
    const head = Buffer.alloc(Math.min(headBytes, file.bytes))
    await handle.read(head, 0, head.length, 0)
    const type = detectType(head)
    if (type !== 'image/png') {
      throw new ApiError('bad_request', 'A picture is not a PNG file.')
    }
    return await readImageSize(handle, type, head)
  } finally {
    await handle.close()
  }
}

// Replaces the design's pictures with these (the caller removes the temporary files after) and
// returns how many were kept. The files of the old set that nothing else uses are removed.
export async function replacePictures(
  designId: string,
  upload: PictureUpload,
  files: readonly NewPicture[],
  userId: string,
): Promise<number> {
  const sides = new Map<NewPicture, ImageSize | null>()
  for (const picture of files) {
    if (picture.file.bytes === 0) {
      throw new ApiError('bad_request', 'A picture is empty.')
    }
    sides.set(picture, await checkPng(picture.file))
  }
  for (const picture of files) {
    await keepTemp(picture.file)
  }
  const db = getDb()
  const now = Date.now()
  const replace = () => {
    const design = db.select({ deletedAt: designs.deletedAt }).from(designs).where(eq(designs.id, designId)).get()
    if (!design || design.deletedAt !== null) {
      throw new ApiError('not_found', 'This design was not found.')
    }
    const old = db
      .select({ mediaId: pictures.mediaId, sha256: media.sha256 })
      .from(pictures)
      .innerJoin(media, eq(media.id, pictures.mediaId))
      .where(eq(pictures.designId, designId))
      .all()
    if (old.length > 0) {
      // The pictures rows go with their media rows.
      db.delete(media)
        .where(
          inArray(
            media.id,
            old.map((row) => row.mediaId),
          ),
        )
        .run()
    }
    for (const picture of files) {
      const mediaId = nanoid()
      db.insert(media)
        .values({
          id: mediaId,
          designId,
          sha256: picture.file.sha256,
          kind: pictureKind,
          mime: 'image/png',
          bytes: picture.file.bytes,
          width: sides.get(picture)?.width ?? null,
          height: sides.get(picture)?.height ?? null,
          durationMs: null,
          originalName: `${picture.key}.${upload.language}.png`,
          uploadedBy: userId,
          uploadedAt: now,
        })
        .run()
      db.insert(pictures)
        .values({
          designId,
          stepId: picture.key,
          language: upload.language,
          look: upload.look,
          docVersion: upload.docVersion,
          mediaId,
          createdAt: now,
        })
        .run()
    }
    return old.map((row) => row.sha256)
  }
  let oldHashes: string[]
  try {
    oldHashes = db.transaction(replace)
  } catch (error) {
    // The files just kept that no row uses (the design went meanwhile).
    removeUnusedFiles(files.map((picture) => picture.file.sha256))
    throw error
  }
  removeUnusedFiles(oldHashes)
  return files.length
}
