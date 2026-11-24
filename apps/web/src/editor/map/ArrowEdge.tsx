import { BaseEdge, type Edge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react'
import { BellIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { cn } from '@/lib/utils'

import { useTaken } from '../try/path'
import type { Tag } from './lines'

/**
 * What an arrow's label shows: its name (lines.ts, shown while it is lit or hovered), how a
 * button's click shows its target, a popup, a Go to's jump; `lit` while it is drawn bold. A `tag`
 * edge (TagEdge.tsx) draws the short tags of a row of its box (`tags`, MAP-11) in place of lines.
 */
export type ArrowData = {
  label: string
  lit: boolean
  show?: 'edit' | 'new' | 'replace'
  popup?: boolean
  jump?: boolean
  tags?: readonly Tag[]
}
export type ArrowEdgeType = Edge<ArrowData, 'arrow' | 'tag'>

const SHOW_WORDS = { edit: 'Edit', new: 'New', replace: 'Replace' } as const

const takenStyle = { stroke: 'var(--brand)', strokeWidth: 2.5 }

// A named label lies over every line, the lit ones too (lines.ts raises them to 1000 and more).
const namedStyle = { zIndex: 3000 }

/**
 * An arrow of the map (04 section 4.3): a curve from a dot to a box, labeled "Edit", "New" or
 * "Replace" for a button's click with a small bell for its popup; a Go to box's arrow is dashed.
 * Lit (MAP-10, lines.ts) or under the pointer, its label names it on a pill of the map's
 * background: the button's text or the outcome's name, with the click mode and the bell. In Try
 * it the arrows taken are drawn in the brand color (TRY-02).
 */
export function ArrowEdge({
  id,
  source,
  target,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<ArrowEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const [hovered, setHovered] = useState(false)
  const show = data?.show
  const lit = data?.lit === true
  const taken = useTaken(source, sourceHandleId, target)
  const at = `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`
  let label: ReactNode = null
  if (lit || hovered) {
    label = (
      <div
        style={{ ...namedStyle, transform: at }}
        className="xd-arrow-label xd-lit pointer-events-none absolute flex items-center gap-1 rounded-full border border-brand bg-background px-1.5 text-caption-2 font-medium whitespace-nowrap text-foreground"
      >
        <span dir="auto">{data?.label}</span>
        {show === undefined ? null : <span className="font-normal text-fg-2">· {SHOW_WORDS[show]}</span>}
        {data?.popup ? <BellIcon aria-label="Popup" className="size-2.5 shrink-0" /> : null}
      </div>
    )
  } else if (show !== undefined) {
    label = (
      <div
        style={{ transform: at }}
        className="xd-arrow-label pointer-events-none absolute flex items-center gap-0.5 rounded-full border bg-surface px-1.5 text-caption-2 text-fg-2"
      >
        {SHOW_WORDS[show]}
        {data?.popup ? <BellIcon aria-label="Popup" className="size-2.5" /> : null}
      </div>
    )
  }
  return (
    <>
      <g
        onPointerEnter={() => {
          setHovered(true)
        }}
        onPointerLeave={() => {
          setHovered(false)
        }}
      >
        <BaseEdge
          id={id}
          path={path}
          markerEnd={markerEnd}
          className={cn(data?.jump && 'xd-jump')}
          style={taken ? takenStyle : undefined}
          interactionWidth={16}
        />
      </g>
      {label ? <EdgeLabelRenderer>{label}</EdgeLabelRenderer> : null}
    </>
  )
}
