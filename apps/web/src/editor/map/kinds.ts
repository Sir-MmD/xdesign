// The step kinds as the palette, the map's boxes and its menus show them (docs/plan/04 sections
// 4.2 and 4.3): each kind's icon, the palette's "ADD" and "Start points", and the kinds "New step
// here" offers when an arrow is dropped on empty space.
import type { Step, StepKind, Trigger } from '@xdesign/spec'
import {
  BookmarkIcon,
  CodeXmlIcon,
  CornerDownRightIcon,
  FrameIcon,
  HourglassIcon,
  type LucideIcon,
  MessageCircleQuestionMarkIcon,
  MessageSquareIcon,
  OctagonXIcon,
  PlayIcon,
  ReceiptIcon,
  SplitIcon,
  StickyNoteIcon,
  ZapIcon,
} from 'lucide-react'

export const KIND_ICONS: Record<StepKind, LucideIcon> = {
  start: PlayIcon,
  message: MessageSquareIcon,
  question: MessageCircleQuestionMarkIcon,
  if: SplitIcon,
  remember: BookmarkIcon,
  wait: HourglassIcon,
  devStep: CodeXmlIcon,
  goTo: CornerDownRightIcon,
  end: OctagonXIcon,
  note: StickyNoteIcon,
  frame: FrameIcon,
  invoice: ReceiptIcon,
  action: ZapIcon,
}

/** The `/start` command start point: every design has it, so it cannot be deleted or copied. */
export function isSlashStart(step: Step): boolean {
  return step.kind === 'start' && step.trigger.type === 'command' && step.trigger.command === 'start'
}

/** A step the palette or "New step here" adds: a kind, and a start point's trigger. */
export type NewStep = { label: string; kind: StepKind; trigger?: Trigger }

/** The palette's "ADD" (04 section 4.2). */
export const ADD_STEPS: readonly NewStep[] = [
  { label: 'Message', kind: 'message' },
  { label: 'Question', kind: 'question' },
  { label: 'If', kind: 'if' },
  { label: 'Remember', kind: 'remember' },
  { label: 'Wait', kind: 'wait' },
  { label: 'Developer step', kind: 'devStep' },
  { label: 'Go to', kind: 'goTo' },
  { label: 'End', kind: 'end' },
  { label: 'Note', kind: 'note' },
  { label: 'Section', kind: 'frame' },
  { label: 'Invoice', kind: 'invoice' },
  { label: 'Action', kind: 'action' },
]

/**
 * The palette's "Start points" (stage 1, then stage 2's payments, PAY-02, and events, EVT-02; no
 * "User reacts", D-36).
 */
export const START_POINTS: readonly NewStep[] = [
  {
    label: '+ Command',
    kind: 'start',
    trigger: { type: 'command', command: '', inMenu: false, menuDescription: {} },
  },
  { label: '+ Start link', kind: 'start', trigger: { type: 'startLink', payload: '', match: 'exact' } },
  { label: '+ Anything else (fallback)', kind: 'start', trigger: { type: 'fallback', accepts: 'any' } },
  { label: '+ Payment done', kind: 'start', trigger: { type: 'paymentDone' } },
  { label: '+ Refund', kind: 'start', trigger: { type: 'refunded' } },
  { label: '+ Subscription changed', kind: 'start', trigger: { type: 'subscriptionChanged' } },
  { label: '+ User blocks the bot', kind: 'start', trigger: { type: 'userBlocks' } },
  { label: '+ User restarts the bot', kind: 'start', trigger: { type: 'userRestarts' } },
  { label: '+ Broadcast', kind: 'start', trigger: { type: 'broadcast', audience: 'everyone', when: '' } },
]

/** What "New step here" offers: the steps an arrow can go into. */
export const NEW_STEP_HERE: readonly NewStep[] = ADD_STEPS.filter(
  (item) => item.kind !== 'note' && item.kind !== 'frame',
)

/** The data type of a palette item dragged onto the map. */
export const PALETTE_DRAG_TYPE = 'application/x-xdesign-step'
