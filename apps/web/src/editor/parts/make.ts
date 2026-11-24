// Making parts (docs/plan/04 sections 4.3 and 12): "+ Part" in the palette (an empty row part for
// either keyboard, an empty text part, or the selected box's buttons) and the box menu's "Make a
// part from its buttons"; the new part's editor opens.
import type { Step } from '@xdesign/spec'

import { useEditor } from '../context'
import { keyboardOf } from '../phone/keyboard/model'
import { useOpenPart } from './store'

/** A new empty part's name; its editor opens with the name's field focused. */
const NEW_PART = 'New part'

/** Whether a step's keyboard has buttons of its own, not only placed parts. */
export function hasOwnButtons(step: Step): boolean {
  if (step.kind !== 'message' && step.kind !== 'question') return false
  const keyboard = keyboardOf(step)
  return (
    (keyboard?.type === 'inline' || keyboard?.type === 'reply') &&
    keyboard.rows.some((row) => row.type === 'buttons' && row.ids.length > 0)
  )
}

/** Makes a part and opens its editor. */
export function useMakePart(): {
  empty: (kind: 'inline' | 'reply' | 'text') => void
  fromButtons: (step: Step) => void
} {
  const { edits } = useEditor()
  const open = useOpenPart()
  return {
    empty: (kind) => {
      open(kind === 'text' ? edits.parts.addText(NEW_PART) : edits.parts.addRows(NEW_PART, kind))
    },
    // The box's own rows become the part, named after the box ("Main menu buttons").
    fromButtons: (step) => {
      const title = step.title.trim()
      const id = edits.parts.fromButtons(step.id, title === '' ? 'Buttons' : `${title} buttons`)
      if (id !== undefined) open(id)
    },
  }
}
