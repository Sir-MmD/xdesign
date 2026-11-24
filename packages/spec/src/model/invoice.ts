// What an invoice step sells (docs/plan/03-design-model.md section 7.1, stage 2): sendInvoice's
// fields in plain words. Telegram's limits (title and description lengths, one price in Stars,
// subscriptions only in Stars and for 30 days, Stars for digital goods) are left to the checks
// (E23 to E25).
import { z } from 'zod'

import { MediaSlotSchema } from './content.ts'
import { IdSchema } from './ids.ts'
import { LangTextSchema } from './texts.ts'

// A line of the price (LabeledPrice): its label per language and its amount in the currency's
// smallest unit (cents; whole Stars for XTR). A negative amount is a discount.
export const PriceSchema = z.object({ label: LangTextSchema, amount: z.number() })
export type Price = z.infer<typeof PriceSchema>

// A way to ship (ShippingOption) the bot offers once the user gives an address: its title per
// language and its price in the smallest unit (one price line, labeled with the title).
export const ShippingOptionSchema = z.object({ id: IdSchema, title: LangTextSchema, amount: z.number() })
export type ShippingOption = z.infer<typeof ShippingOptionSchema>

// Physical goods or a service the app stores' rules do not cover (cards allowed): what the
// payment sheet asks for. `flexibleShipping`: the price depends on the address, so the bot
// answers with `shippingOptions` (is_flexible).
export const PhysicalSchema = z.object({
  needName: z.boolean(),
  needPhone: z.boolean(),
  needEmail: z.boolean(),
  needAddress: z.boolean(),
  flexibleShipping: z.boolean(),
  shippingOptions: z.array(ShippingOptionSchema),
})
export type Physical = z.infer<typeof PhysicalSchema>

// `currency`: XTR for Telegram Stars or a card currency code (ISO 4217). Without `physical` the
// invoice sells digital goods or services, which Telegram sells only in Stars. `subscription`:
// the user pays again every `periodDays` (30, Stars only). `payload`: the developer's reference;
// left out, the step's ID name.
export const InvoiceSchema = z.object({
  title: LangTextSchema,
  description: LangTextSchema,
  photo: MediaSlotSchema.optional(),
  currency: z.string(),
  prices: z.array(PriceSchema),
  subscription: z.object({ periodDays: z.number() }).optional(),
  physical: PhysicalSchema.optional(),
  payload: z.string().optional(),
})
export type Invoice = z.infer<typeof InvoiceSchema>

// The pre-checkout check (pre_checkout_query): a developer step the bot runs before Telegram
// takes the money; it answers ok, or refuses with a message the payment sheet shows. Left out,
// the bot always answers ok.
export const CheckoutSchema = z.object({ description: z.string(), refuse: LangTextSchema })
export type Checkout = z.infer<typeof CheckoutSchema>
