// Comment mode's keys (docs/plan/04 sections 14 and 15, listed in shortcuts.ts): C turns it on and
// off for people who can comment, Esc leaves it unless a field or a popup took the key.
import { useEffect, useEffectEvent } from 'react'

import { inField } from '../shortcuts'
import { useCanComment, useCommentStore } from './store'

export function useCommentKeys(): void {
  const store = useCommentStore()
  const canComment = useCanComment()
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || inField(event)) return
    const { mode, panel } = store.get()
    if (event.key.toLowerCase() === 'c' && !event.shiftKey && canComment && !panel && !inPopup(event)) {
      event.preventDefault()
      store.set({ mode: !mode })
    } else if (event.key === 'Escape' && mode && !panel && !inPopup(event)) {
      store.set({ mode: false })
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}

// A menu, a list of a select, a dialog or a sheet has the focus: the key is its own.
function inPopup(event: Event): boolean {
  const target = event.composedPath()[0] ?? event.target
  return target instanceof Element && target.closest('[role="menu"], [role="listbox"], [role="dialog"]') !== null
}

/** Listens for comment mode's keys inside the editor's providers (Editor.tsx renders it). */
export function CommentKeys() {
  useCommentKeys()
  return null
}
