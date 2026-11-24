import { type BotMessage, type MessageSlots, TelegramMessage } from '@xdesign/preview'
import { plainText } from '@xdesign/spec'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { useDesign, useEditor } from '../context'
import { useLook } from '../look'
import { SlotTextEditor } from '../phone/text/PhoneText'
import type { CellState, RichRow } from './rows'

// TXT-01's toolbar is drawn in the page, outside the popover: a press or the focus there keeps it open.
function inTextToolbar(event: Event | undefined): boolean {
  const target = event instanceof FocusEvent ? event.relatedTarget : event?.target
  return target instanceof Element && target.closest('[role="toolbar"][aria-label="Text formatting"]') !== null
}

/**
 * A rich text's cell in the Texts tab (04 section 10): its words, variables as `{name}`; for
 * people who can edit a click opens the phone's editor (TXT-01) on that language in a small
 * popover, in a bubble of the chosen look, with the toolbar and the shared undo.
 */
export function RichCell({
  row,
  lang,
  state,
  label,
  rtl,
  copiedNote,
}: {
  row: RichRow
  lang: string
  state: CellState
  /** The cell's name for screen readers: the group, the text and the language. */
  label: string
  rtl: boolean
  /** The tooltip of a copied text ("Copied from English, not translated until edited"). */
  copiedNote: string
}) {
  const design = useDesign()
  const { readOnly } = useEditor()
  const [open, setOpen] = useState(false)
  const doc = row.rich[lang]
  const words = useMemo(() => {
    if (!doc) return ''
    return plainText(
      doc,
      (id) => design.variables[id]?.idName ?? '?',
      (id) => {
        const part = design.parts[id]
        const text =
          part?.kind === 'text' ? (part.text.doc[lang] ?? part.text.doc[design.languages.default]) : undefined
        return text ? plainText(text, (varId) => design.variables[varId]?.idName ?? '?') : ''
      },
    ).trim()
  }, [doc, design.variables, design.parts, design.languages.default, lang])
  const shown = (
    <span
      dir={rtl ? 'rtl' : 'auto'}
      title={state === 'copied' ? copiedNote : undefined}
      className={cn(
        'line-clamp-4 min-h-5 whitespace-pre-wrap',
        state === 'copied' && 'text-fg-2 italic',
        state === 'missing' && 'text-warn',
      )}
    >
      {words === '' && state === 'missing' ? 'Missing' : words}
    </span>
  )
  if (readOnly) return <div className="px-2 py-1.5">{shown}</div>
  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (!next && inTextToolbar(details.event)) return
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="block min-h-8 w-full cursor-text rounded-md border border-transparent px-2 py-1.5 text-start text-callout outline-none hover:border-control focus-visible:border-focus focus-visible:shadow-[0_0_0_1px_var(--focus),0_0_0_4px_var(--focus-halo)] aria-expanded:border-focus"
          />
        }
      >
        {shown}
      </PopoverTrigger>
      <PopoverContent initialFocus={false} align="start" aria-label={label} className="flex w-auto flex-col gap-2 p-2">
        {open ? <TextBubble row={row} lang={lang} /> : null}
        <Button
          size="sm"
          className="self-end"
          onClick={() => {
            setOpen(false)
          }}
        >
          Done
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/** The text alone in a bot's bubble, in the phone's look and theme, its text slot the editor. */
function TextBubble({ row, lang }: { row: RichRow; lang: string }) {
  const design = useDesign()
  const [look] = useLook()
  const textId = row.at.text
  const message = useMemo<BotMessage>(
    () => ({ content: { type: 'text', text: { id: textId, doc: row.rich } }, keyboard: null }),
    [textId, row.rich],
  )
  const slots = useMemo<MessageSlots>(
    () => ({ text: () => <SlotTextEditor key={`${textId}:${lang}`} textId={textId} lang={lang} /> }),
    [textId, lang],
  )
  return (
    <TelegramMessage
      message={message}
      design={design}
      lang={lang}
      skin={look.skin}
      theme={look.theme}
      maxWidth={380}
      slots={slots}
    />
  )
}
