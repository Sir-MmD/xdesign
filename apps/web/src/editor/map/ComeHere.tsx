import type { Step } from '@xdesign/spec'
import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useDesign, useLang } from '../context'
import { useMapActions } from './actions'
import { deriveArrows } from './arrows'
import { arrowLabel } from './lines'
import { useComeHere } from './shown'

/**
 * The pill "<N> come here" in a box's header (docs/plan/18 section 5.2, MAP-11), while any line
 * into the box is drawn as a short tag; N counts every line in. A click opens "Comes here from",
 * a row per line in (the source step's title and the button's or the outcome's label); a row
 * jumps to that step and selects it (MapPane.tsx's `jump`, with "Back").
 *
 * The menu is made the first time it opens, then opened a frame later so it comes in as usual:
 * until then a box draws only a plain button (PERF-01, as BoxMenu.tsx).
 */
export function ComeHere({ step }: { step: Step }) {
  const count = useComeHere(step.id)
  const [open, setOpen] = useState(false)
  const [made, setMade] = useState(false)
  if (count === 0) return null
  const label = `${String(count)} come here`
  if (!made) {
    return (
      <button
        type="button"
        className={pillClass}
        onClick={() => {
          setMade(true)
          requestAnimationFrame(() => {
            setOpen(true)
          })
        }}
      >
        {label}
      </button>
    )
  }
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<button type="button" className={pillClass} />}>{label}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Comes here from</DropdownMenuLabel>
          <ComeHereItems step={step} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const pillClass =
  'nodrag shrink-0 rounded-full border bg-surface-2 px-1.5 text-caption-2 font-medium whitespace-nowrap text-fg-2 outline-none hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid data-popup-open:border-brand data-popup-open:text-brand'

// The rows, made only while the menu is open (the design is read then), in map order (left to
// right, then top to bottom, as search lists them).
function ComeHereItems({ step }: { step: Step }) {
  const design = useDesign()
  const lang = useLang()
  const { jump } = useMapActions()
  const lines = deriveArrows(design, lang)
    .filter((arrow) => arrow.to === step.id)
    .sort((a, b) => a.from.x - b.from.x || a.from.y - b.from.y)
  return lines.map((arrow) => (
    <DropdownMenuItem
      key={arrow.id}
      onClick={() => {
        jump(arrow.from.id)
      }}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span dir="auto" className="min-w-0 shrink truncate font-medium">
          {arrow.from.title}
        </span>
        <span aria-hidden className="text-fg-3">
          ·
        </span>
        <span dir="auto" className="min-w-0 shrink-[2] truncate text-fg-2">
          {arrowLabel(arrow)}
        </span>
      </span>
    </DropdownMenuItem>
  ))
}
