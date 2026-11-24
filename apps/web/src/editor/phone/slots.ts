// The phone's editable slots (docs/plan/04 section 5, PRV-02's ChatSlots): what draws in place of
// the read-only message text (TXT-01; a poll's question too), its media (MSG-01), its inline and
// bottom keyboards (BTN-01) and a poll's or quiz's options (MSG-03). Each task adds its slot here
// for people who can edit; read-only, the phone shows the step as the preview draws it, with
// MSG-01's cards for what the preview has no picture for.
import type { ChatSlots, Slot } from '@xdesign/preview'
import type { MessageStep, QuestionStep } from '@xdesign/spec'
import { createElement } from 'react'

import { useKeyboardSlots } from './keyboard/keyboardSlots'
import { BubbleMedia } from './media/BubbleMedia'
import { shownOf } from './message'
import { OptionField } from './poll/OptionField'
import { useTextSlot } from './text/textSlot'

/** The slots of the phone for a message or question step; only the media's while the editor is read-only. */
export function usePhoneSlots(step: MessageStep | QuestionStep, readOnly: boolean): ChatSlots | undefined {
  const text = useTextSlot(step)
  const { keyboard, replyKeyboard } = useKeyboardSlots(step)
  // MSG-01: the media, also read-only (the preview draws no file, place or contact card).
  const media: Slot = (shown) => createElement(BubbleMedia, { step, shown, readOnly })
  if (readOnly) return { media }
  const { content } = shownOf(step)
  const options = content.type === 'poll' || content.type === 'quiz' ? content.options : undefined
  const option = options
    ? (index: number) =>
        createElement(OptionField, { key: index, stepId: step.id, index, option: options[index] ?? {} })
    : undefined
  return { text, media, keyboard, replyKeyboard, option }
}
