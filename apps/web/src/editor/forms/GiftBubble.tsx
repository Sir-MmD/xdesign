import { type BotMessage, type MessageSlots, TelegramMessage } from '@xdesign/preview'
import { measure, type RichTextRef, telegram } from '@xdesign/spec'
import { useCallback, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'

import { useDesign, useEditor, useLang } from '../context'
import { useLook } from '../look'
import { PhoneText } from '../phone/text/PhoneText'

/**
 * A gift action's card in a small phone (EVT-02): the gift as the chat shows it, in the chosen
 * look and language, its text written in place with TXT-01's editor and only the formatting a
 * gift keeps (read-only for Commenter, Viewer and narrow screens), and the text's counter against
 * Telegram's 128 characters.
 */
export function GiftBubble({ description, text }: { description: string; text: RichTextRef }) {
  const design = useDesign()
  const lang = useLang()
  const [look] = useLook()
  const { readOnly } = useEditor()
  const message = useMemo<BotMessage>(
    () => ({ content: { type: 'gift', description, text }, keyboard: null }),
    [description, text],
  )
  const { id: textId, doc } = text
  const slots = useMemo<MessageSlots | undefined>(
    () =>
      readOnly
        ? undefined
        : { text: (shown) => <PhoneText key={textId} textId={textId} doc={doc} shown={shown} gift /> },
    [readOnly, textId, doc],
  )
  const { variables, parts } = design
  const shownDoc = doc[lang]
  const length = useMemo(() => {
    if (!shownDoc) return 0
    return measure(shownDoc, {
      testValue: (id) => variables[id]?.testValue,
      part: (id) => {
        const part = parts[id]
        return part?.kind === 'text' ? part.text.doc[lang] : undefined
      },
    })
  }, [shownDoc, variables, parts, lang])
  const { max } = telegram.limit('giftText')
  // The card takes the section's width, up to the look's own.
  const [width, setWidth] = useState<number>()
  const measureBox = useCallback((element: HTMLDivElement) => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <div className="grid gap-1">
      <div ref={measureBox} className="overflow-hidden rounded-lg border">
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
      <p className={cn('text-center text-footnote tabular-nums', length > max ? 'text-error' : 'text-fg-3')}>
        {length} / {max}
      </p>
    </div>
  )
}
