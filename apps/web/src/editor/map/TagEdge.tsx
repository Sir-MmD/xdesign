import { EdgeLabelRenderer, type EdgeProps, useStore } from '@xyflow/react'
import { CornerRightUpIcon } from 'lucide-react'
import { useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useTaken } from '../try/path'
import { useMapActions } from './actions'
import type { ArrowEdgeType } from './ArrowEdge'
import type { Tag } from './lines'

// The tags lie over the lines and the boxes, under the lit labels (ArrowEdge.tsx, 3000).
const tagsStyle = { zIndex: 2000 }
// How far right of the box's edge the tags start (pixels of the map): past the dots.
const TAGS_GAP = 10

/**
 * The short tags of a row of a box (docs/plan/18 section 5.2, MAP-11), in place of their lines:
 * beside the row, right of the box (a button's dot may be inside it), one pill per far line with
 * an arrow and the target's title, in the line's color (the brand color for the lines Try it
 * took). A click jumps to the target (MapPane.tsx's `jump`, with "Back"); the tooltip says
 * "Goes to <title>", with the target's section when it is in another one. lines.ts makes the
 * tags of a row one edge, its first line's.
 */
export function TagEdge({ source, sourceX, sourceY, data }: EdgeProps<ArrowEdgeType>) {
  // The right edge of the box, which moves with it.
  const right = useStore((state) => {
    const box = state.nodeLookup.get(source)
    return box?.measured.width === undefined ? sourceX : box.internals.positionAbsolute.x + box.measured.width
  })
  const at = `translate(${String(right + TAGS_GAP)}px, ${String(sourceY)}px) translateY(-50%)`
  return (
    <EdgeLabelRenderer>
      <div
        style={{ ...tagsStyle, transform: at }}
        className="xd-tags pointer-events-none absolute flex items-center gap-1 whitespace-nowrap"
      >
        {data?.tags?.map((tag) => (
          <TagPill key={tag.line} source={source} tag={tag} dashed={data.jump === true} />
        ))}
      </div>
    </EdgeLabelRenderer>
  )
}

// A tag (dashed for a Go to box's line, as the line is); its tooltip is made the first time the
// pointer comes over it (PERF-01's way: a plain button until then, many tags on a big map).
function TagPill({ source, tag, dashed }: { source: string; tag: Tag; dashed: boolean }) {
  const { jump } = useMapActions()
  const taken = useTaken(source, tag.handle, tag.to)
  const [hovered, setHovered] = useState(false)
  const className = cn(tagClass, dashed && 'border-dashed', taken ? 'border-brand text-brand' : 'border-fg-3 text-fg-2')
  const onClick = () => {
    jump(tag.to)
  }
  const inside = (
    <>
      <CornerRightUpIcon aria-hidden className="size-3 shrink-0" />
      <span dir="auto" className="truncate">
        {tag.title}
      </span>
    </>
  )
  if (!hovered) {
    return (
      <button
        type="button"
        aria-label={tag.tip}
        className={className}
        onClick={onClick}
        onPointerEnter={() => {
          setHovered(true)
        }}
      >
        {inside}
      </button>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" aria-label={tag.tip} className={className} onClick={onClick} />}>
        {inside}
      </TooltipTrigger>
      <TooltipContent>{tag.tip}</TooltipContent>
    </Tooltip>
  )
}

const tagClass =
  'nodrag nopan pointer-events-auto flex h-[18px] max-w-56 items-center gap-0.5 rounded-full border bg-background px-1.5 text-caption-2 font-medium outline-none hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid'
