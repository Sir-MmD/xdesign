import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { RICH_MARKS, RICH_NODES, type Variable, type VariableSource } from '@xdesign/spec'
import {
  BoldIcon,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronsDownUpIcon,
  CodeIcon,
  EyeOffIcon,
  ItalicIcon,
  LinkIcon,
  PuzzleIcon,
  SmilePlusIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TextQuoteIcon,
  UnderlineIcon,
} from 'lucide-react'
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { useDesign, useEditor } from '../../context'
import { useSelection } from '../../selection'

type Panel = 'tools' | 'link' | 'insert' | 'newVariable' | 'emoji' | 'date' | 'part'

/** The groups of "{ } Insert", in the plan's order (04 sections 5.2 and 11). */
const variableGroups: readonly { label: string; sources: readonly VariableSource[] }[] = [
  { label: 'Saved answers', sources: ['question', 'button'] },
  { label: 'Remembered values', sources: ['remember', 'startLink'] },
  { label: 'Developer outputs', sources: ['devStep'] },
  { label: 'Built-ins', sources: ['builtin'] },
]

/** The Bot API's date_time_format choices; "" shows the text as a link that opens the date. */
const dateFormats: readonly { format: string; label: string }[] = [
  { format: 'dt', label: 'Date and time' },
  { format: 'd', label: 'Date' },
  { format: 'D', label: 'Long date' },
  { format: 't', label: 'Time' },
  { format: 'wdt', label: 'Weekday, date and time' },
  { format: 'r', label: 'Relative time' },
  { format: '', label: 'The text, as a link' },
]

// Keeps the focus (and the selection) in the text while a tool's button is pressed.
const keepFocus = (event: { preventDefault: () => void }) => {
  event.preventDefault()
}

/**
 * The small toolbar over the selection (04 section 5.2): the marks, link, quote and code block,
 * "Date and time", "{ } Insert" (variables, "+ New variable"), "Custom emoji" and "Part". It shows
 * while the text or the toolbar has the focus, in the page (outside the phone's shadow root, so the
 * design system's styles apply), over the selection or the caret. A tool that needs words opens its
 * form in the toolbar itself, so typing there keeps it open. A gift's text (`gift`, EVT-02) gets
 * only the formatting Telegram keeps there: no code, link, quote or code block.
 */
export function TextToolbar({ editor, gift = false }: { editor: Editor; gift?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  // Shown while the text or the toolbar has the focus; a move between the two is checked once it landed.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const check = () => {
      timer = null
      setShown(editor.isFocused || (box.current?.contains(document.activeElement) ?? false))
    }
    const later = () => {
      if (timer === null) timer = setTimeout(check, 0)
    }
    editor.on('focus', check)
    editor.on('blur', later)
    const toolbarBlur = (event: FocusEvent) => {
      if (box.current?.contains(event.target as Node | null)) later()
    }
    document.addEventListener('focusout', toolbarBlur)
    // A text that already has the focus (a new editor in its place).
    later()
    return () => {
      if (timer !== null) clearTimeout(timer)
      editor.off('focus', check)
      editor.off('blur', later)
      document.removeEventListener('focusout', toolbarBlur)
    }
  }, [editor])

  // Over the selection, else under it; inside the window.
  const place = () => {
    const element = box.current
    if (!element || editor.isDestroyed) return
    const { from, to } = editor.state.selection
    let start: { top: number; bottom: number; left: number; right: number }
    let end: typeof start
    try {
      start = editor.view.coordsAtPos(from)
      end = editor.view.coordsAtPos(to)
    } catch {
      return
    }
    const gap = 8
    const height = element.offsetHeight
    const width = element.offsetWidth
    let top = Math.min(start.top, end.top) - height - gap
    if (top < gap) top = Math.max(start.bottom, end.bottom) + gap
    const middle = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2
    const left = Math.min(Math.max(middle - width / 2, gap), window.innerWidth - width - gap)
    element.style.top = `${String(Math.round(top))}px`
    element.style.left = `${String(Math.round(Math.max(left, gap)))}px`
  }
  const placeRef = useRef(place)
  useLayoutEffect(() => {
    placeRef.current = place
    place()
  })
  useEffect(() => {
    if (!shown) return
    const again = () => {
      placeRef.current()
    }
    // The chat scrolls inside the phone's shadow root, whose scroll events stay there.
    const root = editor.view.dom.getRootNode()
    editor.on('transaction', again)
    root.addEventListener('scroll', again, true)
    window.addEventListener('scroll', again, true)
    window.addEventListener('resize', again)
    // A tool's form is larger than the tools.
    const resized = new ResizeObserver(again)
    if (box.current) resized.observe(box.current)
    return () => {
      resized.disconnect()
      editor.off('transaction', again)
      root.removeEventListener('scroll', again, true)
      window.removeEventListener('scroll', again, true)
      window.removeEventListener('resize', again)
    }
  }, [editor, shown])

  if (!shown) return null
  return createPortal(
    <div
      ref={box}
      role="toolbar"
      aria-label="Text formatting"
      className="x-pop fixed z-50 max-w-[calc(100vw-16px)] rounded-xl border border-border-strong bg-popover p-1 text-popover-foreground shadow-(--shadow-lg)"
      onMouseDown={(event) => {
        // A press anywhere but in a field keeps the focus where it is (the text, or a form's field).
        if (!(event.target instanceof Element && event.target.closest('input, select, textarea'))) keepFocus(event)
      }}
      onKeyDown={(event) => {
        // Escape goes back to the text.
        if (event.key === 'Escape') {
          event.preventDefault()
          editor.commands.focus()
        }
      }}
    >
      <ToolbarPanels editor={editor} gift={gift} />
    </div>,
    document.body,
  )
}

