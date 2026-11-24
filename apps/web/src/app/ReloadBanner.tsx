import { useQuery } from '@tanstack/react-query'
import { routes } from '@xdesign/api'
import { RefreshCwIcon } from 'lucide-react'
import { useEffect } from 'react'

import { apiQuery } from '@/api/client'
import { noteServerVersion, useOutdated } from '@/app/serverVersion'
import { Button } from '@/components/ui/button'

// How often an open tab asks `/api/health` which version runs (and when it gets the focus back).
const pollMs = 60_000

/**
 * "xDesign was updated. Reload to use the new version." (docs/plan/07 section 6.2 step 4) on every
 * page, signed in or not, once the server runs another version than the one this tab loaded.
 */
export function ReloadBanner() {
  const health = useQuery({ ...apiQuery(routes.health), refetchInterval: pollMs, retry: false })
  const version = health.data?.version
  useEffect(() => {
    if (version !== undefined) noteServerVersion(version)
  }, [version])
  if (!useOutdated()) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-(--z-toast) mx-auto mb-[max(12px,env(safe-area-inset-bottom,0px))] flex w-fit max-w-[calc(100%-32px)] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-2.5 text-subhead shadow-lg"
    >
      <span>xDesign was updated. Reload to use the new version.</span>
      <Button
        size="sm"
        onClick={() => {
          window.location.reload()
        }}
      >
        <RefreshCwIcon aria-hidden />
        Reload
      </Button>
    </div>
  )
}
