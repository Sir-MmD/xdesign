import { MessageSquarePlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useCanComment, useCommentStore, useComments } from '../comments/store'

/**
 * "Comment" (docs/plan/04 section 15): turns comment mode on and off (also the C key), for
 * Commenter and above. In comment mode a click on a box, a button's pill or the empty map, or on
 * the phone's bubble or a button, opens the Comments panel with a new thread there.
 */
export function CommentButton() {
  const store = useCommentStore()
  const mode = useComments((state) => state.mode)
  if (!useCanComment()) return null
  return (
    <Button
      variant={mode ? 'soft' : 'outline'}
      size="sm"
      aria-pressed={mode}
      title="Comment (C)"
      onClick={() => {
        store.set({ mode: !mode })
      }}
    >
      <MessageSquarePlusIcon aria-hidden data-icon="inline-start" />
      Comment
    </Button>
  )
}
