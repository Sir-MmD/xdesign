import { NodeResizer, type NodeProps } from '@xyflow/react'
import { FrameIcon } from 'lucide-react'

import { useEditor } from '../../context'
import { useMapActions } from '../actions'
import { BoxMenu } from '../BoxMenu'
import { mapColor, tint } from '../colors'
import type { KindNode } from '../nodes'

/**
 * A section (04 section 4.3): a frame of its color with its title, moved by its title bar and
 * resized by its edges once selected; the steps dropped inside belong to it and move with it.
 * Clicks on the rest of it reach the map, so steps can be dropped and arrows drawn there.
 */
export function FrameBox({ data, selected }: NodeProps<KindNode<'frame'>>) {
  const { step } = data
  const { readOnly } = useEditor()
  const { resized } = useMapActions()
  const color = mapColor(step.color)
  return (
    <>
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={240}
        minHeight={160}
        color={color}
        onResizeEnd={(_event, box) => {
          resized(step.id, box)
        }}
      />
      <div
        style={{ backgroundColor: tint(color, 7), borderColor: tint(color, 45) }}
        className="h-full w-full rounded-2xl border-2"
      >
        <div
          style={{ backgroundColor: tint(color, 16) }}
          className="xd-frame-head group/box flex h-9 items-center gap-2 rounded-t-[14px] ps-3 pe-1.5 text-callout"
        >
          <FrameIcon aria-hidden className="size-4 shrink-0 text-fg-3" />
          <span dir="auto" className="min-w-0 flex-1 truncate font-semibold">
            {step.title}
          </span>
          {readOnly ? null : <BoxMenu step={step} />}
        </div>
      </div>
    </>
  )
}
