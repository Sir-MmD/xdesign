import {
  type Invoice,
  type InvoiceStep,
  type MediaSlot,
  newId,
  type Options,
  type Physical,
  telegram,
} from '@xdesign/spec'
import { XIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useDesign, useEditor, useLang } from '../context'
import { amountOf, unitsOf } from '../phone/invoice'
import { fileLine } from '../phone/media/files'
import { FileThumb } from '../phone/media/FileThumb'
import { MediaSource } from '../phone/media/MediaSource'
import { NumberInput } from '../phone/NumberInput'
import { Field, FormSection, TargetSelect, TitleField } from './fields'
import { PlainTextField, SwitchRow } from './start/fields'
import { inLanguage } from './start/rules'

// A photo has no file yet: a slot of no file, so the picker offers "Use" for a placeholder.
const noPhoto: MediaSlot = { media: '' }

// What a new physical invoice asks for: nothing yet.
const newPhysical: Physical = {
  needName: false,
  needPhone: false,
  needEmail: false,
  needAddress: false,
  flexibleShipping: false,
  shippingOptions: [],
}

const ASKS: readonly { key: 'needName' | 'needPhone' | 'needEmail' | 'needAddress'; label: string }[] = [
  { key: 'needName', label: 'Ask for the name' },
  { key: 'needPhone', label: 'Ask for the phone number' },
  { key: 'needEmail', label: 'Ask for the email' },
  { key: 'needAddress', label: 'Ask for the shipping address' },
]

/**
 * The invoice's form under its phone (PAY-02, docs/plan/04 section 6, 03 section 7.1): "Title"
 * (the box's name), the invoice's title and description in the language shown and its photo;
 * "Price": Stars or a card currency, the price lines (a label and an amount each, a negative one
 * a discount), "Subscription (every 30 days)" in Stars; "Physical goods": what the payment sheet
 * asks for and flexible shipping with its options; "Pre-checkout check": what the developer
 * checks, "OK" and "Refuse" with its message; "Paid" (the arrow), "Payload", "Silent" and
 * "Protect". Every change goes through SPEC-04's accessors; the checks (E23 to E25) say what
 * Telegram refuses.
 */
export function InvoiceForm({ step }: { step: InvoiceStep }) {
  const { edits } = useEditor()
  const { invoice } = step
  const set = (patch: Partial<Invoice>) => {
    edits.steps.set(step.id, { invoice: { ...invoice, ...patch } })
  }
  return (
    <>
      <FormSection title="Invoice">
        <TitleField step={step} />
        <PlainTextField
          at={{ step: step.id, field: 'invoiceTitle' }}
          text={invoice.title}
          label="Invoice title"
          max={telegram.limit('invoiceTitle').max}
        />
        <PlainTextField
          at={{ step: step.id, field: 'invoiceDescription' }}
          text={invoice.description}
          label="Description"
          max={telegram.limit('invoiceDescription').max}
          multiline
        />
        <InvoicePhoto photo={invoice.photo} set={set} />
      </FormSection>
      <PriceSection step={step} set={set} />
      <PhysicalSection step={step} set={set} />
      <CheckoutSection step={step} />
      <PaidSection step={step} set={set} />
    </>
  )
}

type Set = (patch: Partial<Invoice>) => void

