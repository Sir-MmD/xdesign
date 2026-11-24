import { createFileRoute, Outlet } from '@tanstack/react-router'
import { routes } from '@xdesign/api'

import { useApi } from '@/api/client'
import { requireMember, SessionContext } from '@/app/session'
import { useSavedTheme } from '@/app/theme'

// The editor's signed-in layout (docs/plan/04 section 4): the same guard as the site's pages
// (routes/_app.tsx), without the site's top bar, as the editor has its own.
export const Route = createFileRoute('/_editor')({
  beforeLoad: async ({ context, location }) => {
    await requireMember(context.queryClient, location.href)
  },
  component: EditorLayout,
})

function EditorLayout() {
  const me = useApi(routes.me)
  useSavedTheme(me.data?.user.theme)
  // The guard put the session into the cache; it is gone only while signing out.
  if (!me.data) return null
  return (
    <SessionContext value={me.data.user}>
      <Outlet />
    </SessionContext>
  )
}
