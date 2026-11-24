import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

import { ReloadBanner } from '@/app/ReloadBanner'
import { Toaster } from '@/components/ui/sonner'
import { useMediaQuery } from '@/lib/useMediaQuery'

export interface RouterContext {
  queryClient: QueryClient
}

// Every page, signed in or not, with the toasts (at the bottom end from 760 px, at the top on
// phones, as in xWriter's panel) and the reload banner after an update.
export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
})

function Root() {
  const wide = useMediaQuery('(min-width: 760px)')
  return (
    <>
      <Outlet />
      <ReloadBanner />
      <Toaster position={wide ? 'bottom-right' : 'top-center'} closeButton />
    </>
  )
}