function ToolbarPanels({ editor, gift }: { editor: Editor; gift: boolean }) {
  const [panel, setPanel] = useState<Panel>('tools')
  const back = () => {
    setPanel('tools')
    editor.commands.focus()
  }
  // A form's action, Escape or a click in the text bring the focus back there, and the tools with it.
  useEffect(() => {
    const toTools = () => {
      setPanel('tools')
    }
    editor.on('focus', toTools)
    return () => {
      editor.off('focus', toTools)
    }
  }, [editor])
  switch (panel) {
    case 'tools':
      return <Tools editor={editor} open={setPanel} gift={gift} />
    case 'link':
      return <LinkForm editor={editor} back={back} />
    case 'insert':
      return (
        <VariableList
          editor={editor}
          back={back}
          add={() => {
            setPanel('newVariable')
          }}
        />
      )
    case 'newVariable':
      return <NewVariableForm editor={editor} back={back} />
    case 'emoji':
      return <EmojiForm editor={editor} back={back} />
    case 'date':
      return <DateForm editor={editor} back={back} />
    case 'part':
      return <PartList editor={editor} back={back} />
  }
}

function Tools({ editor, open, gift }: { editor: Editor; open: (panel: Panel) => void; gift: boolean }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive(RICH_MARKS.bold),
      italic: e.isActive(RICH_MARKS.italic),
      underline: e.isActive(RICH_MARKS.underline),
      strike: e.isActive(RICH_MARKS.strike),
      spoiler: e.isActive(RICH_MARKS.spoiler),
      code: e.isActive(RICH_MARKS.code),
      link: e.isActive(RICH_MARKS.link),
      dateTime: e.isActive(RICH_MARKS.dateTime),
      quote: e.isActive(RICH_NODES.blockquote),
      expandable: e.isActive(RICH_NODES.blockquote, { expandable: true }),
      codeBlock: e.isActive(RICH_NODES.codeBlock),
    }),
  })
  const chain = () => editor.chain().focus()
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <Tool label="Bold" on={active.bold} run={() => chain().toggleBold().run()}>
        <BoldIcon aria-hidden />
      </Tool>
      <Tool label="Italic" on={active.italic} run={() => chain().toggleItalic().run()}>
        <ItalicIcon aria-hidden />
      </Tool>
      <Tool label="Underline" on={active.underline} run={() => chain().toggleUnderline().run()}>
        <UnderlineIcon aria-hidden />
      </Tool>
      <Tool label="Strikethrough" on={active.strike} run={() => chain().toggleStrike().run()}>
        <StrikethroughIcon aria-hidden />
      </Tool>
      <Tool label="Spoiler" on={active.spoiler} run={() => chain().toggleSpoiler().run()}>
        <EyeOffIcon aria-hidden />
      </Tool>
      {gift ? null : (
        <>
          <Tool label="Code" on={active.code} run={() => chain().toggleCode().run()}>
            <CodeIcon aria-hidden />
          </Tool>
          <Tool
            label="Link"
            on={active.link}
            run={() => {
              open('link')
            }}
          >
            <LinkIcon aria-hidden />
          </Tool>
          <Tool label="Quote" on={active.quote} run={() => chain().toggleBlockquote().run()}>
            <TextQuoteIcon aria-hidden />
          </Tool>
          {active.quote ? (
            <Tool
              label="Expandable quote"
              on={active.expandable}
              run={() => chain().updateAttributes(RICH_NODES.blockquote, { expandable: !active.expandable }).run()}
            >
              <ChevronsDownUpIcon aria-hidden />
            </Tool>
          ) : null}
          <Tool label="Code block" on={active.codeBlock} run={() => chain().toggleCodeBlock().run()}>
            <SquareCodeIcon aria-hidden />
          </Tool>
        </>
      )}
      <Tool
        label="Date and time"
        on={active.dateTime}
        run={() => {
          open('date')
        }}
      >
        <CalendarClockIcon aria-hidden />
      </Tool>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={active.codeBlock}
        onMouseDown={keepFocus}
        onClick={() => {
          open('insert')
        }}
      >
        {'{ } Insert'}
      </Button>
      <Tool
        label="Custom emoji"
        disabled={active.codeBlock}
        run={() => {
          open('emoji')
        }}
      >
        <SmilePlusIcon aria-hidden />
      </Tool>
      <Tool
        label="Part"
        disabled={active.codeBlock}
        run={() => {
          open('part')
        }}
      >
        <PuzzleIcon aria-hidden />
      </Tool>
    </div>
  )
}

