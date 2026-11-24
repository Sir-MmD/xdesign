import type { Part } from '@xdesign/spec'
import { KeyboardIcon, PuzzleIcon, Rows3Icon, TextIcon } from 'lucide-react'
import { useMemo } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useDesign } from '../context'
import { useSelection } from '../selection'
import { hasOwnButtons, useMakePart } from './make'
import { PartEditor } from './PartEditor'
import { PART_DRAG, usePartEditor } from './store'
import { kindWords, partUses, usesWords } from './uses'

const item =
  'flex min-h-8 items-center gap-2 rounded-md px-2 text-start text-callout transition-colors duration-(--dur-fast) ease-(--ease) outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid active:bg-surface-press'

/**
 * The palette's "PARTS" (04 section 12): each part with its name, its kind ("Buttons" or "Text")
 * and how many places use it. A click opens the part editor; a drag puts a row part on a
 * keyboard of the phone or a text part into a text. "+ Part" makes an empty part, or one from the
 * selected box's buttons. The palette places it under "Start points".
 */
export function PartsGroup() {
  const design = useDesign()
  const uses = useMemo(() => partUses(design), [design])
  const [, open] = usePartEditor()
  const parts = Object.values(design.parts).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <>
      {parts.map((part) => (
        <PartItem
          key={part.id}
          part={part}
          uses={uses.get(part.id)?.length ?? 0}
          onOpen={() => {
            open(part.id)
          }}
        />
      ))}
      <NewPart />
      <PartEditor uses={uses} />
    </>
  )
}

function PartItem({ part, uses, onOpen }: { part: Part; uses: number; onOpen: () => void }) {
  const Icon = part.kind === 'text' ? TextIcon : part.place === 'inline' ? Rows3Icon : KeyboardIcon
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        if (part.kind === 'text') {
          event.dataTransfer.setData(PART_DRAG.text, JSON.stringify({ part: part.id, text: part.text.id }))
        } else {
          event.dataTransfer.setData(PART_DRAG[part.place], part.id)
        }
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onOpen}
      className={`${item} cursor-grab py-1 active:cursor-grabbing`}
    >
      <Icon aria-hidden className="size-4 shrink-0 text-fg-3" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate" dir="auto">
          {part.name.trim() || part.idName}
        </span>
        <span className="truncate text-footnote text-fg-3">
          {kindWords(part)}, {usesWords(uses).toLowerCase()}
        </span>
      </span>
    </button>
  )
}

/** "+ Part": an empty row part (inline or bottom keyboard), an empty text part, or the selected box's buttons. */
function NewPart() {
  const design = useDesign()
  const make = useMakePart()
  const stepId = useSelection((s) => s.step)
  const step = stepId === null ? undefined : design.steps[stepId]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className={item} />}>+ Part</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem
          onClick={() => {
            make.empty('inline')
          }}
        >
          <Rows3Icon aria-hidden />
          Inline buttons
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            make.empty('reply')
          }}
        >
          <KeyboardIcon aria-hidden />
          Bottom keyboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            make.empty('text')
          }}
        >
          <TextIcon aria-hidden />
          Text
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!step || !hasOwnButtons(step)}
          onClick={() => {
            if (step) make.fromButtons(step)
          }}
        >
          <PuzzleIcon aria-hidden />
          From the selected box's buttons
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
