import { createFileRoute, Link } from '@tanstack/react-router'

import { requireRoute } from '@/app/session'
import { AuthCard, AuthFrame } from '@/auth/AuthFrame'
import { Button } from '@/components/ui/button'

// An old invite link (docs/plan/18 section 3.4): invites are gone (USER-01a), the site owner adds
// members with their username and password, so the page only says so, with "Go to sign in".
export const Route = createFileRoute('/invite/$token')({
  // Not in the desktop app, which has no sign-in (DESK-03): there it goes to Designs.
  beforeLoad: async ({ context }) => {
    await requireRoute(context.queryClient, 'signIn')
  },
  component: Invite,
})

function Invite() {
  return (
    <AuthFrame>
      <AuthCard
        title="Invite link"
        lead="Invite links no longer work. Ask the site owner for an account."
        titleId="invite-title"
      >
        <Button size="lg" className="w-full" nativeButton={false} render={<Link to="/sign-in" replace />}>
          Go to sign in
        </Button>
      </AuthCard>
    </AuthFrame>
  )
}