/** The invoice's photo: its file or placeholder, MSG-01's picker in a popover, and "Remove". */
function InvoicePhoto({ photo, set }: { photo: MediaSlot | undefined; set: Set }) {
  const design = useDesign()
  const { readOnly } = useEditor()
  const [open, setOpen] = useState(false)
  const item = photo && 'media' in photo ? design.media[photo.media] : undefined
  const line = item
    ? fileLine(item)
    : photo && 'placeholder' in photo
      ? photo.placeholder.description || 'Placeholder'
      : 'No photo'
  return (
    <div className="grid gap-2">
      <p className="text-subhead font-semibold text-fg-2">Photo</p>
      <div className="flex min-w-0 items-center gap-3">
        <FileThumb slot={photo} item={item} />
        <span dir="auto" className="min-w-0 flex-1 truncate text-callout text-fg-2">
          {line}
        </span>
        {readOnly ? null : (
          <>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger render={<Button variant="outline" size="sm" />}>
                {photo ? 'Change' : 'Add a photo'}
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="grid w-80 gap-3">
                <PopoverTitle>Photo</PopoverTitle>
                {item ? <PopoverDescription className="truncate">{fileLine(item)}</PopoverDescription> : null}
                <MediaSource
                  kinds={['photo']}
                  slot={photo ?? noPhoto}
                  onPick={(slot) => {
                    set({ photo: slot })
                  }}
                />
              </PopoverContent>
            </Popover>
            {photo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  set({ photo: undefined })
                }}
              >
                Remove
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** An amount typed in the currency's units ("4.50"), kept in its smallest unit. */
function AmountInput({
  currency,
  amount,
  onCommit,
  min = -1e9,
  ...label
}: {
  currency: string
  amount: number
  onCommit: (amount: number) => void
  min?: number
  'aria-label': string
}) {
  const stars = telegram.isStars(currency)
  return (
    <NumberInput
      {...label}
      className="w-28 shrink-0"
      value={unitsOf(currency, amount)}
      min={min}
      max={1e9}
      whole={stars}
      onCommit={(units) => {
        onCommit(amountOf(currency, units))
      }}
    />
  )
}

/**
 * "Price": Stars or a card currency (its code), the price lines in the language shown with their
 * amounts, "+ Price line", and the subscription (Stars only) with the line on how Telegram sends it.
 */
function PriceSection({ step, set }: { step: InvoiceStep; set: Set }) {
  const design = useDesign()
  const lang = useLang()
  const { edits, readOnly } = useEditor()
  const { invoice } = step
  const { currency, prices, subscription } = invoice
  const stars = telegram.isStars(currency)
  const codeId = useId()
  const fallback = lang === design.languages.default ? undefined : design.languages.default
  return (
    <FormSection
      title="Price"
      actions={
        stars && prices.length > 0 ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              set({ prices: [...prices, { label: {}, amount: stars ? 1 : 100 }] })
            }}
          >
            + Price line
          </Button>
        )
      }
    >
      <ToggleGroup
        aria-label="Currency"
        spacing={0}
        value={[stars ? 'stars' : 'card']}
        onValueChange={([choice]) => {
          if (choice === 'stars' && !stars) set({ currency: telegram.STARS_CURRENCY })
          if (choice === 'card' && stars) set({ currency: 'USD', subscription: undefined })
        }}
      >
        <ToggleGroupItem value="stars">Telegram Stars</ToggleGroupItem>
        <ToggleGroupItem value="card">Card</ToggleGroupItem>
      </ToggleGroup>
      {stars ? (
        <p className="-mt-2 text-footnote text-fg-3">Digital goods and services are paid in Stars.</p>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={codeId}>Currency code</Label>
          <Input
            id={codeId}
            dir="ltr"
            className="w-28"
            maxLength={3}
            placeholder="USD"
            value={currency}
            onChange={(event) => {
              set({ currency: event.target.value.toUpperCase().replace(/[^A-Z]/g, '') })
            }}
          />
        </div>
      )}
      {prices.length === 0 ? <p className="text-callout text-fg-3">No price yet</p> : null}
      {prices.map((price, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            dir="auto"
            aria-label={inLanguage('Price line', design, lang)}
            placeholder={(fallback && price.label[fallback]) || 'Label'}
            className="min-w-0 flex-1"
            value={price.label[lang] ?? ''}
            onChange={(event) => {
              edits.texts.setPlain({ step: step.id, field: 'price', price: index }, lang, event.target.value)
            }}
          />
          <AmountInput
            aria-label="Amount"
            currency={currency}
            amount={price.amount}
            onCommit={(amount) => {
              set({ prices: prices.map((line, at) => (at === index ? { ...line, amount } : line)) })
            }}
          />
          {readOnly ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove this price line"
              onClick={() => {
                set({ prices: prices.filter((_, at) => at !== index) })
              }}
            >
              <XIcon />
            </Button>
          )}
        </div>
      ))}
      <p className="text-callout">
        Total:{' '}
        <span className="font-semibold">
          {telegram.priceText(
            currency,
            prices.reduce((sum, price) => sum + price.amount, 0),
          )}
        </span>
      </p>
      {stars || subscription ? (
        <>
          <SwitchRow
            label={`Subscription (every ${String(telegram.subscriptionDays())} days)`}
            checked={subscription !== undefined}
            onChange={(on) => {
              set({ subscription: on ? { periodDays: telegram.subscriptionDays() } : undefined })
            }}
          />
          {subscription ? (
            <p className="-mt-2 text-footnote text-fg-3">
              Telegram takes subscriptions only through an invoice link: the bot sends a message with the link in a URL
              button in place of the pay button.
            </p>
          ) : null}
        </>
      ) : null}
    </FormSection>
  )
}

/**
 * "Physical goods" (paid by card): what the payment sheet asks for, and flexible shipping with its
 * options (a title in the language shown and a price each, "+ Shipping option").
 */
