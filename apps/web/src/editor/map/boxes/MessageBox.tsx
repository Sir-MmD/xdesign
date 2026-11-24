import type { NodeProps } from '@xyflow/react'

import { exitsOf } from '../arrows'
import type { KindNode } from '../nodes'
import { BoxShell, ButtonRows, ContentSummary, Exits } from './Box'

/**
 * A message (04 section 4.3): the first line of its text in the language shown, its buttons as
 * pills in their looks with a dot each, and "Then" (on without a click).
 */
export function MessageBox({ data, selected }: NodeProps<KindNode<'message'>>) {
  const { step } = data
  return (
    <BoxShell step={step} selected={selected}>
      <ContentSummary content={step.content} />
      <ButtonRows step={step} />
      <Exits exits={exitsOf(step)} />
    </BoxShell>
  )
}
