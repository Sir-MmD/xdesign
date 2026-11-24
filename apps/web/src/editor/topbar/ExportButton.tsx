import { DownloadIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/export/ExportDialog'

import { useDesign, useEditor } from '../context'
import { useHistory } from '../history/store'
import { useLook } from '../look'

/**
 * "Export" (04 section 4.1, 06): EXP-02's export dialog on the live document, in the phone's look.
 * The page of a view-only link (VIEW-01) passes the design's document version it read. While a
 * version from history is open (HIST-02), the dialog starts on that version.
 */
export function ExportButton({ docVersion }: { docVersion?: number }) {
  const { designId, live } = useEditor()
  const { name } = useDesign()
  const [look] = useLook()
  const viewed = useHistory((state) => state.viewed?.version.id)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        <DownloadIcon aria-hidden data-icon="inline-start" />
        Export
      </Button>
      <ExportDialog
        design={open ? { id: designId, name, docVersion, version: viewed } : undefined}
        onOpenChange={setOpen}
        doc={live.doc}
        look={look}
      />
    </>
  )
}
