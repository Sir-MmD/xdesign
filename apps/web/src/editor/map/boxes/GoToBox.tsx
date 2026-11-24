import type { NodeProps } from '@xyflow/react'

import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, Summary } from './Box'

/**
 * A Go to box (04 sections 4.3 and 6): the step it jumps to, with its dot to point it (the arrow
 * is drawn dashed); its form chooses it too.
 */
export function GoToBox({ data, selected }: NodeProps<KindNode<'goTo'>>) {
  const { step } = data
  // The title of the step it goes to, while there is one.
  const target = useShown(step, (design) =>
    step.target === undefined || step.target === 'back' ? undefined : design.steps[step.target]?.title,
  )
  return (
    <BoxShell step={step} selected={selected} out="target">
      {step.target === 'back' ? (
        <Summary>Back to the message the user came from</Summary>
      ) : target !== undefined ? (
        <Summary>{`Go to ${target}`}</Summary>
      ) : (
        <Summary muted>Nowhere yet</Summary>
      )}
    </BoxShell>
  )
}
