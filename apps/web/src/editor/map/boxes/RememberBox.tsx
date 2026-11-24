import { sayRemember } from '@xdesign/spec'
import type { NodeProps } from '@xyflow/react'

import { exitsOf } from '../arrows'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, Exits, Summary } from './Box'

// The lines a box shows; more are counted.
const shownLines = 3

/**
 * A Remember box (04 sections 4.3 and 6): its first lines as sentences ("Set ... to 0", "and 2
 * more") and its "Then" dot.
 */
export function RememberBox({ data, selected }: NodeProps<KindNode<'remember'>>) {
  const { step } = data
  const lines = useShown(step, (design) =>
    step.actions.slice(0, shownLines).map((action) => sayRemember(action, design)),
  )
  const more = step.actions.length - shownLines
  return (
    <BoxShell step={step} selected={selected}>
      {step.actions.length === 0 ? (
        <Summary muted>Nothing to remember yet</Summary>
      ) : (
        <ul className="px-3 pb-2 text-subhead text-fg-2">
          {lines.map((line, index) => (
            <li key={index} dir="auto" className="truncate">
              {line}
            </li>
          ))}
          {more > 0 ? <li className="text-fg-3">{`and ${String(more)} more`}</li> : null}
        </ul>
      )}
      <Exits exits={exitsOf(step)} />
    </BoxShell>
  )
}
