import {
  type Content,
  type MediaKind,
  newId,
  type RichMessageBlock,
  type RichTextRef,
  type StepId,
  telegram,
} from '@xdesign/spec'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react'
import { type ReactNode, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { useDesign, useEditor, useLang } from '../../context'
import { Field, FormSection } from '../../forms/fields'
import { SwitchRow } from '../../forms/start/fields'
import { buttonText } from '../../map/arrows'
import { useSelection, useSelectionStore } from '../../selection'
import { ButtonPopover } from '../keyboard/ButtonPopover'
import { Choice } from '../keyboard/fields'
import { NEW_LABEL } from '../keyboard/model'
import { MediaSource } from '../media/MediaSource'
import { type PhoneStep, useUpdateContent } from '../message'
import { BubbleText } from '../poll/PollSection'

type Rich = Extract<Content, { type: 'rich' }>
type BlockType = RichMessageBlock['type']
type ButtonRow = Extract<RichMessageBlock, { type: 'buttons' }>

const columns = telegram.limit('richTableColumns')
const sizes = telegram.limit('richHeadingSize')
const perRow = telegram.limit('richButtons')
// The files a media block takes (no live photos, round videos or stickers).
const MEDIA_KINDS: readonly MediaKind[] = telegram.RICH_MEDIA_KINDS.map((row) => row.id)

// The blocks "Add a block" offers, in its order, with their names; "Buttons" is a row of inline
// buttons inside the message (RICH-02).
const BLOCKS: readonly { value: BlockType; label: string }[] = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'heading', label: 'Heading' },
  { value: 'list', label: 'List' },
  { value: 'table', label: 'Table' },
  { value: 'details', label: 'Details' },
  { value: 'quote', label: 'Quote' },
  { value: 'code', label: 'Code block' },
  { value: 'media', label: 'Media' },
  { value: 'buttons', label: 'Buttons' },
  { value: 'divider', label: 'Divider' },
  { value: 'footer', label: 'Footer' },
]
const LABELS = Object.fromEntries(BLOCKS.map((item) => [item.value, item.label])) as Record<BlockType, string>
const SIZES = Array.from({ length: sizes.max - sizes.min + 1 }, (_, index) => {
  const size = String(sizes.min + index)
  return { value: size, label: size }
})

const text = (): RichTextRef => ({ id: newId(), doc: {} })

// A new block of a type: empty texts, a list of two items, a table of two rows of two cells (a
// button row comes with its first button, through the keyboard accessors).
function newBlock(type: Exclude<BlockType, 'buttons'>): RichMessageBlock {
  switch (type) {
    case 'paragraph':
    case 'footer':
      return { type, text: text() }
    case 'heading':
      return { type, text: text(), size: 2 }
    case 'code':
      return { type, text: text() }
    case 'quote':
      return { type, text: text() }
    case 'list':
      return { type, ordered: false, items: [{ text: text() }, { text: text() }] }
    case 'table':
      return {
        type,
        rows: [0, 1].map(() => ({ cells: [{ text: text() }, { text: text() }] })),
      }
    case 'details':
      return { type, summary: text(), text: text() }
    case 'media':
      return { type, media: { placeholder: { description: '' } } }
    case 'divider':
      return { type }
  }
}

/**
 * A rich message's blocks under the phone (RICH-01, 04 section 5.1): each block in order with
 * move up, move down and remove, its texts written in bubbles of the look with TXT-01's editor
 * (a list's items, a table's cells), a media block's file (MSG-01's MediaSource), a button row's
 * buttons with BTN-01's popover (RICH-02), its settings, "Add a block" and "Right to left".
 */
