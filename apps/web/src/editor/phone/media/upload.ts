// "Upload a file" (docs/plan/04 section 5.4, MEDIA-01's route): the browser reads a picture's or a
// video's sides and a video's or a sound's length, then the file goes up as a multipart form
// with its kind; the server checks the type and the size from the content and answers its row
// or a plain message. XMLHttpRequest instead of fetch, for the upload's progress.
import { media, routes, type UploadKind } from '@xdesign/api'
import type { MediaItem, MediaKind } from '@xdesign/spec'
import { z } from 'zod'

import { ApiError, NETWORK_ERROR, routeUrl } from '@/api/client'

/** The file types each kind takes (MEDIA-01's list), for the file picker; the server checks again. */
const accepted: Readonly<Record<UploadKind, string>> = {
  photo: 'image/jpeg,image/png,image/webp',
  livePhoto: 'video/mp4,video/quicktime,image/jpeg,image/png,image/webp',
  video: 'video/mp4',
  animation: 'image/gif,video/mp4',
  audio: 'audio/mpeg,audio/mp4,.mp3,.m4a',
  voice: 'audio/ogg,audio/mpeg,audio/mp4,.ogg,.oga,.opus,.mp3,.m4a',
  document: '',
  videoNote: 'video/mp4',
  sticker: 'image/webp,video/webm,.tgs',
  botPhoto: 'image/jpeg,video/mp4',
}

/** The picker's `accept` for files of these kinds (every file when one of them is a file). */
export function acceptFor(kinds: readonly UploadKind[]): string | undefined {
  if (kinds.includes('document')) return undefined
  return kinds.map((kind) => accepted[kind]).join(',')
}

/** Whether a design's file can be used as an upload kind that takes only some types (`botPhoto`). */
export function takesFile(kind: UploadKind, item: MediaItem): boolean {
  return accepted[kind].split(',').includes(item.mime)
}

/** The kind a file goes up as when it may be one of several (an album's item). */
export function kindOfFile(file: File, kinds: readonly MediaKind[]): MediaKind | undefined {
  const guess: MediaKind = file.type.startsWith('image/')
    ? 'photo'
    : file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'document'
  if (kinds.includes(guess)) return guess
  return kinds.includes('document') ? 'document' : undefined
}

export interface Probe {
  width?: number
  height?: number
  durationMs?: number
}

const probeTime = 5000

/**
 * The sides of a picture or a video and the length of a video or a sound, as the browser reads
 * them; nothing for other files or when the browser cannot read it within 5 seconds.
 */
export function probeFile(file: File): Promise<Probe> {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  if (!isImage && !isVideo && !file.type.startsWith('audio/')) return Promise.resolve({})
  const url = URL.createObjectURL(file)
  return new Promise<Probe>((resolve) => {
    const element = isImage ? new Image() : document.createElement(isVideo ? 'video' : 'audio')
    const done = (probe: Probe) => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(probe)
    }
    const timer = setTimeout(() => {
      done({})
    }, probeTime)
    element.onerror = () => {
      done({})
    }
    if (element instanceof HTMLImageElement) {
      element.onload = () => {
        done(sides(element.naturalWidth, element.naturalHeight))
      }
    } else {
      element.preload = 'metadata'
      element.onloadedmetadata = () => {
        const length = Number.isFinite(element.duration) ? { durationMs: Math.round(element.duration * 1000) } : {}
        const shape = element instanceof HTMLVideoElement ? sides(element.videoWidth, element.videoHeight) : {}
        done({ ...shape, ...length })
      }
    }
    element.src = url
  })
}

function sides(width: number, height: number): Probe {
  return width > 0 && height > 0 ? { width, height } : {}
}

const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
const answerBody = z.object({ media })

/** The server's row of an uploaded file. */
export type MediaRow = z.output<typeof media>

/** Sends a file for a design as the kind and resolves with its row; `abort` stops the upload. */
export function sendMedia(
  designId: string,
  kind: UploadKind,
  file: File,
  probe: Probe,
  onProgress: (part: number) => void,
): { done: Promise<MediaRow>; abort: () => void } {
  const xhr = new XMLHttpRequest()
  const done = new Promise<MediaRow>((resolve, reject) => {
    const form = new FormData()
    form.append('kind', kind)
    for (const [name, value] of Object.entries(probe)) {
      if (typeof value === 'number') form.append(name, String(value))
    }
    form.append('file', file, file.name)
    xhr.open('POST', routeUrl(routes.uploadMedia, { params: { id: designId } }))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
    }
    xhr.onerror = () => {
      reject(new ApiError(0, NETWORK_ERROR, 'The upload was cut off. Check your connection and try again.'))
    }
    xhr.onabort = () => {
      reject(new ApiError(0, 'aborted', 'The upload was stopped.'))
    }
    xhr.onload = () => {
      let json: unknown
      try {
        json = JSON.parse(xhr.responseText)
      } catch {
        json = undefined
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const answer = answerBody.safeParse(json)
        if (answer.success) resolve(answer.data.media)
        else
          reject(new ApiError(xhr.status, 'server_error', 'The server sent an answer this page does not understand.'))
        return
      }
      const failure = errorBody.safeParse(json)
      reject(
        failure.success
          ? new ApiError(xhr.status, failure.data.error.code, failure.data.error.message)
          : new ApiError(xhr.status, 'server_error', 'Something went wrong on the server. Try again.'),
      )
    }
    xhr.send(form)
  })
  return {
    done,
    abort: () => {
      xhr.abort()
    },
  }
}
