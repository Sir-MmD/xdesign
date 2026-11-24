// Invoices and payments (docs/plan/08 sections 1, 3 and 7, 03 section 7.1): the sendInvoice
// parameters a design maps to, with the model's field for each (null: xDesign does not offer it),
// the updates and calls of a payment, and the rules checks E23 to E25 follow. The lengths and the
// subscription's period and price are in limits.ts.
import { limit } from './limits.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

/** The currency code of Telegram Stars. */
export const STARS_CURRENCY = 'XTR'

export type InvoiceFieldRow = Sourced & {
  /** The sendInvoice (or createInvoiceLink) parameter. */
  readonly id: string
  /** The invoice step's field that gives it (`invoice.` fields, `keyboard`), or null. */
  readonly model: string | null
  /** The payments it applies to: Telegram ignores the card fields for Stars. */
  readonly payments: 'stars' | 'cards' | 'both'
  /** Only createInvoiceLink has it. */
  readonly linkOnly?: boolean
}

export const INVOICE_FIELDS = [
  {
    id: 'title',
    model: 'invoice.title',
    payments: 'both',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'description',
    model: 'invoice.description',
    payments: 'both',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'payload',
    model: 'invoice.payload',
    payments: 'both',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'Not shown to the user; the step ID name when the design leaves it out.',
  },
  {
    id: 'provider_token',
    model: null,
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: "An empty string for Stars; for cards the token of a payment provider connected in BotFather (the developer's).",
  },
  {
    id: 'currency',
    model: 'invoice.currency',
    payments: 'both',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'XTR for Telegram Stars, else a three-letter ISO 4217 code.',
  },
  {
    id: 'prices',
    model: 'invoice.prices',
    payments: 'both',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'Exactly one item for Stars.',
  },
  {
    id: 'photo_url',
    model: 'invoice.photo',
    payments: 'both',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'A URL: the developer hosts the photo.',
  },
  {
    id: 'need_name',
    model: 'invoice.physical.needName',
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'need_phone_number',
    model: 'invoice.physical.needPhone',
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'need_email',
    model: 'invoice.physical.needEmail',
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'need_shipping_address',
    model: 'invoice.physical.needAddress',
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'is_flexible',
    model: 'invoice.physical.flexibleShipping',
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'The final price depends on the shipping method: Telegram sends a shipping_query.',
  },
  {
    id: 'subscription_period',
    model: 'invoice.subscription',
    payments: 'stars',
    linkOnly: true,
    source: apiDoc('createinvoicelink'),
    botApi: BOT_API,
    verified: true,
    note: 'Always 2592000 seconds (30 days).',
  },
  {
    id: 'reply_markup',
    model: 'keyboard',
    payments: 'both',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'Empty: one "Pay total price" button; otherwise the first button must be a Pay button.',
  },
  {
    id: 'max_tip_amount',
    model: null,
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'suggested_tip_amounts',
    model: null,
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'send_phone_number_to_provider',
    model: null,
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'send_email_to_provider',
    model: null,
    payments: 'cards',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly InvoiceFieldRow[]

export type PaymentEventRow = Sourced & {
  /** The update, message field or method. */
  readonly id: string
  readonly type: 'update' | 'message' | 'method'
  /** What it is in the design, in plain words. */
  readonly about: string
}

/** A payment from the pay button on: the updates the bot gets and the calls it makes. */
export const PAYMENT_EVENTS = [
  {
    id: 'shipping_query',
    type: 'update',
    about: 'The user gave a shipping address (flexible shipping): the bot answers with answerShippingQuery.',
    source: apiDoc('shippingquery'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'answerShippingQuery',
    type: 'method',
    about: 'ok with the shipping options, or ok false with an error message.',
    source: apiDoc('answershippingquery'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'pre_checkout_query',
    type: 'update',
    about: 'The user confirmed the payment: the pre-checkout check.',
    source: apiDoc('precheckoutquery'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'answerPreCheckoutQuery',
    type: 'method',
    about: 'ok, or ok false with an error message the payment sheet shows.',
    source: apiDoc('answerprecheckoutquery'),
    botApi: BOT_API,
    verified: true,
    note: 'Within 10 seconds of the query (limit preCheckoutAnswer).',
  },
  {
    id: 'successful_payment',
    type: 'message',
    about: 'The money arrived: the invoice\'s "Paid" arrow, or the start point "Payment done".',
    source: apiDoc('successfulpayment'),
    botApi: BOT_API,
    verified: true,
    note: 'telegram_payment_charge_id is needed to refund; a subscription has is_recurring, is_first_recurring and subscription_expiration_date.',
  },
  {
    id: 'refunded_payment',
    type: 'message',
    about: 'A payment was refunded: the start point "Refund".',
    source: apiDoc('refundedpayment'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'refundStarPayment',
    type: 'method',
    about: 'The refund action: gives back a Stars payment.',
    source: apiDoc('refundstarpayment'),
    botApi: BOT_API,
    verified: true,
    note: 'Takes user_id and telegram_payment_charge_id; Stars payments only.',
  },
  {
    id: 'createInvoiceLink',
    type: 'method',
    about: 'A subscription invoice: the link a url button opens in place of the pay button.',
    source: apiDoc('createinvoicelink'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'editUserStarSubscription',
    type: 'method',
    about: "Cancels a user's Stars subscription, or turns it back on.",
    source: apiDoc('edituserstarsubscription'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly PaymentEventRow[]

export type PaymentRuleRow = Sourced & { readonly id: string; readonly rule: string }

export const PAYMENT_RULES = [
  {
    id: 'starsForDigital',
    rule: "Digital goods and services are sold only in Telegram Stars (XTR); cards only for physical goods and services outside the app stores' rules.",
    source: apiDoc('payments'),
    botApi: BOT_API,
    verified: true,
    note: 'Stated on the introductions to payments the section links (bots/payments-stars and bots/payments).',
  },
  {
    id: 'starsOnePrice',
    rule: 'A Stars invoice has exactly one price line.',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'starsIgnoreCardFields',
    rule: 'need_name, need_phone_number, need_email, need_shipping_address, is_flexible and tips are ignored for Stars.',
    source: apiDoc('sendinvoice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'payButtonFirst',
    rule: 'An invoice keyboard starts with its Pay button; a Pay button is only on invoices.',
    source: apiDoc('inlinekeyboardbutton'),
    botApi: BOT_API,
    verified: true,
    note: 'Telegram shows ⭐ and XTR in the button text as a Star.',
  },
  {
    id: 'subscriptionLinkOnly',
    rule: 'A subscription is offered through createInvoiceLink, always for 30 days, in Stars.',
    source: apiDoc('createinvoicelink'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'smallestUnit',
    rule: 'Amounts are whole numbers in the smallest unit of the currency (145 for US$ 1.45); currencies.json gives the digits (exp) and the min and max amount of each card currency.',
    source: apiDoc('labeledprice'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'refundStarsOnly',
    rule: 'Bots refund only Stars payments (refundStarPayment); card refunds go through the payment provider.',
    source: apiDoc('refundstarpayment'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly PaymentRuleRow[]

/** Whether a currency is Telegram Stars. */
export function isStars(currency: string): boolean {
  return currency === STARS_CURRENCY
}

/** A card currency code as sendInvoice takes it: three upper-case letters (ISO 4217), not XTR. */
export function isCardCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency) && !isStars(currency)
}

// The digits after the decimal point of the ISO 4217 currencies that do not have 2; currencies.json
// (rule smallestUnit) is the final word for each currency Telegram takes.
const DIGITS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
}

/** The digits after the decimal point of an amount: none for Stars, else the currency's (mostly 2). */
export function currencyDigits(currency: string): number {
  return isStars(currency) ? 0 : (DIGITS[currency] ?? 2)
}

/** An amount in the smallest unit as people read it: "⭐️50", "4.50 USD". */
export function priceText(currency: string, amount: number): string {
  if (isStars(currency)) return `⭐️${String(amount)}`
  const digits = currencyDigits(currency)
  return `${(amount / 10 ** digits).toFixed(digits)} ${currency}`
}

/** The subscription period Telegram takes, in days. */
export function subscriptionDays(): number {
  return limit('subscriptionPeriod').value / 86400
}
