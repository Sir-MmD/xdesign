import { useNavigate } from '@tanstack/react-router'
import { check, mediaFiles, specChecks, toSpec } from '@xdesign/spec'
import { DownloadIcon } from 'lucide-react'

import { webVersion } from '@/app/version'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { download, zipName } from '@/export/exportZip'

import type { LiveState } from './live'

/**
 * The design was deleted or the person lost access while their browser held it (05 section 3
 * item 4): changes made offline may never have reached the server, so the editor offers them as
 * a `spec.json` (an xDesign export of the browser's copy, without the uploaded files) before
 * going back to Designs. Import on Designs makes a new design from it.
 */
export function LostAccess({ state }: { state: LiveState }) {
  const navigate = useNavigate()
  const { end, design } = state
  if (end?.kind !== 'noAccess' || !design) return null

  const save = () => {
    const now = new Date()
    const files = mediaFiles(design)
    const spec = toSpec(design, {
      exportedBy: `xDesign ${webVersion}`,
      exportedAt: now.toISOString(),
      docVersion: 0,
      mediaFile: (item) => files.get(item.id) ?? `media/${item.id}`,
      checks: specChecks(check(design)),
    })
    const name = zipName(design, now).replace(/\.xdesign\.zip$/, '-offline.spec.json')
    download(name, new TextEncoder().encode(`${JSON.stringify(spec, null, 2)}\n`), 'application/json')
  }

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{end.message}</AlertDialogTitle>
          <AlertDialogDescription>
            Changes you made while offline may not have reached the server. Download them to keep them:
            &quot;Import&quot; on Designs makes a new design from the file.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              void navigate({ to: '/', replace: true })
            }}
          >
            Go to Designs
          </Button>
          <Button onClick={save}>
            <DownloadIcon aria-hidden data-icon="inline-start" />
            Download my offline changes
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
