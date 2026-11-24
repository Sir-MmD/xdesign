// The box renderer of each step kind (docs/plan/04 section 4.3), one file per kind, for React
// Flow's nodeTypes (a node's type is its step's kind).
import type { StepKind } from '@xdesign/spec'
import type { NodeTypes } from '@xyflow/react'

import { ActionBox } from './ActionBox'
import { DevStepBox } from './DevStepBox'
import { EndBox } from './EndBox'
import { FrameBox } from './FrameBox'
import { GoToBox } from './GoToBox'
import { IfBox } from './IfBox'
import { InvoiceBox } from './InvoiceBox'
import { MessageBox } from './MessageBox'
import { NoteBox } from './NoteBox'
import { QuestionBox } from './QuestionBox'
import { RememberBox } from './RememberBox'
import { StartBox } from './StartBox'
import { WaitBox } from './WaitBox'

export const boxTypes = {
  start: StartBox,
  message: MessageBox,
  question: QuestionBox,
  if: IfBox,
  remember: RememberBox,
  wait: WaitBox,
  devStep: DevStepBox,
  goTo: GoToBox,
  end: EndBox,
  note: NoteBox,
  frame: FrameBox,
  invoice: InvoiceBox,
  action: ActionBox,
} satisfies Record<StepKind, NodeTypes[string]>
