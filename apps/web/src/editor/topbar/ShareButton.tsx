import { UserPlusIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ShareDialog } from '@/designs/ShareDialog'

/** "Share" (05 section 4) with WEB-02's dialog; the top bar shows it to the design owner and the site owner. */
export function ShareButton({ id, name }: { id: string; name: string }) {
  const [sharing, setSharing] = useState<{ id: string; name: string }>()
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSharing({ id, name })
        }}
      >
        <UserPlusIcon aria-hidden data-icon="inline-start" />
        Share
      </Button>
      <ShareDialog
        design={sharing}
        onOpenChange={(open) => {
          if (!open) setSharing(undefined)
        }}
      />
    </>
  )
}
