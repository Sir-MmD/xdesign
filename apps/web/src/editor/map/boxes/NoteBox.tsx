import type { NodeProps } from '@xyflow/react'
import { StickyNoteIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useEditor } from '../../context'
import { BoxMenu } from '../BoxMenu'
import { mapColor, tint } from '../colors'
import type { KindNode } from '../nodes'

/** A sticky note for the team (04 sections 4.3 and 6): its text on paper of its color; no arrows. */
export function NoteBox({ data, selected }: NodeProps<KindNode<'note'>>) {
  const { step } = data
  const { readOnly } = useEditor()
  const color = mapColor(step.color)
  return (
    <div
      style={{ backgroundColor: tint(color, 22), borderColor: tint(color, 55) }}
      className={cn(
        'group/box w-50 rounded-md border text-callout shadow-(--shadow-sm)',
        selected && 'outline-2 outline-brand/40 outline-solid',
      )}
    >
      <div className="flex min-h-8 items-center gap-2 ps-3 pe-1.5">
        <StickyNoteIcon aria-hidden className="size-4 shrink-0 text-fg-3" />
        <span dir="auto" className="min-w-0 flex-1 truncate font-semibold">
          {step.title}
        </span>
        {readOnly ? null : <BoxMenu step={step} />}
      </div>
      <p
        dir="auto"
        className={cn(
          'line-clamp-6 px-3 pb-3 text-subhead whitespace-pre-wrap',
          step.text.trim() === '' && 'text-fg-3',
        )}
      >
        {step.text.trim() === '' ? 'Empty note' : step.text}
      </p>
    </div>
  )
}
