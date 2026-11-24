// An invoice step on the phone (PAY-02, docs/plan/04 section 6): the message the preview draws
// (its card, or a subscription's message with its link in place of the pay button), its total, and
// the amounts as people type them.
import type { BotMessage } from '@xdesign/preview'
import { type Invoice, type InvoiceStep, telegram } from '@xdesign/spec'

/** The invoice's total in the smallest unit of its currency. */
export function totalOf(invoice: Invoice): number {
  return invoice.prices.reduce((sum, price) => sum + price.amount, 0)
}

/** What the phone draws for an invoice step. */
export function invoiceMessage(step: InvoiceStep): BotMessage {
  const { invoice } = step
  return {
    content: {
      type: 'invoice',
      title: invoice.title,
      description: invoice.description,
      photo: invoice.photo,
      price: telegram.priceText(invoice.currency, totalOf(invoice)),
      link: invoice.subscription !== undefined,
    },
    keyboard: step.keyboard,
  }
}

/** An amount in the smallest unit as people type it (50 cents: 0.5), and back. */
export function unitsOf(currency: string, amount: number): number {
  return amount / 10 ** telegram.currencyDigits(currency)
}

export function amountOf(currency: string, units: number): number {
  return Math.round(units * 10 ** telegram.currencyDigits(currency))
}
