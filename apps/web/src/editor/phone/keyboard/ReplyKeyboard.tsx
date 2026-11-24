// The phone's `replyKeyboard` slot (PRV-02, docs/plan/04 section 5.3): the bottom keyboard's
// panel with the same editable rows as the inline keyboard (KeyboardRows.tsx), "Fit to buttons"
// as the panel's height; its options are in the bar's "More" under the bubble. A bottom row part
// dragged from the palette drops here (PARTS-01's `usePartDrop`).
import type { StepId } from '@xdesign/spec'

import { useDesign } from '../../context'
import { usePartDrop } from '../../parts/drop'
import { KeyboardRows } from './KeyboardRows'
import { keyboardOf } from './model'

/** The bottom keyboard of a message or a question's prompt, in the input field's place. */
export function ReplyKeyboardSlot({ stepId }: { stepId: StepId }) {
  const design = useDesign()
  const drop = usePartDrop(stepId)
  const step = design.steps[stepId]
  if (step?.kind !== 'message' && step?.kind !== 'question') return null
  const keyboard = keyboardOf(step)
  if (keyboard?.type !== 'reply') return null
  return <KeyboardRows at={{ step: stepId }} place="reply" rows={keyboard.rows} resize={keyboard.resize} drop={drop} />
}
