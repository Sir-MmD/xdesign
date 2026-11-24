// The rows of a keyboard edited on the phone (docs/plan/04 section 5.3): an inline keyboard under
// the bubble or the bottom keyboard, drawn with the look's own classes as the preview draws them
// (Q-28), each button in its look through the preview's TelegramButtonFace. A click opens the
// button's popover; buttons are dragged within and between rows (dnd-kit) or onto "+ row" for a
// row of their own; "+" at a row's end adds a button, "+ row" adds a row, both gone at the
// catalog's limits with a tip. A row part shows its rows in a dashed outline with its name, whose
// menu has "Edit the part" and "Detach". PARTS-01's part editor edits a row part's own rows here.
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TelegramButtonFace } from '@xdesign/preview'
import type { Button, KeyboardAt, Row, StepId } from '@xdesign/spec'
import { type ReactNode, type SyntheticEvent, useRef, useState } from 'react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { useDesign, useEditor, useLang } from '../../context'
import { isSending, rowsOf } from '../../map/arrows'
import type { PartDrop } from '../../parts/drop'
import { useOpenPart } from '../../parts/store'
import { useSelection, useSelectionStore } from '../../selection'
import { ButtonPopover } from './ButtonPopover'
import { buttonLimits, NEW_LABEL, payAsLink } from './model'
import { adoptKeyboardSheet } from './sheet'

type Place = 'inline' | 'reply'

// The droppable IDs besides the buttons' own: each row (its empty end) and "+ row".
const NEW_ROW = ':new-row'
const rowKey = (index: number) => `:row:${String(index)}`

// The look's classes of each place, as the preview draws the keyboard.
const CLASSES = {
  inline: { row: 'tg-kb-row', button: 'tg-kb-button' },
  reply: { row: 'tg-rk-row', button: 'tg-rk-button' },
}

/** Joins class names; the look's classes stay as they are (no Tailwind merging in the phone). */
function classes(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}

/** A button's classes in its look (the preview writes the look as the style's class). */
function buttonClass(place: Place, button: Button): string {
  return classes(CLASSES[place].button, button.look !== 'default' && button.look)
}

/** What an inline button does, for the look's stylesheet and its mark (the preview's `data-kind`). */
function kindOf(button: Button): string | undefined {
  if (button.place !== 'inline') return undefined
  switch (button.action.type) {
    case 'url':
    case 'loginUrl':
      return 'url'
    case 'copyText':
      return 'copy'
    default:
      return 'callback'
  }
}

// The button under the pointer first, then a row's empty end or "+ row", then the closest.
const collide: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  const button = within.find((hit) => !String(hit.id).startsWith(':'))
  if (button) return [button]
  const first = within[0]
  return first ? [first] : closestCenter(args)
}

// Presses on the row's "+" and the limit's tip stay theirs: no drag, no popover.
const keep = (event: SyntheticEvent) => {
  event.stopPropagation()
}

function rowOf(list: readonly (readonly string[])[], id: string): number {
  return list.findIndex((row) => row.includes(id))
}

/**
 * The editable rows of a step's inline keyboard (in the bubble's slot, followed by "+ row") or
 * bottom keyboard (the whole panel, `resize` as the keyboard's option), with the popover of the
 * selected button; or of a row part (`at` the part, its rows as `buttons` rows). The bottom
 * keyboard's panel takes row parts dropped from the palette (`drop`).
 */
