import { type Design, sayCondition, type Trigger } from '@xdesign/spec'
import type { NodeProps } from '@xyflow/react'
import { ListIcon } from 'lucide-react'

import { isTheStart } from '../../forms/start/rules'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, Summary } from './Box'

/**
 * What starts the conversation, in a few words: "/help", "Start link: promo", "Anything else the
 * user sends", "A payment of Club card arrives", "The bot writes first to everyone" (a broadcast's
 * time on a line of its own).
 */
function triggerWords(trigger: Trigger, design: Design): { words: string; muted?: boolean } {
  const invoice = (id: string | undefined) => {
    const step = id === undefined ? undefined : design.steps[id]
    return step ? step.title || step.idName : 'any invoice'
  }
  switch (trigger.type) {
    case 'command':
      return trigger.command === '' ? { words: 'No command yet', muted: true } : { words: `/${trigger.command}` }
    case 'startLink':
      if (trigger.payload === '') return { words: 'No link text yet', muted: true }
      return { words: `Start link: ${trigger.payload}${trigger.match === 'prefix' ? '...' : ''}` }
    case 'fallback':
      return {
        words: {
          any: 'Anything else the user sends',
          text: 'Any other text the user sends',
          media: 'Any other photo, video or file the user sends',
        }[trigger.accepts],
      }
    // Stage 2 (PAY-02): the invoice, or any.
    case 'paymentDone':
      return { words: `A payment of ${invoice(trigger.invoice)} arrives` }
    case 'refunded':
      return { words: `A payment of ${invoice(trigger.invoice)} is refunded` }
    // Stage 2 (EVT-02): the subscription's change, the block, and who a broadcast goes to.
    case 'subscriptionChanged':
      return { words: `A subscription of ${invoice(trigger.invoice)} ${SUBSCRIPTION_WORDS[trigger.state ?? 'any']}` }
    case 'userBlocks':
      return { words: 'The user blocks the bot' }
    case 'userRestarts':
      return { words: 'The user restarts the bot after blocking it' }
    case 'broadcast': {
      const { audience } = trigger
      if (audience === 'everyone') return { words: 'The bot writes first to everyone' }
      if (('all' in audience ? audience.all : audience.any).length === 0) {
        return { words: 'The bot writes first: no users chosen yet', muted: true }
      }
      return { words: `The bot writes first to the users for whom ${sayCondition(audience, design)}` }
    }
  }
}

const SUBSCRIPTION_WORDS = {
  any: 'changes',
  canceled: 'is canceled',
  active: 'is turned back on',
  failed: 'could not be paid',
} as const

/**
 * A start point (04 section 4.3): the trigger in words ("Every chat starts here" for `/start`), a
 * mark when a command shows in the commands menu, and its arrow out; no arrow goes into it.
 */
export function StartBox({ data, selected }: NodeProps<KindNode<'start'>>) {
  const { step } = data
  const { trigger } = step
  const { words, muted = false } = useShown(step, (design) =>
    isTheStart(step, design.steps) ? { words: 'Every chat starts here' } : triggerWords(trigger, design),
  )
  return (
    <BoxShell step={step} selected={selected} takesArrows={false} out="next" className="bg-brand-weak">
      <Summary muted={muted}>
        {trigger.type === 'command' && trigger.inMenu ? (
          <ListIcon aria-label="In the commands menu" className="me-1 inline size-3.5 align-[-2px] text-fg-3" />
        ) : null}
        {words}
      </Summary>
      {trigger.type === 'broadcast' ? (
        <Summary muted={trigger.when.trim() === ''}>
          {trigger.when.trim() === '' ? 'When: not given yet' : `When: ${trigger.when.trim()}`}
        </Summary>
      ) : null}
    </BoxShell>
  )
}
