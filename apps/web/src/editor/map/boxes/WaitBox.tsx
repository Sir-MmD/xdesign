import { sayCondition } from '@xdesign/spec'
import type { NodeProps } from '@xyflow/react'

import { exitsOf } from '../arrows'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, Exits, Summary } from './Box'

/**
 * A Wait box (04 sections 4.3 and 6): "Wait 2 hours", "Still goes on if the user does something"
 * when it does not stop waiting, a reminder's "Stops once <conditions>" (EVT-02), and its "Then" dot.
 */
export function WaitBox({ data, selected }: NodeProps<KindNode<'wait'>>) {
  const { step } = data
  const stops = useShown(step, (design) =>
    step.ifUserActs === 'cancel' && step.stopWhen ? sayCondition(step.stopWhen, design) : undefined,
  )
  const unit = step.amount === 1 ? step.unit.slice(0, -1) : step.unit
  return (
    <BoxShell step={step} selected={selected}>
      <Summary>{`Wait ${String(step.amount)} ${unit}`}</Summary>
      {step.ifUserActs === 'keep' ? <Summary muted>Still goes on if the user does something</Summary> : null}
      {stops === undefined ? null : <Summary muted>{`Stops once ${stops}`}</Summary>}
      <Exits exits={exitsOf(step)} />
    </BoxShell>
  )
}