export function RichSection({ step, rich }: { step: PhoneStep; rich: Rich }) {
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const update = useUpdateContent(step.id)
  const setBlocks = (change: (blocks: RichMessageBlock[]) => RichMessageBlock[]) => {
    update((now) => (now.type === 'rich' ? { ...now, blocks: change([...now.blocks]) } : undefined))
  }
  const setBlock = (index: number, change: (block: RichMessageBlock) => RichMessageBlock) => {
    setBlocks((blocks) => blocks.map((block, at) => (at === index ? change(block) : block)))
  }
  const move = (from: number, to: number | undefined) => {
    setBlocks((blocks) => {
      const [block] = blocks.splice(from, 1)
      if (block && to !== undefined) blocks.splice(to, 0, block)
      return blocks
    })
  }
  return (
    <FormSection title="Rich message">
      <ol className="grid gap-3">
        {rich.blocks.map((block, index) => (
          <li key={index} className="grid gap-2 rounded-md border p-2">
            <div className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-callout">
                {`${String(index + 1)}. ${LABELS[block.type]}`}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move block ${String(index + 1)} up`}
                disabled={index === 0}
                onClick={() => {
                  move(index, index - 1)
                }}
              >
                <ArrowUpIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move block ${String(index + 1)} down`}
                disabled={index === rich.blocks.length - 1}
                onClick={() => {
                  move(index, index + 1)
                }}
              >
                <ArrowDownIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove block ${String(index + 1)}`}
                disabled={rich.blocks.length <= 1}
                onClick={() => {
                  move(index, undefined)
                }}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
            {block.type === 'buttons' ? (
              <RichButtons stepId={step.id} index={index} row={block} />
            ) : (
              <BlockEditor
                block={block}
                onChange={(change) => {
                  setBlock(index, change)
                }}
              />
            )}
          </li>
        ))}
      </ol>
      <Select<BlockType>
        items={BLOCKS}
        value={null}
        onValueChange={(type) => {
          if (type === 'buttons') {
            // A row with its first button, whose popover opens.
            const id = edits.keyboard.addRow({ rich: step.id }, undefined, NEW_LABEL)
            if (id !== undefined) selection.set({ button: id })
          } else if (type !== null) setBlocks((blocks) => [...blocks, newBlock(type)])
        }}
      >
        <SelectTrigger size="sm" aria-label="Add a block" className="justify-self-start">
          <PlusIcon aria-hidden data-icon="inline-start" />
          <SelectValue placeholder="Add a block" />
        </SelectTrigger>
        <SelectContent>
          {BLOCKS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SwitchRow
        label="Right to left"
        checked={rich.rtl === true}
        onChange={(rtl) => {
          update((now) => (now.type === 'rich' ? { ...now, rtl: rtl ? true : undefined } : undefined))
        }}
      />
    </FormSection>
  )
}

type Change = (change: (block: RichMessageBlock) => RichMessageBlock) => void

/** A block's texts and settings. */
function BlockEditor({ block, onChange }: { block: RichMessageBlock; onChange: Change }): ReactNode {
  const set = <B extends RichMessageBlock>(fields: Partial<B>) => {
    onChange((now) => (now.type === block.type ? { ...now, ...fields } : now))
  }
  switch (block.type) {
    case 'paragraph':
    case 'footer':
    case 'code':
      return <BubbleText text={block.text} />
    case 'heading':
      return (
        <>
          <BubbleText text={block.text} />
          <Field label="Size" hint="1 is the largest.">
            {() => (
              <Choice
                label="Size"
                value={String(block.size)}
                options={SIZES}
                onChange={(size) => {
                  set({ size: Number(size) })
                }}
              />
            )}
          </Field>
        </>
      )
    case 'quote':
      return (
        <>
          <BubbleText text={block.text} />
          <SwitchRow
            label="Expandable"
            checked={block.expandable === true}
            onChange={(expandable) => {
              set({ expandable: expandable ? true : undefined })
            }}
          />
        </>
      )
    case 'list':
      return <ListEditor list={block} onChange={onChange} />
    case 'table':
      return <TableEditor table={block} onChange={onChange} />
    case 'details':
      return (
        <>
          <Field label="Title" hint="Always shown; a tap opens the text under it.">
            {() => <BubbleText text={block.summary} />}
          </Field>
          <BubbleText text={block.text} />
          <SwitchRow
            label="Shown open"
            checked={block.open === true}
            onChange={(open) => {
              set({ open: open ? true : undefined })
            }}
          />
        </>
      )
    case 'media':
      return (
        <>
          <MediaSource
            kinds={MEDIA_KINDS}
            slot={block.media}
            wrongKind="A rich message takes photos, videos, GIFs, audio, voice messages and files."
            onPick={(media) => {
              set({ media })
            }}
          />
          <SwitchRow
            label="Hide under a spoiler"
            checked={block.spoiler === true}
            onChange={(spoiler) => {
              set({ spoiler: spoiler ? true : undefined })
            }}
          />
        </>
      )
    case 'divider':
    case 'buttons':
      return null
  }
}

/**
 * A button row inside the message (RICH-02): its buttons, a click opening BTN-01's popover beside
 * the button (also after a click on its pill on the map); "+" adds a button, up to the catalog's
 * 8. The popover's "Delete button" on the row's last button removes the row.
 */
function RichButtons({ stepId, index, row }: { stepId: StepId; index: number; row: ButtonRow }) {
  const design = useDesign()
  const lang = useLang()
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const selected = useSelection((s) => s.button)
  const anchors = useRef(new Map<string, HTMLElement>())
  const buttons = row.ids.flatMap((id) => design.buttons[id] ?? [])
  const full = row.ids.length >= perRow.max
  const tip = full ? `A row holds at most ${String(perRow.max)} buttons.` : 'Add a button'
  const popoverButton = selected !== null && row.ids.includes(selected) ? design.buttons[selected] : undefined
  return (
    <>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Buttons inside the message">
        {buttons.map((button) => {
          const text = buttonText(button, design, lang)
          return (
            <Button
              key={button.id}
              ref={(element: HTMLElement | null) => {
                if (element) anchors.current.set(button.id, element)
                else anchors.current.delete(button.id)
              }}
              variant={selected === button.id ? 'soft' : 'outline'}
              size="sm"
              className="max-w-full min-w-0"
              data-button={button.id}
              onClick={() => {
                selection.set({ button: button.id })
              }}
            >
              <span dir="auto" className={text === '' ? 'truncate opacity-60' : 'truncate'}>
                {text === '' ? 'No text' : text}
              </span>
            </Button>
          )
        })}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={tip}
          title={tip}
          disabled={full}
          onClick={() => {
            const id = edits.keyboard.addButton({ rich: stepId }, index, undefined, NEW_LABEL)
            if (id !== undefined) selection.set({ button: id })
          }}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
      <ButtonPopover
        button={popoverButton}
        stepId={stepId}
        anchor={() => (selected === null ? null : (anchors.current.get(selected) ?? null))}
        close={() => {
          selection.set({ button: null })
        }}
      />
    </>
  )
}

type List = Extract<RichMessageBlock, { type: 'list' }>

function ListEditor({ list, onChange }: { list: List; onChange: Change }) {
  const setItems = (change: (items: List['items']) => List['items']) => {
    onChange((now) => (now.type === 'list' ? { ...now, items: change([...now.items]) } : now))
  }
  return (
    <>
      <ol className="grid gap-1">
        {list.items.map((item, index) => (
          <li key={item.text.id} className="flex min-w-0 items-start gap-1">
            <span className="w-5 shrink-0 pt-2 text-end text-footnote text-fg-3 tabular-nums">
              {list.ordered ? `${String(index + 1)}.` : '•'}
            </span>
            <div className="min-w-0 flex-1">
              <BubbleText text={item.text} />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove item ${String(index + 1)}`}
              disabled={list.items.length <= 1}
              onClick={() => {
                setItems((items) => items.filter((_, at) => at !== index))
              }}
            >
              <XIcon aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          setItems((items) => [...items, { text: text() }])
        }}
      >
        <PlusIcon aria-hidden data-icon="inline-start" />
        Add an item
      </Button>
      <SwitchRow
        label="Numbered"
        checked={list.ordered}
        onChange={(ordered) => {
          onChange((now) => (now.type === 'list' ? { ...now, ordered } : now))
        }}
      />
    </>
  )
}

