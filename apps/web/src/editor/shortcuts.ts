// The editor's keyboard shortcuts (docs/plan/04 section 14): the list the "..." menu's "Keyboard
// shortcuts" shows, and undo and redo. Each task that adds a shortcut adds its line here (the
// map's keys are in map/keys.ts, Try it's Ctrl+Enter and Esc in try/keys.ts, comment mode's C and
// Esc in comments/keys.ts).
import { useEffect } from 'react'
import type * as Y from 'yjs'

export const shortcuts: readonly { keys: string; does: string }[] = [
  { keys: 'Ctrl+Z', does: 'Undo' },
  { keys: 'Ctrl+Shift+Z or Ctrl+Y', does: 'Redo' },
  { keys: 'Ctrl+C / Ctrl+V', does: 'Copy and paste steps, also into another design' },
  { keys: 'Ctrl+D', does: 'Duplicate the selected steps' },
  { keys: 'Delete', does: 'Delete the selected steps or arrows' },
  { keys: 'Ctrl+F', does: 'Search steps, buttons and texts' },
  { keys: 'F', does: 'Fit the map in view' },
  { keys: 'Esc', does: 'Close a popover or the search, or leave Try it or comment mode' },
  { keys: 'Ctrl+Enter', does: 'Try it from the selected step' },
  { keys: 'C', does: 'Comment mode: click a box, a button or the phone to comment' },
  { keys: 'Arrow keys', does: 'Nudge the selected boxes (with Shift, further)' },
  { keys: 'Shift+click or Shift+drag', does: 'Select several boxes' },
]

/**
 * Whether a key press belongs to a field (its own undo, TipTap's too), not to the editor. It reads
 * the first element of the event's composed path: inside the phone (a shadow root) the event's
 * target is only the phone's host.
 */
export function inField(event: Event): boolean {
  const target = event.composedPath()[0] ?? event.target
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

/**
 * Ctrl+Z undoes this person's last change, Ctrl+Shift+Z and Ctrl+Y redo it (Cmd on a Mac), unless
 * a field has the focus or the editor is read-only.
 */
export function useUndoKeys(undoManager: Y.UndoManager, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || inField(event)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undoManager.undo()
      } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
        event.preventDefault()
        undoManager.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [undoManager, enabled])
}
