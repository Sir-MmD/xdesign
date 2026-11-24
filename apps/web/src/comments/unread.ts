// The person's unread comments (CMT-01's `GET /api/comments/unread`, docs/plan/05 section 6): the
// bell in the site's and the editor's top bars and the Designs cards read the same answer. It is
// read again every minute and when the window gets the focus; an open editor also reads it again
// at each `commentsChanged` notice and after the Comments panel marks the design read.
import { routes } from '@xdesign/api'

import { useApi } from '@/api/client'

const everyMs = 60_000

export function useUnread() {
  return useApi(routes.unreadComments, undefined, { refetchInterval: everyMs })
}
