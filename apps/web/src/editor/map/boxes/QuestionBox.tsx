import type { NodeProps } from '@xyflow/react'

import { EXPECTS_ITEMS } from '../../forms/question'
import { exitsOf } from '../arrows'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, ButtonRows, ContentSummary, Exits, Summary } from './Box'

/**
 * A question (04 sections 4.3 and 6): its prompt like a message's, the prompt's buttons, the kind
 * of answer and the variable it is saved in ("Number, saved as age"), and the dots "Valid
 * answer", "Wrong N times" and "Cancel".
 */
export function QuestionBox({ data, selected }: NodeProps<KindNode<'question'>>) {
  const { step } = data
  const expects = EXPECTS_ITEMS.find((item) => item.value === step.expects)?.label ?? step.expects
  const saveTo = useShown(step, (design) => design.variables[step.saveTo]?.idName)
  return (
    <BoxShell step={step} selected={selected}>
      <ContentSummary content={step.prompt.content} />
      <ButtonRows step={step} />
      <Summary muted>{saveTo === undefined ? expects : `${expects}, saved as ${saveTo}`}</Summary>
      <Exits exits={exitsOf(step)} />
    </BoxShell>
  )
}
