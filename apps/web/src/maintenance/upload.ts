// "Upload and check" (docs/plan/07 section 6.2 step 1): the chosen files go up as one multipart
// form (`files`, xWriter's upload protocol), which the app streams to the helper; the answer is
// the helper's check. XMLHttpRequest instead of fetch, for the upload's progress.
import { routes, type UpdateCheck, updateCheck } from '@xdesign/api'
import { z } from 'zod'

import { ApiError, NETWORK_ERROR, routeUrl } from '@/api/client'

/** What a chosen file is: the xdesign file (or a packed file holding it), SHA256SUMS or its signature. */
export type FileRole = 'build' | 'sums' | 'signature'

export function fileRole(file: File): FileRole {
  if (file.name === 'SHA256SUMS' || file.name.endsWith('.sha256')) return 'sums'
  if (file.name.endsWith('.sig')) return 'signature'
  return 'build'
}

export const fileRoleNames: Readonly<Record<FileRole, string>> = {
  build: 'The new xDesign',
  sums: 'Checksums',
  signature: 'Signature of the checksums',
}

/** Why the chosen files cannot go up as they are, or undefined. */
export function filesProblem(files: readonly File[]): string | undefined {
  const count = (role: FileRole) => files.filter((file) => fileRole(file) === role).length
  if (count('build') !== 1 || count('sums') > 1 || count('signature') > 1) {
    return 'Choose one xdesign file, with SHA256SUMS and SHA256SUMS.sig if you have them.'
  }
  return undefined
}

const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

export interface UploadProgress {
  loaded: number
  total: number
}

/** Sends the files and resolves with the check; `abort` stops the upload. */
export function sendUpdate(
  files: readonly File[],
  onProgress: (progress: UploadProgress) => void,
): { done: Promise<UpdateCheck>; abort: () => void } {
  const xhr = new XMLHttpRequest()
  const done = new Promise<UpdateCheck>((resolve, reject) => {
    const form = new FormData()
    for (const file of files) form.append('files', file, file.name)
    xhr.open('POST', routeUrl(routes.uploadUpdate))
    xhr.upload.onprogress = (event) => {
      onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 })
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
        const answer = updateCheck.safeParse(json)
        if (answer.success) resolve(answer.data)
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
