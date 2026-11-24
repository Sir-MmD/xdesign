// Try it's keys (docs/plan/04 section 14, listed in shortcuts.ts): Ctrl+Enter (Cmd on a Mac) tries
// the bot from the selected step, or opens Try it on the empty chat with none selected; Esc leaves
// Try it unless a field or a popover took the key.
import { useEffect, useEffectEvent } from 'react'

import { useDesign, useLang } from '../context'
import { useSelectionStore } from '../selection'
import { inField } from '../shortcuts'
import { useTryStore } from './store'

export function useTryKeys(): void {
  const design = useDesign()
  const lang = useLang()
  const selection = useSelectionStore()
  const store = useTryStore()
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      if (inField(event)) return
      event.preventDefault()
      store.open(design, lang, selection.get().step ?? undefined)
    } else if (event.key === 'Escape' && store.get().open && !event.defaultPrevented && !inField(event)) {
      if (!inPopup(event)) store.stop()
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}

// A menu, a list of a select, a dialog or a sheet has the focus: its own Esc closes it.
function inPopup(event: Event): boolean {
  const target = event.composedPath()[0] ?? event.target
  return target instanceof Element && target.closest('[role="menu"], [role="listbox"], [role="dialog"]') !== null
}

/** Listens for Try it's keys inside the editor's providers (Editor.tsx renders it). */
export function TryKeys() {
  useTryKeys()
  return null
}
