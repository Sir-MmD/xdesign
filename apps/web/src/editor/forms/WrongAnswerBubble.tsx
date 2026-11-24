import { type BotMessage, type MessageSlots, TelegramMessage } from '@xdesign/preview'
import type { QuestionStep } from '@xdesign/spec'
import { useCallback, useMemo, useState } from 'react'

import { useDesign, useEditor, useLang } from '../context'
import { useLook } from '../look'
import { PhoneText } from '../phone/text/PhoneText'

/**
 * A question's wrong answer message in a small phone (04 section 6): the bubble as the chat shows
 * it, in the chosen look and language, its text edited in place with TXT-01's editor (read-only
 * for Commenter, Viewer and narrow screens).
 */
export function WrongAnswerBubble({ step }: { step: QuestionStep }) {
  const design = useDesign()
  const lang = useLang()
  const [look] = useLook()
  const { readOnly } = useEditor()
  const text = step.wrongAnswer.message
  const message = useMemo<BotMessage>(() => ({ content: { type: 'text', text }, keyboard: null }), [text])
  const { id: textId, doc } = text
  const slots = useMemo<MessageSlots | undefined>(
    () =>
      readOnly ? undefined : { text: (shown) => <PhoneText key={textId} textId={textId} doc={doc} shown={shown} /> },
    [readOnly, textId, doc],
  )
  // The bubble takes the section's width, up to the look's own.
  const [width, setWidth] = useState<number>()
  const measure = useCallback((element: HTMLDivElement) => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <div ref={measure} className="overflow-hidden rounded-lg border">
      {width === undefined ? null : (
        <TelegramMessage
          message={message}
          design={design}
          lang={lang}
          skin={look.skin}
          theme={look.theme}
          maxWidth={width}
          slots={slots}
        />
      )}
    </div>
  )
}
