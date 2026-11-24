// Parts dropped from the palette (docs/plan/04 sections 5.3 and 12): a row part onto a step's
// keyboard on the phone (BTN-01's inline keyboard with its bar, and the bottom keyboard's panel),
// a text part into a text (TXT-01's editor). Palette drags are the browser's own (as the map's),
// so these are plain drag and drop events, apart from the keyboards' dnd-kit.
import type { EditorView } from '@tiptap/pm/view'
import { RICH_NODES, type StepId } from '@xdesign/spec'
import { type DOMAttributes, type DragEvent as ReactDragEvent, useState } from 'react'

import { useDesign, useEditor } from '../context'
import { keyboardOf } from '../phone/keyboard/model'
import { PART_DRAG, type TextPartDrag } from './store'

/** A keyboard that takes row parts: while one that fits is over it, and its drag handlers. */
export type PartDrop = {
  over: boolean
  handlers: Pick<DOMAttributes<HTMLElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'>
}

// The row in front of which the pointer is: the rows above its middle count (the end when none
// is below it). The keyboard draws one element per row, a row part's outline being one.
function rowIndexAt(element: HTMLElement, y: number): number | undefined {
  const box = element.matches('.tg-keyboard, .tg-reply-keyboard')
    ? element
    : element.querySelector('.tg-keyboard, .tg-reply-keyboard')
  if (!box) return undefined
  let index = 0
  for (const row of box.children) {
    if (!row.matches('.tg-kb-row, .tg-rk-row, .xd-part')) continue
    const rect = row.getBoundingClientRect()
    if (rect.top + rect.height / 2 < y) index++
  }
  return index
}

/**
 * A step's keyboard as a drop target for row parts: the part's row goes where the pointer is
 * among the rows; a message without a keyboard gets the part's kind. A part of the other kind of
 * keyboard (an inline part on a bottom keyboard), a part the keyboard already places, or a message
 * that removes the bottom keyboard or forces a reply does not take it.
 */
export function usePartDrop(stepId: StepId): PartDrop {
  const design = useDesign()
  const { edits } = useEditor()
  const [over, setOver] = useState(false)
  // The kind of row part dragged, when this keyboard takes it.
  const fits = (event: ReactDragEvent): 'inline' | 'reply' | undefined => {
    const step = design.steps[stepId]
    if (step?.kind !== 'message' && step?.kind !== 'question') return undefined
    const type = keyboardOf(step)?.type ?? null
    const { types } = event.dataTransfer
    const place = types.includes(PART_DRAG.inline) ? 'inline' : types.includes(PART_DRAG.reply) ? 'reply' : undefined
    return place !== undefined && (type === null || type === place) ? place : undefined
  }
  return {
    over,
    handlers: {
      onDragOver: (event) => {
        if (fits(event) === undefined) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setOver(true)
      },
      onDragLeave: (event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setOver(false)
      },
      onDrop: (event) => {
        setOver(false)
        const place = fits(event)
        const partId = place === undefined ? '' : event.dataTransfer.getData(PART_DRAG[place])
        if (place === undefined || partId === '') return
        event.preventDefault()
        event.stopPropagation()
        const step = design.steps[stepId]
        if (step?.kind !== 'message' && step?.kind !== 'question') return
        const keyboard = keyboardOf(step)
        // Once in a keyboard: its buttons would show twice.
        if (keyboard && 'rows' in keyboard && keyboard.rows.some((row) => row.type === 'part' && row.part === partId))
          return
        const index = rowIndexAt(event.currentTarget, event.clientY)
        if (keyboard === null) edits.keyboard.setType(stepId, place)
        edits.keyboard.usePart(stepId, partId, index)
      },
    },
  }
}

/**
 * A text part dropped into a text (TXT-01's editor, `handleDrop`): its node where the pointer is,
 * not inside a code block and not into the part's own text.
 */
export function dropTextPart(view: EditorView, event: DragEvent, textId: string): boolean {
  const data = event.dataTransfer?.getData(PART_DRAG.text)
  if (!data) return false
  let dragged: TextPartDrag
  try {
    dragged = JSON.parse(data) as TextPartDrag
  } catch {
    return false
  }
  if (dragged.text === textId) return true
  const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
  const type = view.state.schema.nodes[RICH_NODES.part]
  if (!at || !type) return false
  const $pos = view.state.doc.resolve(at.pos)
  if (!$pos.parent.inlineContent || $pos.parent.type.spec.code) return true
  view.dispatch(view.state.tr.insert(at.pos, type.create({ part: dragged.part })))
  view.focus()
  return true
}
