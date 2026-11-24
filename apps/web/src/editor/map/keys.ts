// The map's keys (docs/plan/04 section 14): Delete, Ctrl+C and Ctrl+V (the copy and paste events),
// Ctrl+D, F, Ctrl+F, Esc and the arrow keys. They act while the map or nothing has the focus and
// never in a field (inField); Ctrl+F works anywhere outside a field. shortcuts.ts lists them.
import type { Clip } from '@xdesign/spec'
import { type RefObject, useEffect, useEffectEvent } from 'react'

import { inField } from '../shortcuts'
import { putClip, takeClip } from './clipboard'

/** What the map does for each key; MapPane.tsx gives them. */
export type MapKeys = {
  /** Delete or Backspace: the selected boxes, else the selected arrows. */
  remove: () => void
  /** The selected steps for a copy, if any. */
  copy: () => Clip | undefined
  paste: (clip: Clip) => void
  duplicate: () => void
  /** Moves the selected boxes; false when none is selected. */
  nudge: (dx: number, dy: number) => boolean
  fit: () => void
  search: () => void
  escape: () => void
}

// Pixels an arrow key moves the selected boxes, and with Shift.
const NUDGE = 10
const NUDGE_FAR = 50
const ARROWS: Readonly<Partial<Record<string, readonly [number, number]>>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

// Whether an event is the map's: the focus is on the map or on nothing.
function onMap(event: Event, pane: HTMLElement | null): boolean {
  const target = event.target
  return target === document.body || (target instanceof Node && pane?.contains(target) === true)
}

/** Listens to the map's keys while it is shown; read-only leaves fit, search and copy. */
export function useMapKeys(pane: RefObject<HTMLElement | null>, readOnly: boolean, keys: MapKeys): void {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || inField(event)) return
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && key === 'f' && !event.shiftKey) {
      event.preventDefault()
      keys.search()
      return
    }
    if (!onMap(event, pane.current)) return
    if (mod) {
      if (key === 'd' && !event.shiftKey && !readOnly) {
        event.preventDefault()
        keys.duplicate()
      }
      return
    }
    if (event.key === 'Escape') keys.escape()
    else if (key === 'f' && !event.shiftKey) {
      event.preventDefault()
      keys.fit()
    } else if (readOnly) return
    else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      keys.remove()
    } else {
      const arrow = ARROWS[event.key]
      const step = event.shiftKey ? NUDGE_FAR : NUDGE
      if (arrow && keys.nudge(arrow[0] * step, arrow[1] * step)) event.preventDefault()
    }
  })
  // A copy with text selected on the page copies the text.
  const onCopy = useEffectEvent((event: ClipboardEvent) => {
    if (event.defaultPrevented || inField(event) || !onMap(event, pane.current)) return
    if (window.getSelection()?.isCollapsed === false || !event.clipboardData) return
    const clip = keys.copy()
    if (!clip) return
    event.preventDefault()
    putClip(event.clipboardData, clip)
  })
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    if (readOnly || inField(event) || !onMap(event, pane.current) || !event.clipboardData) return
    const clip = takeClip(event.clipboardData)
    if (!clip) return
    event.preventDefault()
    keys.paste(clip)
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
  }, [])
}
