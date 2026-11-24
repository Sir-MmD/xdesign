// What the map draws over every box, whatever its kind (docs/plan/04 section 4.3, 05 section 4):
// the color of each other person who has it selected around it with a name tag, and the badges of
// the checks (a red dot for errors, an amber one for warnings; hover lists them), the numbered pins
// of open comment threads (CMT-02's comments/Pins.tsx), and in Try it the ring of the path (TRY-02's
// try/PathMark.tsx). MapPane.tsx renders each box through OverlaidBox,
// so the box files stay as they are.
import type { Issue } from '@xdesign/spec'
import type { NodeProps } from '@xyflow/react'
import { type ComponentType, memo, useContext, useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { BoxPins } from '../comments/Pins'
import { PathMark } from '../try/PathMark'
import { OverlayContext } from './actions'
import { boxTypes } from './boxes'
import type { StepNode } from './nodes'

/**
 * A box of any kind (its renderer in boxes/) with the overlay on top. It renders again only when
 * React Flow gives it other props (its step, selection, place or measured size, PERF-01): the box
 * re-renders by itself when what it shows of the rest of the design changes (shown.ts), the
 * overlay when the overlays do.
 */
export const OverlaidBox = memo(function OverlaidBox(props: NodeProps<StepNode>) {
  const Box = boxTypes[props.type] as ComponentType<NodeProps<StepNode>>
  return (
    <>
      <Box {...props} />
      <PathMark id={props.id} />
      <BoxOverlay id={props.id} />
    </>
  )
})

function BoxOverlay({ id }: { id: string }) {
  const { peers, issues, pins } = useContext(OverlayContext)
  const here = peers.get(id)
  const found = issues.get(id)
  const threads = pins.get(id)
  return (
    <>
      {here?.[0] ? (
        <>
          <div
            aria-hidden
            style={{ borderColor: here[0].color }}
            className="pointer-events-none absolute -inset-1.5 rounded-[18px] border-2"
          />
          <div className="pointer-events-none absolute start-0 bottom-full mb-2.5 flex max-w-full gap-1">
            {here.map((peer) => (
              <span
                key={peer.clientId}
                style={{ backgroundColor: peer.color }}
                className="truncate rounded-full px-2 py-0.5 text-caption font-semibold text-white"
              >
                {peer.name}
              </span>
            ))}
          </div>
        </>
      ) : null}
      {found && found.length > 0 ? <Badges issues={found} /> : null}
      {threads && threads.length > 0 ? <BoxPins pins={threads} /> : null}
    </>
  )
}

// The dots on the box's top right corner; hover lists the issues in plain words. The tooltip is
// made the first time the pointer comes over the dots, which are plain until then (PERF-01).
function Badges({ issues }: { issues: readonly Issue[] }) {
  const [hovered, setHovered] = useState(false)
  const errors = issues.some((issue) => issue.level === 'error')
  const warnings = issues.some((issue) => issue.level === 'warning')
  const count = issues.length
  const label = `${String(count)} ${count === 1 ? 'issue' : 'issues'}`
  const marks = (
    <>
      {errors ? <Dot className="bg-error" /> : null}
      {warnings ? <Dot className="bg-warn" /> : null}
    </>
  )
  if (!hovered) {
    return (
      <span
        role="img"
        aria-label={label}
        className={badgesClass}
        onPointerEnter={() => {
          setHovered(true)
        }}
      >
        {marks}
      </span>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span role="img" aria-label={label} className={badgesClass} />}>{marks}</TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-start">
        <ul className="flex flex-col gap-1">
          {issues.map((issue, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <Dot className={cn('mt-1', issue.level === 'error' ? 'bg-error' : 'bg-warn')} />
              <span dir="auto">{issue.message}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

const badgesClass =
  'pointer-events-auto absolute -end-1.5 -top-1.5 flex gap-0.5 rounded-full bg-surface p-0.5 shadow-(--shadow-sm)'

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn('block size-2.5 shrink-0 rounded-full', className)} />
}
