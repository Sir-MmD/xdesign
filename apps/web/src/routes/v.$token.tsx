import { createFileRoute } from '@tanstack/react-router'

import { setViewToken } from '@/api/media'
import { requireRoute } from '@/app/session'
import { ViewPage } from '@/view/ViewPage'

// The page of a view-only link (docs/plan/05 section 8, 04 section 15), outside the signed-in
// layouts: no account needed. While it is open, the design's media files carry the link's token.
export const Route = createFileRoute('/v/$token')({
  beforeLoad: async ({ context, params }) => {
    // Not in the desktop app, which has no view-only links (DESK-03): there it goes to Designs.
    await requireRoute(context.queryClient, 'viewLinkDesign')
    setViewToken(params.token)
  },
  onLeave: () => {
    setViewToken(undefined)
  },
  component: View,
})

function View() {
  const { token } = Route.useParams()
  // A new header, document and connection for another link.
  return <ViewPage key={token} token={token} />
}
