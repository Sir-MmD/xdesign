import { DownloadIcon } from 'lucide-react'
import { type RefObject, useId, useState } from 'react'

import { downloadText, recoveryCodesFile } from '@/account/twoFactor'
import { CopyButton } from '@/components/CopyButton'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { siteUrl } from '@/lib/base'
import { formatDateTime } from '@/lib/time'

// Copied from xWriter's features/panel-settings/security/RecoveryCodesDialog.tsx.

export interface RecoveryCodesDialogProps {
  /** The new codes; the dialog is open while they are set. */
  codes: readonly string[] | undefined
  onDone: () => void
  /**
   * Where focus goes when the dialog closes (its first tabbable element). The dialog opens
   * from another dialog, whose controls are gone by then.
   */
  finalFocus?: RefObject<HTMLElement | null>
}

/**
 * The recovery codes, shown once (docs/plan/17 section 7): copy, download as a text file, and a
 * required "I saved these codes" before the dialog closes.
 */
export function RecoveryCodesDialog({ codes, onDone, finalFocus }: RecoveryCodesDialogProps) {
  return (
    <AlertDialog
      open={codes !== undefined}
      onOpenChange={() => {
        // Closing happens only through "Done", after the codes were saved.
      }}
    >
      <AlertDialogContent className="sm:max-w-md" finalFocus={finalFocus}>
        {codes ? <CodesBody codes={codes} onDone={onDone} /> : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CodesBody({ codes, onDone }: { codes: readonly string[]; onDone: () => void }) {
  const checkboxId = useId()
  const [saved, setSaved] = useState(false)
  const [createdAt] = useState(() => formatDateTime(Date.now()))

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Save your recovery codes</AlertDialogTitle>
        <AlertDialogDescription>
          If you lose your phone, each code signs you in once instead of a code from the app. They are shown only now.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <ol
        dir="ltr"
        className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border bg-surface-2 p-3 font-mono text-callout min-[420px]:grid-cols-2"
      >
        {codes.map((code) => (
          <li key={code} className="tabular-nums">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={codes.join('\n')} label="Copy codes" showLabel />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            downloadText('xdesign-recovery-codes.txt', recoveryCodesFile(codes, siteUrl('/'), createdAt))
          }}
        >
          <DownloadIcon aria-hidden />
          Download
        </Button>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id={checkboxId}
          checked={saved}
          onCheckedChange={(checked) => {
            setSaved(checked)
          }}
        />
        <Label htmlFor={checkboxId} className="leading-snug font-normal">
          I saved these codes
        </Label>
      </div>
      <AlertDialogFooter>
        <Button type="button" disabled={!saved} onClick={onDone}>
          Done
        </Button>
      </AlertDialogFooter>
    </>
  )
}