export function KeyboardRows({
  at,
  place,
  rows,
  resize = false,
  drop,
}: {
  at: KeyboardAt
  place: Place
  rows: readonly Row[]
  resize?: boolean
  drop?: PartDrop | undefined
}) {
  const design = useDesign()
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const selected = useSelection((s) => s.button)
  // While a button is dragged: the button IDs of each row with the button where it would land.
  const drag = useRef<string[][] | null>(null)
  const [order, setOrder] = useState<string[][] | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const anchors = useRef(new Map<string, HTMLElement>())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const stepId = 'step' in at ? at.step : undefined
  const saved = rows.map((row) => (row.type === 'buttons' ? [...row.ids] : []))
  const ids = order ?? saved
  const limits = buttonLimits(place)
  const step = stepId === undefined ? undefined : design.steps[stepId]
  const part = 'part' in at ? design.parts[at.part] : undefined
  let total = 0
  if (isSending(step)) total = rowsOf(design, step).flat().length
  else if (part?.kind === 'rows') total = part.rows.flat().length
  // A subscription's pay button is a link to its invoice (PAY-02).
  const face = (button: Button) => (step?.kind === 'invoice' ? payAsLink(step, button) : button)
  const full = total >= limits.all
  const fullTip = `A keyboard holds at most ${String(limits.all)} buttons.`
  const rowTip = `A row holds at most ${String(limits.row)} buttons.`

  const open = (id: string) => {
    selection.set({ button: id })
  }
  const register = (id: string, element: HTMLElement | null) => {
    if (element) anchors.current.set(id, element)
    else anchors.current.delete(id)
  }
  const addButton = (row: number) => {
    const id = edits.keyboard.addButton(at, row, undefined, NEW_LABEL)
    if (id !== undefined) open(id)
  }
  const addRow = () => {
    if (full) return
    const id = edits.keyboard.addRow(at, undefined, NEW_LABEL)
    if (id !== undefined) open(id)
  }

  const onDragStart = ({ active: start }: DragStartEvent) => {
    drag.current = saved
    setOrder(saved)
    setActive(String(start.id))
    selection.set({ button: null })
  }
  // Into another row: the button moves there at once, so the rows make room for it.
  const onDragOver = ({ active: moving, over }: DragOverEvent) => {
    const list = drag.current
    if (!over || !list) return
    const id = String(moving.id)
    const overId = String(over.id)
    if (overId === NEW_ROW) return
    const onRow = overId.startsWith(':row:')
    const from = rowOf(list, id)
    const to = onRow ? Number(overId.slice(':row:'.length)) : rowOf(list, overId)
    const target = list[to]
    if (from < 0 || !target || from === to || rows[to]?.type !== 'buttons' || target.length >= limits.row) return
    const index = onRow ? target.length : target.indexOf(overId)
    drag.current = list.map((row, i) => {
      if (i === from) return row.filter((item) => item !== id)
      return i === to ? [...row.slice(0, index), id, ...row.slice(index)] : row
    })
    setOrder(drag.current)
  }
  const onDragEnd = ({ active: moved, over }: DragEndEvent) => {
    const list = drag.current
    drag.current = null
    setOrder(null)
    setActive(null)
    if (!over || !list) return
    const id = String(moved.id)
    if (String(over.id) === NEW_ROW) {
      edits.keyboard.moveButton(at, id, rows.length, 0)
      return
    }
    const to = rowOf(list, id)
    let row = list[to]
    if (!row) return
    const overIndex = row.indexOf(String(over.id))
    if (overIndex >= 0) row = arrayMove(row, row.indexOf(id), overIndex)
    const index = row.indexOf(id)
    const from = rowOf(saved, id)
    if (from === to && saved[from]?.indexOf(id) === index) return
    // `to` counts the rows before the move: the dragged rows keep an emptied row in its place.
    edits.keyboard.moveButton(at, id, to, index)
  }
  const onDragCancel = () => {
    drag.current = null
    setOrder(null)
    setActive(null)
  }

  const moving = order !== null
  const rowNodes = rows.map((row, index) => {
    if (row.type === 'part') {
      return stepId === undefined ? null : (
        <PartRows key={`${String(index)}:${row.part}`} stepId={stepId} partId={row.part} place={place} />
      )
    }
    const rowIds = ids[index] ?? []
    const shown = rowIds.flatMap((id) => {
      const button = design.buttons[id]
      return button?.place === place ? [button] : []
    })
    const end = full ? (
      <Limit tip={fullTip} />
    ) : rowIds.length >= limits.row ? (
      <Limit tip={rowTip} />
    ) : (
      <AddButton
        add={() => {
          addButton(index)
        }}
      />
    )
    return (
      <ButtonsRow key={index} index={index} ids={rowIds} place={place}>
        {shown.map((button, position) => (
          <SortableButton
            key={button.id}
            button={face(button)}
            place={place}
            selected={selected === button.id}
            register={register}
            open={open}
          >
            {position === shown.length - 1 ? end : null}
          </SortableButton>
        ))}
      </ButtonsRow>
    )
  })
  const newRow = <NewRow full={full} tip={fullTip} add={addRow} />
  const activeButton = active === null ? undefined : design.buttons[active]
  const popoverButton =
    selected !== null && !moving && saved.some((row) => row.includes(selected)) ? design.buttons[selected] : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {place === 'inline' ? (
        <>
          <div
            className={classes('tg-keyboard', moving && 'xd-kb-moving')}
            role="group"
            aria-label="Buttons of the message"
          >
            {rowNodes}
          </div>
          {newRow}
        </>
      ) : (
        <div
          ref={adoptKeyboardSheet}
          className={classes(
            'tg-reply-keyboard',
            resize && 'resized',
            'xd-kb',
            'xd-kb-reply',
            moving && 'xd-kb-moving',
            drop?.over && 'xd-part-over',
          )}
          role="group"
          aria-label="Bottom keyboard"
          {...drop?.handlers}
        >
          {rowNodes}
          {newRow}
        </div>
      )}
      <DragOverlay>
        {activeButton ? <ButtonBox button={face(activeButton)} place={place} className="xd-kb-overlay" /> : null}
      </DragOverlay>
      <ButtonPopover
        button={popoverButton}
        stepId={stepId}
        anchor={() => (selected === null ? null : (anchors.current.get(selected) ?? null))}
        close={() => {
          selection.set({ button: null })
        }}
      />
    </DndContext>
  )
}

