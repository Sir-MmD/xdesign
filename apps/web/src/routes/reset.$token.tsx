import { createFileRoute, Link } from '@tanstack/react-router'

import { requireRoute } from '@/app/session'
import { AuthCard, AuthFrame } from '@/auth/AuthFrame'
import { Button } from '@/components/ui/button'

// An old password reset link (docs/plan/18 section 3.4): reset links are gone (USER-01a), the site
// owner sets a new password, so the page only says so, with "Go to sign in".
export const Route = createFileRoute('/reset/$token')({
  // Not in the desktop app, which has no sign-in (DESK-03): there it goes to Designs.
  beforeLoad: async ({ context }) => {
    await requireRoute(context.queryClient, 'signIn')
  },
  component: Reset,
})

function Reset() {
  return (
    <AuthFrame>
      <AuthCard
        title="Password reset link"
        lead="Password reset links no longer work. Ask the site owner to set a new password."
        titleId="reset-title"
      >
        <Button size="lg" className="w-full" nativeButton={false} render={<Link to="/sign-in" replace />}>
          Go to sign in
        </Button>
      </AuthCard>
    </AuthFrame>
  )
}
