import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { Editor } from '@/editor/Editor'

// The editor of a design (docs/plan/04 section 4), under its own signed-in layout without the
// site's top bar. The tab is the page's `tab` search (none for the Map), so a link or a reload
// keeps it; `comment` (the bell's link, CMT-02) opens the Comments panel on a thread, then leaves
// the address.
const searchSchema = z.object({
  tab: z.enum(['setup', 'texts']).optional().catch(undefined),
  comment: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_editor/d/$id')({
  validateSearch: searchSchema,
  component: EditorPage,
})

function EditorPage() {
  const { id } = Route.useParams()
  const { tab, comment } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    // A new document, connection and selection for another design.
    <Editor
      key={id}
      designId={id}
      tab={tab ?? 'map'}
      onTab={(next) => {
        void navigate({ search: next === 'map' ? {} : { tab: next }, replace: true })
      }}
      comment={comment}
      onCommentShown={() => {
        void navigate({ search: (now) => ({ ...now, comment: undefined }), replace: true })
      }}
    />
  )
}
