import { measure, type MessageStep, type QuestionStep, telegram } from '@xdesign/spec'
import { useMemo } from 'react'

import { cn } from '@/lib/utils'

import { useDesign, useLang } from '../../context'
import { stepText } from './stepText'

/**
 * The counter under the bubble (04 section 5.2): the length Telegram counts for the text in the
 * language shown (SPEC-02's measure, as the checks count it: variables at their test values, text
 * parts written in) against the catalog's limit, "812 / 4096", "/ 1024" for a caption or "/ 300" for
 * a poll's question, red over it.
 * The bubble clips what is drawn outside it, so the counter sits under the phone.
 */
export function TextCounter({ step }: { step: MessageStep | QuestionStep }) {
  const design = useDesign()
  const lang = useLang()
  const shown = stepText(step)
  const doc = shown?.text.doc[lang]
  const { variables, parts } = design
  const length = useMemo(() => {
    if (!doc) return 0
    return measure(doc, {
      testValue: (id) => variables[id]?.testValue,
      part: (id) => {
        const part = parts[id]
        return part?.kind === 'text' ? part.text.doc[lang] : undefined
      },
    })
  }, [doc, variables, parts, lang])
  if (!shown) return null
  const { max } = telegram.limit(shown.question ? 'pollQuestion' : shown.caption ? 'caption' : 'text')
  return (
    <p
      className={cn('shrink-0 pb-3 text-center text-footnote tabular-nums', length > max ? 'text-error' : 'text-fg-3')}
    >
      {length} / {max}
    </p>
  )
}