function Tool({
  label,
  on = false,
  disabled = false,
  run,
  children,
}: {
  label: string
  on?: boolean
  disabled?: boolean
  run: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={on ? 'secondary' : 'ghost'}
      size="icon-sm"
      aria-label={label}
      aria-pressed={on}
      title={label}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={run}
    >
      {children}
    </Button>
  )
}

/** A tool's form: its title with "Back", the fields, and the button that applies it. */
function Form({
  title,
  back,
  submit,
  children,
}: {
  title: string
  back: () => void
  submit?: (() => void) | undefined
  children: ReactNode
}) {
  return (
    <form
      className="flex w-72 flex-col gap-2 p-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        submit?.()
      }}
    >
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Back" title="Back" onClick={back}>
          <ChevronLeftIcon aria-hidden />
        </Button>
        <span className="text-subhead font-semibold">{title}</span>
      </div>
      {children}
    </form>
  )
}

function LinkForm({ editor, back }: { editor: Editor; back: () => void }) {
  const current = editor.getAttributes(RICH_MARKS.link) as { href?: string }
  const [href, setHref] = useState(current.href ?? '')
  const apply = () => {
    const address = href.trim()
    const chain = editor.chain().focus().extendMarkRange(RICH_MARKS.link)
    if (address === '') chain.unsetLink().run()
    else if (editor.state.selection.empty && current.href === undefined) {
      chain
        .insertContent({
          type: RICH_NODES.text,
          text: address,
          marks: [{ type: RICH_MARKS.link, attrs: { href: address } }],
        })
        .run()
    } else chain.setLink({ href: address }).run()
  }
  return (
    <Form title="Link" back={back} submit={apply}>
      <Input
        autoFocus
        dir="ltr"
        aria-label="Link address"
        placeholder="https://"
        value={href}
        onChange={(event) => {
          setHref(event.target.value)
        }}
      />
      <div className="flex justify-end gap-2">
        {current.href !== undefined ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().extendMarkRange(RICH_MARKS.link).unsetLink().run()
            }}
          >
            Remove link
          </Button>
        ) : null}
        <Button type="submit" size="sm">
          Done
        </Button>
      </div>
    </Form>
  )
}

/** Puts an inline node at the selection and goes back to the text. */
function insertNode(editor: Editor, type: string, attrs: Record<string, string>) {
  editor.chain().focus().insertContent({ type, attrs }).run()
}

function VariableList({ editor, back, add }: { editor: Editor; back: () => void; add: () => void }) {
  const design = useDesign()
  const { readOnly } = useEditor()
  const variables = Object.values(design.variables).sort((a, b) => a.idName.localeCompare(b.idName))
  const groups = variableGroups
    .map((group) => ({ ...group, items: variables.filter((variable) => group.sources.includes(variable.source)) }))
    .filter((group) => group.items.length > 0)
  return (
    <Form title="Insert" back={back}>
      <div className="flex max-h-72 flex-col overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col">
            <span className="px-2 pt-2 pb-1 text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase">
              {group.label}
            </span>
            {group.items.map((variable) => (
              <VariableItem key={variable.id} variable={variable} editor={editor} done={back} />
            ))}
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" className="justify-start" disabled={readOnly} onClick={add}>
        + New variable
      </Button>
    </Form>
  )
}

function VariableItem({ variable, editor, done }: { variable: Variable; editor: Editor; done: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-(--control-h-sm) items-center justify-between gap-3 rounded-md px-2 text-start text-callout hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
      onMouseDown={keepFocus}
      onClick={() => {
        insertNode(editor, RICH_NODES.variable, { var: variable.id })
        done()
      }}
    >
      <span className="truncate" dir="auto">
        {variable.label}
      </span>
      <span className="shrink-0 font-mono text-footnote text-fg-3">{`{${variable.idName}}`}</span>
    </button>
  )
}

