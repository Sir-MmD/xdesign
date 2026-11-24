import { type ActionStep, type Design, telegram } from '@xdesign/spec'
import type { NodeProps } from '@xyflow/react'

import { exitsOf } from '../arrows'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, Exits, Summary } from './Box'

/**
 * What an action does, in a few words ("React 👍 to the user's message", "Pin New roast", "Refund
 * Club card"); muted while what it acts on is not set yet.
 */
function actionWords(step: ActionStep, steps: Design['steps']): { words: string; muted?: boolean } {
  const { action } = step
  // A step the action names, by title.
  const named = (id: string | undefined) => {
    const target = id === undefined ? undefined : steps[id]
    return target ? target.title || target.idName : undefined
  }
  switch (action.type) {
    case 'refund': {
      const invoice = named(action.invoice)
      return invoice === undefined ? { words: 'Refund: no invoice yet', muted: true } : { words: `Refund ${invoice}` }
    }
    case 'react': {
      if (action.onStep === 'userMessage') return { words: `React ${action.emoji} to the user's message` }
      const message = named(action.onStep)
      return message === undefined
        ? { words: `React ${action.emoji}: no message yet`, muted: true }
        : { words: `React ${action.emoji} to ${message}` }
    }
    case 'pin':
    case 'delete': {
      const verb = action.type === 'pin' ? 'Pin' : 'Delete'
      const message = named(action.step)
      return message === undefined ? { words: `${verb}: no message yet`, muted: true } : { words: `${verb} ${message}` }
    }
    case 'unpin':
      return { words: `Unpin ${named(action.step) ?? 'the newest pinned message'}` }
    case 'gift': {
      const gift = action.giftDescription.trim()
      return gift === '' ? { words: 'Send a gift: not chosen yet', muted: true } : { words: `Send a gift: ${gift}` }
    }
    case 'chatAction':
      return { words: `Show "${telegram.chatAction(action.action).label}"` }
  }
}

/**
 * An action (stage 2, PAY-02 and EVT-02): what it does in a few words (the refund and its
 * invoice, the reaction and its message, the pin, unpin or delete and its message, the gift, the
 * chat action), and its "Then" dot.
 */
export function ActionBox({ data, selected }: NodeProps<KindNode<'action'>>) {
  const { step } = data
  const { words, muted = false } = useShown(step, (design) => actionWords(step, design.steps))
  return (
    <BoxShell step={step} selected={selected}>
      <Summary muted={muted}>{words}</Summary>
      <Exits exits={exitsOf(step)} />
    </BoxShell>
  )
}
