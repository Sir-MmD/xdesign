// Invoices (docs/plan/08 section 6): E23 invoice limits (title, description, payload, prices,
// currency, shipping options, the refusal message) and the pay button first in the first row, and
// only there; E24 Stars for digital goods (and Telegram ignoring the card fields in Stars); E25 a
// subscription only in Stars, for 30 days and within its price. Each limit comes from the catalog; a
// text missing in a language other than the default one is W03's.
import type { Lang } from '../model/ids.ts'
import type { InvoiceStep } from '../model/steps.ts'
import type { LangText } from '../model/texts.ts'
import { limit } from '../telegram/limits.ts'
import { isCardCurrency, isStars, priceText, STARS_CURRENCY, subscriptionDays } from '../telegram/payments.ts'
import { andList, emptyText, keyboardOf, type Context } from './context.ts'

const whole = (value: number) => Number.isInteger(value)

// The UTF-8 bytes of a text: 1 to 4 for each code point.
function utf8Bytes(text: string): number {
  let bytes = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

export function checkPayments(ctx: Context): void {
  for (const step of ctx.steps) {
    if (step.kind === 'invoice') checkInvoice(ctx, step)
  }
  // A pay button anywhere but first on an invoice (checkInvoice reports those on invoices).
  for (const { button, step } of ctx.buttons) {
    if (button.place !== 'inline' || button.action.type !== 'pay') continue
    for (const shownIn of ctx.buttonSteps.get(button.id) ?? [step]) {
      if (shownIn.kind === 'invoice') continue
      ctx.add(
        'E23',
        `The button ${ctx.buttonName(button)} in ${ctx.stepName(shownIn)} is a pay button; Telegram allows it ` +
          'only as the first button of an invoice.',
        { stepId: shownIn.id, buttonId: button.id },
      )
    }
  }
}

function checkInvoice(ctx: Context, step: InvoiceStep): void {
  const { invoice } = step
  const name = ctx.stepName(step)
  const place = { stepId: step.id }
  const add = (message: string, language?: Lang) => {
    ctx.add('E23', message, { ...place, ...(language !== undefined && { language }) })
  }
  // A plain text Telegram needs in the default language, within a length in every language.
  const text = (what: string, value: LangText, max?: number) => {
    for (const lang of ctx.languages) {
      const words = value[lang]
      if (lang === ctx.defaultLanguage && emptyText(words)) {
        add(`${what} of ${name} is empty in ${lang}; Telegram needs one.`, lang)
        continue
      }
      const length = words === undefined ? 0 : ctx.plainLength(words)
      if (max !== undefined && length > max) {
        add(
          `${what} of ${name} in ${lang} is ${String(length)} characters long; Telegram allows at most ${String(max)}.`,
          lang,
        )
      }
    }
  }

  text('The title', invoice.title, limit('invoiceTitle').max)
  text('The description', invoice.description, limit('invoiceDescription').max)
  const payload = limit('invoicePayload')
  const bytes = utf8Bytes(invoice.payload ?? step.idName)
  if (bytes < payload.min || bytes > payload.max) {
    add(
      `The payload of ${name} is ${String(bytes)} bytes long; Telegram needs ${String(payload.min)} to ` +
        `${String(payload.max)} bytes.`,
    )
  }

  const stars = isStars(invoice.currency)
  if (!stars && !isCardCurrency(invoice.currency)) {
    add(
      `The currency of ${name} is "${invoice.currency}"; Telegram needs ${STARS_CURRENCY} for Stars or a ` +
        'three-letter card currency code such as USD.',
    )
  }
  const { prices } = invoice
  if (prices.length === 0) add(`${name} has no price; Telegram needs at least one price line.`)
  else if (stars && prices.length > 1) {
    add(`${name} has ${String(prices.length)} price lines; an invoice in Stars has exactly one.`)
  }
  prices.forEach((price, index) => {
    const which = prices.length === 1 ? 'The price' : `Price line ${String(index + 1)}`
    text(`The label of ${lowerFirst(which)}`, price.label)
    if (!whole(price.amount)) {
      add(`${which} of ${name} is ${String(price.amount)}; Telegram needs a whole number in the smallest unit.`)
    }
  })
  const total = prices.reduce((sum, price) => sum + price.amount, 0)
  if (prices.length > 0 && total <= 0) {
    add(`The total of ${name} is ${priceText(invoice.currency, total)}; Telegram needs more than nothing.`)
  }

  const { physical } = invoice
  if (physical?.flexibleShipping) {
    if (physical.shippingOptions.length === 0) {
      add(`${name} has flexible shipping but no shipping options; the bot needs at least one to answer.`)
    }
    physical.shippingOptions.forEach((option, index) => {
      const which = `shipping option ${String(index + 1)}`
      text(`The title of ${which}`, option.title)
      if (!whole(option.amount) || option.amount < 0) {
        add(`The price of ${which} of ${name} is ${String(option.amount)}; Telegram needs a whole number.`)
      }
    })
  }
  if (step.checkout) text('The refusal message of the pre-checkout check', step.checkout.refuse)

  // The pay button: first in the first row, only once; no keyboard (or no buttons) is Telegram's
  // own pay button.
  const keyboard = keyboardOf(step)
  if (keyboard !== null && keyboard.type !== 'inline') {
    add(`${name} has a keyboard that is not inline; an invoice takes only inline buttons.`)
  } else if (keyboard !== null && ctx.rows(step).some((row) => row.length > 0)) {
    const rows = ctx.rows(step)
    const first = rows[0]?.[0]
    if (first?.place !== 'inline' || first.action.type !== 'pay') {
      add(`The first button of ${name} is not its pay button; Telegram needs the pay button first in the first row.`)
    }
    const others = rows
      .flat()
      .slice(1)
      .filter((button) => button.place === 'inline' && button.action.type === 'pay' && button !== first)
    for (const button of new Set(others)) {
      ctx.add('E23', `The button ${ctx.buttonName(button)} in ${name} is a second pay button; an invoice has one.`, {
        ...place,
        buttonId: button.id,
      })
    }
  }

  // E24: digital goods only in Stars; Telegram ignores the card fields in Stars.
  if (!physical && !stars && isCardCurrency(invoice.currency)) {
    ctx.add(
      'E24',
      `${name} sells digital goods or services in ${invoice.currency}; Telegram sells them only in Stars ` +
        `(${STARS_CURRENCY}). Choose Stars, or mark it as physical goods or a service outside the app stores.`,
      place,
    )
  }
  if (physical && stars) {
    const asked = [
      physical.needName && 'the name',
      physical.needPhone && 'the phone number',
      physical.needEmail && 'the email',
      physical.needAddress && 'the shipping address',
      physical.flexibleShipping && 'flexible shipping',
    ].filter((item) => item !== false)
    if (asked.length > 0) {
      ctx.add(
        'E24',
        `${name} asks for ${andList(asked)}, which Telegram ignores for payments in Stars; choose a card currency.`,
        place,
      )
    }
  }

  // E25: a subscription in Stars, every 30 days, within its price.
  const { subscription } = invoice
  if (!subscription) return
  if (!stars) {
    ctx.add('E25', `${name} is a subscription in ${invoice.currency}; Telegram has subscriptions only in Stars.`, place)
  }
  const days = subscriptionDays()
  if (subscription.periodDays !== days) {
    ctx.add(
      'E25',
      `${name} renews every ${String(subscription.periodDays)} days; Telegram renews subscriptions every ` +
        `${String(days)} days.`,
      place,
    )
  }
  const price = limit('subscriptionPrice')
  if (stars && (total < price.min || total > price.max)) {
    ctx.add(
      'E25',
      `${name} costs ${String(total)} Stars a period; a subscription costs ${String(price.min)} to ` +
        `${String(price.max)} Stars.`,
      place,
    )
  }
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
