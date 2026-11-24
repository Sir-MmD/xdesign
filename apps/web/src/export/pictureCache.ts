// The picture cache of the Claude link and MCP (docs/plan/06 section 7.4): the default language's
// pictures in a look, sent to the server (CL-01's `POST /api/designs/:id/pictures`, which replaces
// the design's set) with the document version they show. A browser export sends the ones it made
// for its zip; "Refresh pictures for Claude" in a design's menu makes them alone, without a zip.
import { routes } from '@xdesign/api'
import { type Design, readDesign } from '@xdesign/spec'
import { toast } from 'sonner'
import type * as Y from 'yjs'

import { ApiError, call, NETWORK_ERROR, routeUrl } from '@/api/client'
import { openLiveDoc } from '@/export/liveDoc'
import { makePictures, picturePath, type PictureLook, picturesOf } from '@/export/pictures'

export interface CacheOptions {
  /** The design's document version the pictures show. */
  docVersion: number
  look: PictureLook
  signal?: AbortSignal | undefined
}

/**
 * Sends the default language's pictures among `made` (by their paths, as makePictures gives them)
 * as the design's picture cache, each named by its step's ID or its Bot setup view; nothing is
 * sent when there are none. Returns how many the server kept.
 */
export async function uploadPictures(
  designId: string,
  design: Design,
  made: ReadonlyMap<string, Blob>,
  options: CacheOptions,
): Promise<number> {
  const lang = design.languages.default
  const form = new FormData()
  form.set('docVersion', String(options.docVersion))
  form.set('language', lang)
  form.set('look', `${options.look.skin}-${options.look.theme}`)
  let count = 0
  for (const picture of picturesOf(design, [lang])) {
    const png = made.get(picturePath(picture.name, lang))
    if (!png) continue
    form.set(picture.kind === 'step' ? picture.stepId : picture.kind, png, `${picture.name}.${lang}.png`)
    count += 1
  }
  if (count === 0) return 0
  let response: Response
  try {
    response = await fetch(routeUrl(routes.uploadPictures, { params: { id: designId } }), {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
      signal: options.signal ?? null,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, NETWORK_ERROR, 'The server could not be reached. Check your connection and try again.')
  }
  const json: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = (json as { error?: { message?: unknown } } | undefined)?.error?.message
    throw new ApiError(response.status, 'upload_failed', typeof message === 'string' ? message : 'The upload failed.')
  }
  const answer = routes.uploadPictures.response.safeParse(json)
  if (!answer.success) throw new ApiError(response.status, 'server_error', 'The upload failed.')
  return answer.data.pictures
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** After a browser export: sends its pictures in the background; only a failure shows (a toast). */
export function cachePictures(
  designId: string,
  design: Design,
  made: ReadonlyMap<string, Blob>,
  options: CacheOptions,
): void {
  uploadPictures(designId, design, made, options).catch((error: unknown) => {
    toast.error(`The pictures for Claude were not uploaded. ${messageOf(error)}`)
  })
}

/** The design as it is now, from the editor's document or the design's live document opened once. */
async function designNow(designId: string, doc: Y.Doc | undefined): Promise<Design> {
  const unread = 'This design could not be read. Reload the page and try again.'
  if (doc) {
    try {
      return readDesign(doc)
    } catch {
      throw new Error(unread)
    }
  }
  const live = await openLiveDoc(designId)
  try {
    return readDesign(live.doc)
  } catch {
    throw new Error(unread)
  } finally {
    live.close()
  }
}

// The designs whose pictures are being refreshed in this tab.
const refreshing = new Set<string>()

/**
 * "Refresh pictures for Claude" (06 section 7.4): makes the default language's pictures of the
 * design as it is now in the look and sends them, with a toast that counts the pictures, has
 * "Cancel" and then says how it went. The document version is read before the design, so the
 * pictures are never older than the version they name. Once per design at a time.
 */
export function refreshPictures(
  design: { id: string; name: string },
  options: { look: PictureLook; doc?: Y.Doc | undefined },
): void {
  if (refreshing.has(design.id)) return
  refreshing.add(design.id)
  const controller = new AbortController()
  const { signal } = controller
  const toastId = `refresh-pictures-${design.id}`
  // A picture still being made after "Cancel" (which closes the toast) does not show it again.
  const show = (text: string) => {
    if (signal.aborted) return
    toast.loading(text, {
      id: toastId,
      cancel: {
        label: 'Cancel',
        onClick: () => {
          controller.abort()
        },
      },
    })
  }
  const run = async () => {
    show('Making pictures for Claude')
    const { design: header } = await call(routes.design, { params: { id: design.id } }, { signal })
    const shown = await designNow(design.id, options.doc)
    signal.throwIfAborted()
    const lang = shown.languages.default
    const made = await makePictures(shown, picturesOf(shown, [lang]), {
      look: options.look,
      date: new Date().toISOString(),
      signal,
      onProgress: (done, total) => {
        show(`Making pictures ${String(done)} of ${String(total)}`)
      },
    })
    show('Uploading the pictures for Claude')
    await uploadPictures(design.id, shown, made, { docVersion: header.docVersion, look: options.look, signal })
  }
  void run()
    .then(
      () => {
        toast.dismiss(toastId)
        toast.success(`Refreshed the pictures of ${design.name} for Claude.`)
      },
      (error: unknown) => {
        toast.dismiss(toastId)
        if (!signal.aborted) toast.error(`The pictures for Claude were not refreshed. ${messageOf(error)}`)
      },
    )
    .finally(() => {
      refreshing.delete(design.id)
    })
}