/** A row of buttons: a sortable list, and a drop place at its end for buttons from other rows. */
function ButtonsRow({
  index,
  ids,
  place,
  children,
}: {
  index: number
  ids: string[]
  place: Place
  children: ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: rowKey(index) })
  return (
    <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
      <div ref={setNodeRef} className={CLASSES[place].row}>
        {children}
      </div>
    </SortableContext>
  )
}

/** A button as the look draws it, not sortable: the dragged copy, a row part's button. */
function ButtonBox({
  button,
  place,
  className,
  onClick,
}: {
  button: Button
  place: Place
  className?: string
  onClick?: () => void
}) {
  const design = useDesign()
  const lang = useLang()
  return (
    <span
      className={classes(buttonClass(place, button), className)}
      data-kind={kindOf(button)}
      data-button={button.id}
      onClick={onClick}
    >
      <TelegramButtonFace button={button} lang={lang} fallback={design.languages.default} />
    </span>
  )
}

/** A button of the keyboard: dragged to move it, clicked (or Enter) to open its popover. */
function SortableButton({
  button,
  place,
  selected,
  register,
  open,
  children,
}: {
  button: Button
  place: Place
  selected: boolean
  register: (id: string, element: HTMLElement | null) => void
  open: (id: string) => void
  children: ReactNode
}) {
  const design = useDesign()
  const lang = useLang()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: button.id })
  return (
    <span
      ref={(element) => {
        setNodeRef(element)
        register(button.id, element)
      }}
      className={classes(buttonClass(place, button), selected && 'xd-kb-selected', isDragging && 'xd-kb-dragging')}
      data-kind={kindOf(button)}
      // The comments' pins find the button by it (CMT-02).
      data-button={button.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => {
        open(button.id)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open(button.id)
        }
      }}
    >
      <TelegramButtonFace button={button} lang={lang} fallback={design.languages.default} />
      {children}
    </span>
  )
}

/** The "+" at a row's end: a new button there, its popover open. */
function AddButton({ add }: { add: () => void }) {
  return (
    <button
      type="button"
      className="xd-kb-add"
      aria-label="Add a button"
      title="Add a button"
      onPointerDown={keep}
      onKeyDown={keep}
      onClick={(event) => {
        event.stopPropagation()
        add()
      }}
    >
      +
    </button>
  )
}

/** In the "+"'s place at a limit: why it is gone. */
function Limit({ tip }: { tip: string }) {
  return (
    <span className="xd-kb-limit" role="img" aria-label={tip} title={tip} onPointerDown={keep} onClick={keep}>
      i
    </span>
  )
}

/** "+ row" under the last row: a new row with a new button; a dragged button dropped here gets a row of its own. */
function NewRow({ full, tip, add }: { full: boolean; tip: string; add: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: NEW_ROW })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={classes('xd-kb-new-row', isOver && 'over')}
      aria-disabled={full || undefined}
      title={full ? tip : undefined}
      onClick={add}
    >
      + row
    </button>
  )
}

/**
 * A row part placed in the keyboard: its rows in a dashed outline with its name; the name (or a
 * click on its buttons) opens its menu: "Edit the part" (PARTS-01's part editor) and "Detach"
 * (its buttons become this keyboard's own copies).
 */
function PartRows({ stepId, partId, place }: { stepId: StepId; partId: string; place: Place }) {
  const design = useDesign()
  const { edits } = useEditor()
  const openPart = useOpenPart()
  const [open, setOpen] = useState(false)
  const part = design.parts[partId]
  if (part?.kind !== 'rows') return null
  const rows = part.rows
    .map((ids) =>
      ids.flatMap((id) => {
        const button = design.buttons[id]
        return button?.place === place ? [button] : []
      }),
    )
    .filter((row) => row.length > 0)
  return (
    <div className="xd-part">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<button type="button" className="xd-part-name" title={part.name} />}>
          {part.name}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuItem
            onClick={() => {
              openPart(partId)
            }}
          >
            Edit the part
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              edits.parts.detach(stepId, partId)
            }}
          >
            Detach
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {rows.map((row, index) => (
        <div key={index} className={CLASSES[place].row}>
          {row.map((button, position) => (
            <ButtonBox
              key={`${button.id}-${String(position)}`}
              button={button}
              place={place}
              onClick={() => {
                setOpen(true)
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
