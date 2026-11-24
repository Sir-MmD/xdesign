import type { NodeProps } from '@xyflow/react'

import { exitsOf } from '../arrows'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, Exits, Summary } from './Box'

/**
 * A developer step (04 sections 4.3 and 6): the first line of what the developer does, the
 * variables it gives back, and a dot per outcome ("Done").
 */
export function DevStepBox({ data, selected }: NodeProps<KindNode<'devStep'>>) {
  const { step } = data
  const gives = useShown(step, (design) => step.sets.flatMap((id) => design.variables[id]?.idName ?? []))
  const line =
    step.description
      .split('\n')
      .map((text) => text.trim())
      .find((text) => text !== '') ?? ''
  return (
    <BoxShell step={step} selected={selected}>
      {line === '' ? null : <Summary>{line}</Summary>}
      {gives.length === 0 ? null : <Summary muted>{`Gives back ${gives.join(', ')}`}</Summary>}
      <Exits exits={exitsOf(step)} />
    </BoxShell>
  )
}
