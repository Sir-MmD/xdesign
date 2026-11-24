import { type Design, readDesign } from '@xdesign/spec'
import { useEffect, useState } from 'react'
import type * as Y from 'yjs'

import { openLiveDoc } from '@/export/liveDoc'

export type DesignOnce = { design: Design; error?: undefined } | { design?: undefined; error?: string | undefined }

function read(doc: Y.Doc): DesignOnce {
  try {
    return { design: readDesign(doc) }
  } catch {
    return { error: 'This design could not be read. Reload the page and try again.' }
  }
}

/**
 * A design as it is now, for the export and the printable page: read from the editor's document
 * when there is one, else from the design's live document, opened once and closed again.
 */
export function useDesignOnce(designId: string, doc?: Y.Doc): DesignOnce {
  const [state, setState] = useState<DesignOnce>(() => (doc ? read(doc) : {}))
  useEffect(() => {
    if (doc) return
    let gone = false
    openLiveDoc(designId).then(
      (live) => {
        if (!gone) setState(read(live.doc))
        live.close()
      },
      (error: unknown) => {
        if (!gone) setState({ error: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => {
      gone = true
    }
  }, [designId, doc])
  return state
}
