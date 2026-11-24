// The phone's text slot (PRV-02's `text`, docs/plan/04 section 5.2): the step's text or caption
// edited in place (PhoneText.tsx); a kind without one, or a media message without a caption yet,
// keeps the read-only drawing (MSG-01's kind change keeps the text as the caption). A poll's
// question is written without the formatting toolbar (Telegram keeps only its custom emoji).
import type { Slot } from '@xdesign/preview'
import type { MessageStep, QuestionStep } from '@xdesign/spec'
import { createElement, useMemo } from 'react'

import { PhoneText } from './PhoneText'
import { stepText } from './stepText'

/** The text slot of a step, the same function while its text and documents stay. */
export function useTextSlot(step: MessageStep | QuestionStep): Slot | undefined {
  const shownText = stepText(step)
  const textId = shownText?.text.id
  const doc = shownText?.text.doc
  const plain = shownText?.question === true
  return useMemo<Slot | undefined>(
    () =>
      textId === undefined || doc === undefined
        ? undefined
        : (shown) => createElement(PhoneText, { key: textId, textId, doc, shown, plain }),
    [textId, doc, plain],
  )
}