function NewVariableForm({ editor, back }: { editor: Editor; back: () => void }) {
  const { edits } = useEditor()
  const [label, setLabel] = useState('')
  const add = () => {
    const name = label.trim()
    if (name === '') return
    const id = edits.variables.add({ label: name, type: 'text', source: 'remember' })
    insertNode(editor, RICH_NODES.variable, { var: id })
  }
  return (
    <Form title="New variable" back={back} submit={add}>
      <Input
        autoFocus
        aria-label="Name"
        placeholder="Name"
        value={label}
        onChange={(event) => {
          setLabel(event.target.value)
        }}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={label.trim() === ''}>
          Add
        </Button>
      </div>
    </Form>
  )
}

function EmojiForm({ editor, back }: { editor: Editor; back: () => void }) {
  const [id, setId] = useState('')
  const [fallback, setFallback] = useState('')
  const ready = /^\d+$/.test(id.trim()) && fallback.trim() !== ''
  const insert = () => {
    if (!ready) return
    insertNode(editor, RICH_NODES.customEmoji, { id: id.trim(), fallback: fallback.trim() })
  }
  return (
    <Form title="Custom emoji" back={back} submit={insert}>
      <Input
        autoFocus
        dir="ltr"
        inputMode="numeric"
        aria-label="Custom emoji ID"
        placeholder="Custom emoji ID"
        value={id}
        onChange={(event) => {
          setId(event.target.value)
        }}
      />
      <Input
        aria-label="Fallback emoji"
        placeholder="Fallback emoji"
        value={fallback}
        onChange={(event) => {
          setFallback(event.target.value)
        }}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!ready}>
          Insert
        </Button>
      </div>
    </Form>
  )
}

// A Unix time as the value of a datetime-local field, in this computer's time zone.
function localValue(unix: number): string {
  const date = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function DateForm({ editor, back }: { editor: Editor; back: () => void }) {
  const current = editor.getAttributes(RICH_MARKS.dateTime) as { unix?: number; format?: string }
  const [when, setWhen] = useState(() => localValue(current.unix ?? Math.floor(Date.now() / 1000)))
  const [format, setFormat] = useState(current.format ?? 'dt')
  const unix = Math.floor(new Date(when).getTime() / 1000)
  const apply = () => {
    if (!Number.isFinite(unix)) return
    const attrs = { unix, format }
    const chain = editor.chain().focus().extendMarkRange(RICH_MARKS.dateTime)
    // Without a selection the date's text is written too: what apps that cannot draw dates show.
    if (editor.state.selection.empty && current.unix === undefined) {
      const text = new Date(unix * 1000).toLocaleString()
      chain.insertContent({ type: RICH_NODES.text, text, marks: [{ type: RICH_MARKS.dateTime, attrs }] }).run()
    } else chain.setDateTime(attrs).run()
  }
  return (
    <Form title="Date and time" back={back} submit={apply}>
      <Input
        autoFocus
        type="datetime-local"
        aria-label="Date and time"
        value={when}
        onChange={(event) => {
          setWhen(event.target.value)
        }}
      />
      <select
        aria-label="Format"
        className="h-(--control-h) w-full rounded-md border border-control bg-surface px-2 text-body text-foreground outline-none focus-visible:border-focus"
        value={format}
        onChange={(event) => {
          setFormat(event.target.value)
        }}
      >
        {dateFormats.map((choice) => (
          <option key={choice.format} value={choice.format}>
            {choice.label}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        {current.unix !== undefined ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().extendMarkRange(RICH_MARKS.dateTime).unsetDateTime().run()
            }}
          >
            Remove
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!Number.isFinite(unix)}>
          Done
        </Button>
      </div>
    </Form>
  )
}

function PartList({ editor, back }: { editor: Editor; back: () => void }) {
  const design = useDesign()
  // Not the part being edited (PARTS-01's part editor): a part placed inside itself writes nothing.
  const text = useSelection((s) => s.text)
  const parts = Object.values(design.parts).filter((part) => part.kind === 'text' && part.text.id !== text)
  return (
    <Form title="Part" back={back}>
      {parts.length === 0 ? (
        <p className="px-2 pb-2 text-callout text-fg-3">No text parts yet</p>
      ) : (
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {parts.map((part) => (
            <button
              key={part.id}
              type="button"
              className="flex min-h-(--control-h-sm) items-center rounded-md px-2 text-start text-callout hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
              onMouseDown={keepFocus}
              onClick={() => {
                insertNode(editor, RICH_NODES.part, { part: part.id })
                back()
              }}
            >
              <span className="truncate" dir="auto">
                {part.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </Form>
  )
}
