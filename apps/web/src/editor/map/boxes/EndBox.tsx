import type { NodeProps } from '@xyflow/react'

import type { KindNode } from '../nodes'
import { BoxShell, Summary } from './Box'

/** An End box (04 sections 4.3 and 6): the conversation ends here; no arrow goes out. */
export function EndBox({ data, selected }: NodeProps<KindNode<'end'>>) {
  const { step } = data
  return (
    <BoxShell step={step} selected={selected}>
      <Summary muted>The conversation ends.</Summary>
    </BoxShell>
  )
}
