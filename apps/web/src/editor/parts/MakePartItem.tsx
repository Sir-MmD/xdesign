import type { Step } from '@xdesign/spec'
import { PuzzleIcon } from 'lucide-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

import { hasOwnButtons, useMakePart } from './make'

/**
 * The box menu's "Make a part from its buttons" (04 section 4.3) on messages and questions: the
 * box's own button rows become a row part in its place, and the part editor opens. Off while the
 * box has no buttons of its own.
 */
export function MakePartItem({ step }: { step: Step }) {
  const make = useMakePart()
  if (step.kind !== 'message' && step.kind !== 'question') return null
  return (
    <DropdownMenuItem
      disabled={!hasOwnButtons(step)}
      onClick={() => {
        make.fromButtons(step)
      }}
    >
      <PuzzleIcon aria-hidden />
      Make a part from its buttons
    </DropdownMenuItem>
  )
}
