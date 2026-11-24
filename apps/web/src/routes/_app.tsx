import { createFileRoute, Outlet } from '@tanstack/react-router'
import { routes } from '@xdesign/api'

import { useApi } from '@/api/client'
import { AppShell } from '@/app/AppShell'
import { SessionContext, signedInGuard } from '@/app/session'
import { useSavedTheme } from '@/app/theme'

// The signed-in layout (docs/plan/04 section 1): the shell around every page of a member. Its
// guard loads the session (`GET /api/me`) and sends to the sign-in page without one, with the
// page to come back to.
export const Route = createFileRoute('/_app')({
  beforeLoad: signedInGuard,
  component: SignedInLayout,
})

function SignedInLayout() {
  const me = useApi(routes.me)
  useSavedTheme(me.data?.user.theme)
  // The guard put the session into the cache; it is gone only while signing out.
  if (!me.data) return null
  return (
    <SessionContext value={me.data.user}>
      <AppShell>
        <Outlet />
      </AppShell>
    </SessionContext>
  )
}
