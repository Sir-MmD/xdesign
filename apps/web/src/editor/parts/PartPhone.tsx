// The part editor's small phone (docs/plan/04 section 12): the part in the chosen look and
// language, edited with the phone's own editors. A row part's rows alone (BTN-01's keyboard rows
// on the part, the bubble hidden by part.css), under the chat for inline buttons or in the bottom
// keyboard's place; a text part's text in a bot's bubble (TXT-01's editor on the part's text).
// The part is one set of buttons or one text, so every use follows at once.
import { type BotMessage, type ChatEntry, type ChatSlots, TelegramChat } from '@xdesign/preview'
import type { Part, Row } from '@xdesign/spec'
import { createElement, useMemo } from 'react'

import { useDesign, useLang } from '../context'
import { useLook } from '../look'
import { KeyboardRows } from '../phone/keyboard/KeyboardRows'
import { adoptKeyboardSheet } from '../phone/keyboard/sheet'
import { PhoneText } from '../phone/text/PhoneText'
import css from './part.css?inline'

let sheet: CSSStyleSheet | null = null

/** Adopts part.css into the shadow root of the part editor's phone (a ref callback). */
function adoptPartSheet(element: HTMLElement | null): void {
  const root = element?.getRootNode()
  if (!(root instanceof ShadowRoot)) return
  if (!sheet) {
    sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
  }
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
}

// The phone's size: narrow enough for the editor's sheet.
const phoneWidth = 380
const phoneHeight = 340

// A row part's message: no text (its bubble is hidden), the rows in the slots.
const rowsMessage: BotMessage = { content: { type: 'text', text: { doc: {} } }, keyboard: null }

/** The part on a small phone, editable. */
export function PartPhone({ part }: { part: Part }) {
  const design = useDesign()
  const lang = useLang()
  const [look] = useLook()
  const partId = part.id
  const place = part.kind === 'rows' ? part.place : null
  const text = part.kind === 'text' ? part.text : null
  const entries = useMemo<ChatEntry[]>(
    () => [{ type: 'bot', message: text ? { content: { type: 'text', text }, keyboard: null } : rowsMessage }],
    [text],
  )
  const slots = useMemo<ChatSlots>(() => {
    if (text) {
      return { text: (shown) => createElement(PhoneText, { key: text.id, textId: text.id, doc: text.doc, shown }) }
    }
    const rows = () => createElement(PartRowsEditor, { partId })
    const hide = () => createElement('span', { ref: adoptPartSheet })
    return place === 'reply' ? { text: hide, replyKeyboard: rows } : { text: hide, keyboard: rows }
  }, [text, partId, place])
  return (
    <TelegramChat
      entries={entries}
      design={design}
      lang={lang}
      skin={look.skin}
      theme={look.theme}
      maxWidth={phoneWidth}
      height={phoneHeight}
      slots={slots}
    />
  )
}

/** A row part's rows, edited as a keyboard: "+" and "+ row", dragging, the button popover. */
function PartRowsEditor({ partId }: { partId: string }) {
  const design = useDesign()
  const part = design.parts[partId]
  const rows = useMemo<Row[]>(
    () => (part?.kind === 'rows' ? part.rows.map((ids) => ({ type: 'buttons', ids })) : []),
    [part],
  )
  if (part?.kind !== 'rows') return null
  const at = { part: partId }
  if (part.place === 'reply') return <KeyboardRows at={at} place="reply" rows={rows} resize />
  return (
    <div ref={adoptKeyboardSheet} className="xd-kb">
      <KeyboardRows at={at} place="inline" rows={rows} />
    </div>
  )
}
