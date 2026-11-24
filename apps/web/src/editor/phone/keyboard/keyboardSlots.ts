// The phone's keyboard slots (PRV-02's `keyboard` and `replyKeyboard`, docs/plan/04 section 5.3):
// the inline keyboard and the bar under the bubble, and the bottom keyboard's panel, edited in
// place. The bottom keyboard's slot is there only while the step has one (the preview draws its
// place around whatever the slot returns).
import type { Slot } from '@xdesign/preview'
import { createElement, useMemo } from 'react'

import type { SendingStep } from '../../map/arrows'
import { InlineKeyboardSlot } from './InlineKeyboard'
import { keyboardOf } from './model'
import { ReplyKeyboardSlot } from './ReplyKeyboard'

/** The keyboard slots of a step, the same functions while it keeps its kind of keyboard. */
export function useKeyboardSlots(step: SendingStep): { keyboard: Slot; replyKeyboard: Slot | undefined } {
  const stepId = step.id
  const reply = keyboardOf(step)?.type === 'reply'
  return useMemo(
    () => ({
      keyboard: (shown) => createElement(InlineKeyboardSlot, { stepId, shown }),
      replyKeyboard: reply ? () => createElement(ReplyKeyboardSlot, { stepId }) : undefined,
    }),
    [stepId, reply],
  )
}
