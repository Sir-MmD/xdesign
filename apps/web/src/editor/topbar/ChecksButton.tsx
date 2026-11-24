import { CircleAlertIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useCheckCount } from '../checks'
import { ChecksPanel } from '../checks/ChecksPanel'

/**
 * "Checks" with the count of errors and warnings that are not ignored (04 sections 4.1 and 9),
 * from the live design's checks (checks.ts); it opens the Checks panel.
 */
export function ChecksButton() {
  const { errors, warnings } = useCheckCount()
  const [open, setOpen] = useState(false)
  const count = errors + warnings
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        <CircleAlertIcon aria-hidden data-icon="inline-start" className={cn(errors > 0 && 'text-error')} />
        Checks
        {count > 0 ? (
          <span
            className={cn(
              'inline-grid h-[18px] min-w-5 place-items-center rounded-full px-1.5 text-caption-2 leading-none font-semibold tabular-nums',
              errors > 0 ? 'bg-error-weak text-error' : 'bg-warn-weak text-warn',
            )}
          >
            {count}
          </span>
        ) : null}
      </Button>
      <ChecksPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