type Table = Extract<RichMessageBlock, { type: 'table' }>

/** A table as cells: each cell's text in a bubble, rows and columns added and removed at the end. */
function TableEditor({ table, onChange }: { table: Table; onChange: Change }) {
  const width = Math.max(0, ...table.rows.map((row) => row.cells.length))
  const setRows = (change: (rows: Table['rows']) => Table['rows']) => {
    onChange((now) => (now.type === 'table' ? { ...now, rows: change(now.rows) } : now))
  }
  const header = table.rows[0]?.cells.some((cell) => cell.header === true) ?? false
  return (
    <>
      <div
        className="grid gap-1 overflow-x-auto"
        style={{ gridTemplateColumns: `repeat(${String(width)}, minmax(8rem, 1fr))` }}
      >
        {table.rows.flatMap((row) => row.cells.map((cell) => <BubbleText key={cell.text.id} text={cell.text} />))}
      </div>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRows((rows) => [
              ...rows,
              { cells: Array.from({ length: Math.max(width, 1) }, () => ({ text: text() })) },
            ])
          }}
        >
          <PlusIcon aria-hidden data-icon="inline-start" />
          Add a row
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={width >= columns.max}
          onClick={() => {
            setRows((rows) =>
              rows.map((row, index) => ({
                cells: [...row.cells, { text: text(), ...(index === 0 && header ? { header: true } : {}) }],
              })),
            )
          }}
        >
          <PlusIcon aria-hidden data-icon="inline-start" />
          Add a column
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={table.rows.length <= 1}
          onClick={() => {
            setRows((rows) => rows.slice(0, -1))
          }}
        >
          Remove the last row
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={width <= 1}
          onClick={() => {
            setRows((rows) => rows.map((row) => ({ cells: row.cells.slice(0, width - 1) })))
          }}
        >
          Remove the last column
        </Button>
      </div>
      <SwitchRow
        label="First row is a header"
        checked={header}
        onChange={(on) => {
          setRows((rows) =>
            rows.map((row, index) =>
              index === 0
                ? { cells: row.cells.map((cell) => ({ text: cell.text, ...(on ? { header: true } : {}) })) }
                : row,
            ),
          )
        }}
      />
      <SwitchRow
        label="Borders"
        checked={table.bordered === true}
        onChange={(bordered) => {
          onChange((now) => (now.type === 'table' ? { ...now, bordered: bordered ? true : undefined } : now))
        }}
      />
    </>
  )
}
