import { telegram } from '@xdesign/spec'
import type { NodeProps } from '@xyflow/react'

import { exitsOf } from '../arrows'
import type { KindNode } from '../nodes'
import { useShown } from '../shown'
import { BoxShell, ButtonRows, Exits, Summary } from './Box'

/**
 * An invoice (stage 2, PAY-02): its title in the language shown and its total ("⭐️50", "4.50
 * USD", "every 30 days" for a subscription), its buttons as pills (the pay button first) with a dot
 * for each that goes to a step, and "Paid".
 */
export function InvoiceBox({ data, selected }: NodeProps<KindNode<'invoice'>>) {
  const { step } = data
  const { title, currency, prices, subscription } = step.invoice
  const name = useShown(step, (design, lang) => title[lang]?.trim() || title[design.languages.default]?.trim() || '')
  const total = telegram.priceText(
    currency,
    prices.reduce((sum, price) => sum + price.amount, 0),
  )
  const every = subscription ? ` every ${String(subscription.periodDays)} days` : ''
  return (
    <BoxShell step={step} selected={selected}>
      <Summary muted={name === ''}>
        {name === '' ? 'No title yet' : name}
        {` · ${total}${every}`}
      </Summary>
      <ButtonRows step={step} />
      <Exits exits={exitsOf(step)} />
    </BoxShell>
  )
}
