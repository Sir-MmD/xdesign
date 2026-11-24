// A design's live document opened once, outside the editor (docs/plan/06 sections 1, 5 and 6):
// the export of a design card and the printable page read it, and an import sets its uploaded
// files' server IDs in it. It is the editor's connection (Hocuspocus at /live, the document
// `design:<id>`, the session cookie), without presence, closed as soon as the work is done.
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

import { socketUrl } from '@/lib/base'

// How long the document may take to load, or a change to reach the server.
const timeoutMs = 30_000

const messages = {
  timeout: 'The design could not be loaded. Check your connection and try again.',
  unsaved: 'The changes could not be saved. Check your connection and try again.',
  // The server's refusals (src/live/access.ts on the server).
  not_signed_in: 'Sign in to continue.',
  no_access: 'You do not have access to this design.',
  busy: 'The server is busy. Try again in a moment.',
}

export interface LiveDoc {
  doc: Y.Doc
  /** Resolves once every change made to `doc` has reached the server. */
  saved: () => Promise<void>
  close: () => void
}

function refusal(reason: string): string {
  return reason === 'not_signed_in' || reason === 'no_access' || reason === 'busy'
    ? messages[reason]
    : messages.no_access
}

function waitSaved(provider: HocuspocusProvider): Promise<void> {
  provider.flushPendingUpdates()
  return new Promise((resolve, reject) => {
    if (!provider.hasUnsyncedChanges) {
      resolve()
      return
    }
    const check = () => {
      if (provider.hasUnsyncedChanges) return
      clearTimeout(timer)
      provider.off('unsyncedChanges', check)
      resolve()
    }
    const timer = setTimeout(() => {
      provider.off('unsyncedChanges', check)
      reject(new Error(messages.unsaved))
    }, timeoutMs)
    provider.on('unsyncedChanges', check)
  })
}

/** Opens a design's live document and resolves once it holds the server's state. */
export function openLiveDoc(designId: string): Promise<LiveDoc> {
  const doc = new Y.Doc()
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (message: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      provider.destroy()
      doc.destroy()
      reject(new Error(message))
    }
    const provider = new HocuspocusProvider({
      url: socketUrl('/live'),
      name: `design:${designId}`,
      document: doc,
      awareness: null,
      onSynced: ({ state }) => {
        if (!state || settled) return
        settled = true
        clearTimeout(timer)
        resolve({
          doc,
          saved: () => waitSaved(provider),
          close: () => {
            provider.destroy()
            doc.destroy()
          },
        })
      },
      onAuthenticationFailed: ({ reason }) => {
        fail(refusal(reason))
      },
    })
    const timer = setTimeout(() => {
      fail(messages.timeout)
    }, timeoutMs)
  })
}