function PhysicalSection({ step, set }: { step: InvoiceStep; set: Set }) {
  const design = useDesign()
  const lang = useLang()
  const { edits, readOnly } = useEditor()
  const { invoice } = step
  const { physical, currency } = invoice
  const setPhysical = (patch: Partial<Physical>) => {
    if (physical) set({ physical: { ...physical, ...patch } })
  }
  const fallback = lang === design.languages.default ? undefined : design.languages.default
  const options = physical?.shippingOptions ?? []
  return (
    <FormSection
      title="Physical goods"
      actions={
        physical?.flexibleShipping ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPhysical({ shippingOptions: [...options, { id: newId(), title: {}, amount: 0 }] })
            }}
          >
            + Shipping option
          </Button>
        ) : null
      }
    >
      <SwitchRow
        label="Physical goods, or a service outside the app stores"
        checked={physical !== undefined}
        onChange={(on) => {
          set({ physical: on ? newPhysical : undefined })
        }}
      />
      {physical ? (
        <>
          {ASKS.map((ask) => (
            <SwitchRow
              key={ask.key}
              label={ask.label}
              checked={physical[ask.key]}
              onChange={(on) => {
                setPhysical({ [ask.key]: on })
              }}
            />
          ))}
          <SwitchRow
            label="Flexible shipping (the price depends on the address)"
            checked={physical.flexibleShipping}
            onChange={(on) => {
              setPhysical({ flexibleShipping: on })
            }}
          />
          {physical.flexibleShipping && options.length === 0 ? (
            <p className="text-callout text-fg-3">No shipping option yet</p>
          ) : null}
          {physical.flexibleShipping
            ? options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-1.5">
                  <Input
                    dir="auto"
                    aria-label={inLanguage('Shipping option', design, lang)}
                    placeholder={(fallback && option.title[fallback]) || 'Shipping option'}
                    className="min-w-0 flex-1"
                    value={option.title[lang] ?? ''}
                    onChange={(event) => {
                      edits.texts.setPlain(
                        { step: step.id, field: 'shipping', option: index },
                        lang,
                        event.target.value,
                      )
                    }}
                  />
                  <AmountInput
                    aria-label="Shipping price"
                    currency={currency}
                    amount={option.amount}
                    min={0}
                    onCommit={(amount) => {
                      setPhysical({
                        shippingOptions: options.map((item, at) => (at === index ? { ...item, amount } : item)),
                      })
                    }}
                  />
                  {readOnly ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove this shipping option"
                      onClick={() => {
                        setPhysical({ shippingOptions: options.filter((_, at) => at !== index) })
                      }}
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>
              ))
            : null}
        </>
      ) : null}
    </FormSection>
  )
}

/**
 * "Pre-checkout check": the developer step the bot runs when the user presses pay, before Telegram
 * takes the money: what the developer checks, and its two outcomes, "OK" (the payment goes on to
 * "Paid") and "Refuse" with the message the payment sheet shows.
 */
function CheckoutSection({ step }: { step: InvoiceStep }) {
  const { edits } = useEditor()
  const { checkout } = step
  const descriptionId = useId()
  return (
    <FormSection title="Pre-checkout check">
      <SwitchRow
        label="Check before Telegram takes the money"
        checked={checkout !== undefined}
        onChange={(on) => {
          edits.steps.set(step.id, { checkout: on ? { description: '', refuse: {} } : undefined })
        }}
      />
      {checkout ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor={descriptionId}>What the developer checks</Label>
            <Textarea
              id={descriptionId}
              className="min-h-20"
              value={checkout.description}
              onChange={(event) => {
                edits.steps.set(step.id, { checkout: { ...checkout, description: event.target.value } })
              }}
            />
          </div>
          <Field label="Outcomes">
            {() => (
              <ul className="grid gap-1 text-callout text-fg-2">
                <li>OK: the payment goes through, then &quot;Paid&quot;.</li>
                <li>Refuse: the payment sheet shows the message below and nothing is paid.</li>
              </ul>
            )}
          </Field>
          <PlainTextField at={{ step: step.id, field: 'refuse' }} text={checkout.refuse} label="Refuse message" />
        </>
      ) : null}
    </FormSection>
  )
}

/** "Paid" (where the user goes once paid), the payload, and how the invoice is sent. */
function PaidSection({ step, set }: { step: InvoiceStep; set: Set }) {
  const { edits } = useEditor()
  const payloadId = useId()
  const setOptions = (patch: Partial<Options>) => {
    edits.steps.set(step.id, { options: { ...step.options, ...patch } })
  }
  return (
    <FormSection title="Paid">
      <Field label="Goes to" hint="Where the user goes once the payment went through.">
        {(labelId) => (
          <TargetSelect
            from={step}
            value={step.next}
            aria-labelledby={labelId}
            onChange={(target) => {
              edits.steps.connect({ step: step.id, arrow: 'next' }, target)
            }}
          />
        )}
      </Field>
      <div className="grid gap-2">
        <Label htmlFor={payloadId}>Payload</Label>
        <Input
          id={payloadId}
          dir="ltr"
          placeholder={step.idName}
          value={step.invoice.payload ?? ''}
          onChange={(event) => {
            set({ payload: event.target.value === '' ? undefined : event.target.value })
          }}
        />
        <p className="text-footnote text-fg-3">What the bot gets back with the payment; empty: the ID name.</p>
      </div>
      <SwitchRow
        label="Silent (no sound)"
        checked={step.options.silent === true}
        onChange={(on) => {
          setOptions({ silent: on || undefined })
        }}
      />
      <SwitchRow
        label="Protect (no forwarding or saving)"
        checked={step.options.protect === true}
        onChange={(on) => {
          setOptions({ protect: on || undefined })
        }}
      />
    </FormSection>
  )
}
