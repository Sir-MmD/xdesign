import { sayCondition } from '@xdesign/spec'
import { Handle, type NodeProps, Position } from '@xyflow/react'

import { exitsOf, handles } from '../arrows'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell } from './Box'

/**
 * An If box (04 sections 4.3 and 6): a dot per case in order, labeled with its name ("Yes") over
 * its condition in words (EXP-01's sayCondition), and "Otherwise".
 */
export function IfBox({ data, selected }: NodeProps<KindNode<'if'>>) {
  const { step } = data
  const said = useShown(step, (design) => step.cases.map((item) => sayCondition(item.when, design)))
  const conditions = new Map(step.cases.map((item, index) => [handles.case(item.id), said[index]]))
  return (
    <BoxShell step={step} selected={selected}>
      <div className="border-t py-1">
        {exitsOf(step).map((exit) => {
          const when = conditions.get(exit.handle)
          return (
            <div
              key={exit.handle}
              className="relative flex min-h-6 flex-col items-end justify-center px-3 py-0.5 text-footnote text-fg-2"
            >
              <span dir="auto" className="max-w-full truncate">
                {exit.label}
              </span>
              {when === undefined ? null : <span className="max-w-full truncate text-caption text-fg-3">{when}</span>}
              <Handle type="source" position={Position.Right} id={exit.handle} className="xd-dot" />
            </div>
          )
        })}
      </div>
    </BoxShell>
  )
}
