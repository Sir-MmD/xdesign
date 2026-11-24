// The preview option "Invisible marks" (docs/plan/20-cards-kinds-x-admins-docker.md section
// 4.3.7): each U+200E, U+200F and U+061C in the bubble is wrapped in a `.tg-mark` span that
// keeps the character in the text (so the order of the line is unchanged) and draws a thin
// tick with a title. The marks are only wrapped while the option is on (MarksContext).
import { type ReactNode, useContext } from 'react'

import { markNames } from './bidi'
import { MarksContext } from './marksContext'

const markCharacters = /([\u{200E}\u{200F}\u{061C}])/u

/** The class of the tick of each mark, which colors it (RLM blue, LRM green, ALM amber). */
const markClasses: Readonly<Record<string, string>> = {
  '\u{200E}': 'lrm',
  '\u{200F}': 'rlm',
  '\u{061C}': 'alm',
}

/** A text leaf of the bubble; with the option on, its direction marks show as ticks. */
export function MarkedText({ text }: { text: string }): ReactNode {
  const marked = useContext(MarksContext)
  if (!marked || !markCharacters.test(text)) return text
  return text.split(markCharacters).map((piece, index) => {
    const name = markNames[piece]
    if (!name) return piece
    return (
      <span key={index} className={`tg-mark ${markClasses[piece] ?? ''}`} title={name.title}>
        {piece}
      </span>
    )
  })
}
