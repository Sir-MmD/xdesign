import type { StartStep, SubscriptionState, Trigger } from '@xdesign/spec'
import { PlayIcon } from 'lucide-react'
import { useId } from 'react'

import { CopyButton } from '@/components/CopyButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useDesign, useEditor } from '../../context'
import { ConditionList } from '../ConditionList'
import { Field } from '../fields'
import { InvoiceSelect } from '../InvoiceSelect'
import { newCondition } from '../values'
import { PlainTextField, PrefixedField, SwitchRow } from './fields'
import {
  COMMAND_RULE,
  commandFits,
  isTheStart,
  MENU_TEXT_MAX,
  PAYLOAD_RULE,
  payloadFits,
  sameCommand,
  startLink,
  typedCommand,
} from './rules'
import { SaveRestAs } from './SaveRestAs'

type Of<T extends Trigger['type']> = Extract<Trigger, { type: T }>

/**
 * A start point's form in the right pane (04 section 6): a command ("/command" with the
 * catalog's rule, "Show in the commands menu", "Menu text" in the language shown), a start link
 * ("Link text after ?start=", "Exactly" or "Starts with", "Save the rest as", the full link with
 * "Copy"), anything else ("Text only", "Media only", "Anything"), a payment done or a refund (the
 * invoice, or "Any invoice", PAY-02); a subscription change (the invoice and which change), the
 * user blocking or restarting the bot (what it means, in a line) and a broadcast ("Who gets it":
 * "Everyone" or the users its conditions take; "When" in words) (EVT-02); `/start` has no fields.
 */
export function StartForm({ step }: { step: StartStep }) {
  const design = useDesign()
  const { edits, readOnly } = useEditor()
  const { trigger } = step
  const set = (next: Trigger) => {
    edits.steps.set(step.id, { trigger: next })
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid gap-5 p-4">
        <h2 className="flex min-w-0 items-center gap-2 text-headline">
          <PlayIcon aria-hidden className="size-4 shrink-0 text-fg-3" />
          <span dir="auto" className="truncate">
            {step.title}
          </span>
        </h2>
        {isTheStart(step, design.steps) ? (
          <p className="text-callout text-fg-2">Every chat starts here</p>
        ) : (
          <fieldset disabled={readOnly} className="grid min-w-0 gap-5">
            {trigger.type === 'command' ? <CommandFields step={step} trigger={trigger} set={set} /> : null}
            {trigger.type === 'startLink' ? <StartLinkFields trigger={trigger} set={set} /> : null}
            {trigger.type === 'fallback' ? <FallbackFields trigger={trigger} set={set} /> : null}
            {trigger.type === 'paymentDone' || trigger.type === 'refunded' ? (
              <PaymentFields trigger={trigger} set={set} />
            ) : null}
            {trigger.type === 'subscriptionChanged' ? <SubscriptionFields trigger={trigger} set={set} /> : null}
            {trigger.type === 'userBlocks' || trigger.type === 'userRestarts' ? (
              <p className="text-callout text-fg-2">{BLOCK_HINTS[trigger.type]}</p>
            ) : null}
            {trigger.type === 'broadcast' ? <BroadcastFields trigger={trigger} set={set} /> : null}
          </fieldset>
        )}
        {trigger.type === 'startLink' ? <LinkRow payload={trigger.payload} /> : null}
      </div>
    </div>
  )
}

function CommandFields({
  step,
  trigger,
  set,
}: {
  step: StartStep
  trigger: Of<'command'>
  set: (trigger: Trigger) => void
}) {
  const design = useDesign()
  return (
    <>
      <PrefixedField
        label="Command"
        prefix="/"
        placeholder="command"
        value={trigger.command}
        onChange={(text) => {
          set({ ...trigger, command: typedCommand(text) })
        }}
        rule={COMMAND_RULE}
        valid={commandFits(trigger.command)}
        problem={sameCommand(step, design.steps)}
      />
      <SwitchRow
        label="Show in the commands menu"
        checked={trigger.inMenu}
        onChange={(inMenu) => {
          set({ ...trigger, inMenu })
        }}
      />
      <PlainTextField
        at={{ step: step.id, field: 'menuDescription' }}
        text={trigger.menuDescription}
        label="Menu text"
        max={MENU_TEXT_MAX}
      />
    </>
  )
}

function StartLinkFields({ trigger, set }: { trigger: Of<'startLink'>; set: (trigger: Trigger) => void }) {
  return (
    <>
      <PrefixedField
        label="Link text after ?start="
        prefix="?start="
        value={trigger.payload}
        onChange={(text) => {
          set({ ...trigger, payload: text.trim() })
        }}
        rule={PAYLOAD_RULE}
        valid={payloadFits(trigger.payload)}
      />
      <ToggleGroup
        aria-label="How the link text matches"
        spacing={0}
        value={[trigger.match]}
        onValueChange={([match]) => {
          // An exact link has no rest to save.
          if (match === 'exact') set({ ...trigger, match, saveRestTo: undefined })
          else if (match === 'prefix') set({ ...trigger, match })
        }}
      >
        <ToggleGroupItem value="exact">Exactly</ToggleGroupItem>
        <ToggleGroupItem value="prefix">Starts with</ToggleGroupItem>
      </ToggleGroup>
      {trigger.match === 'prefix' ? (
        <SaveRestAs
          value={trigger.saveRestTo}
          onChange={(saveRestTo) => {
            set({ ...trigger, saveRestTo })
          }}
        />
      ) : null}
    </>
  )
}

/** The full start link with "Copy" (also for Commenter and Viewer). */
function LinkRow({ payload }: { payload: string }) {
  const design = useDesign()
  const link = startLink(design, payload)
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-surface px-3 py-1.5">
      <code dir="ltr" className="min-w-0 flex-1 truncate font-mono text-footnote">
        {link}
      </code>
      <CopyButton value={link} label="Copy" showLabel />
    </div>
  )
}

function FallbackFields({ trigger, set }: { trigger: Of<'fallback'>; set: (trigger: Trigger) => void }) {
  return (
    <ToggleGroup
      aria-label="Accepts"
      spacing={0}
      value={[trigger.accepts]}
      onValueChange={([accepts]) => {
        if (accepts === 'text' || accepts === 'media' || accepts === 'any') set({ ...trigger, accepts })
      }}
    >
      <ToggleGroupItem value="text">Text only</ToggleGroupItem>
      <ToggleGroupItem value="media">Media only</ToggleGroupItem>
      <ToggleGroupItem value="any">Anything</ToggleGroupItem>
    </ToggleGroup>
  )
}

// What each payment start point takes, under its invoice.
const PAYMENT_HINTS = {
  paymentDone:
    'Takes the payments the invoice\'s "Paid" arrow does not: a subscription paid again, or an invoice without "Paid".',
  refunded: "Takes the refunds of the invoice's payments.",
}

function PaymentFields({
  trigger,
  set,
}: {
  trigger: Of<'paymentDone'> | Of<'refunded'>
  set: (trigger: Trigger) => void
}) {
  return (
    <Field label="Invoice" hint={PAYMENT_HINTS[trigger.type]}>
      {(labelId) => (
        <InvoiceSelect
          aria-labelledby={labelId}
          any="Any invoice"
          value={trigger.invoice}
          onChange={(invoice) => {
            set({ type: trigger.type, ...(invoice === undefined ? {} : { invoice }) })
          }}
        />
      )}
    </Field>
  )
}

const ANY = 'any'

// Which change of the subscription the start point takes.
const STATE_ITEMS: readonly { value: SubscriptionState | typeof ANY; label: string }[] = [
  { value: ANY, label: 'Any change' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'active', label: 'Turned back on' },
  { value: 'failed', label: 'Could not be paid' },
]

function SubscriptionFields({ trigger, set }: { trigger: Of<'subscriptionChanged'>; set: (trigger: Trigger) => void }) {
  // The invoice and the state, each left out for any.
  const write = (invoice: string | undefined, state: SubscriptionState | undefined) => {
    set({
      type: 'subscriptionChanged',
      ...(invoice === undefined ? {} : { invoice }),
      ...(state === undefined ? {} : { state }),
    })
  }
  return (
    <>
      <Field label="Invoice" hint="Takes the changes of the user's Stars subscription of this invoice.">
        {(labelId) => (
          <InvoiceSelect
            aria-labelledby={labelId}
            any="Any invoice"
            subscriptions
            value={trigger.invoice}
            onChange={(invoice) => {
              write(invoice, trigger.state)
            }}
          />
        )}
      </Field>
      <Field label="Change">
        {(labelId) => (
          <Select<string>
            items={STATE_ITEMS}
            value={trigger.state ?? ANY}
            onValueChange={(next) => {
              if (next === null || next === (trigger.state ?? ANY)) return
              const state = STATE_ITEMS.find((item) => item.value === next)?.value
              write(trigger.invoice, state === ANY ? undefined : state)
            }}
          >
            <SelectTrigger size="sm" className="w-full" aria-labelledby={labelId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    </>
  )
}

// What the block and the restart start points take.
const BLOCK_HINTS = {
  userBlocks:
    'Runs when the user blocks the bot. Until they restart it, the bot cannot send them anything: only steps without a message can follow.',
  userRestarts: "Runs when the user restarts the bot after blocking it. Telegram's Restart button also sends /start.",
}

function BroadcastFields({ trigger, set }: { trigger: Of<'broadcast'>; set: (trigger: Trigger) => void }) {
  const design = useDesign()
  const whenId = useId()
  const { audience } = trigger
  return (
    <>
      <Field label="Who gets it" hint="Only users who started the bot and did not block it.">
        {(labelId) => (
          <ToggleGroup
            aria-labelledby={labelId}
            spacing={0}
            value={[audience === 'everyone' ? 'everyone' : 'some']}
            onValueChange={([choice]) => {
              if (choice === 'everyone' && audience !== 'everyone') set({ ...trigger, audience: 'everyone' })
              else if (choice === 'some' && audience === 'everyone') {
                set({ ...trigger, audience: { all: [newCondition(design)] } })
              }
            }}
          >
            <ToggleGroupItem value="everyone">Everyone</ToggleGroupItem>
            <ToggleGroupItem value="some">Some users</ToggleGroupItem>
          </ToggleGroup>
        )}
      </Field>
      {audience === 'everyone' ? null : (
        <ConditionList
          when={audience}
          lead="To the users for whom"
          onChange={(when) => {
            set({ ...trigger, audience: when })
          }}
        />
      )}
      <div className="grid gap-2">
        <Label htmlFor={whenId}>When</Label>
        <Input
          id={whenId}
          dir="auto"
          placeholder="Every Monday at 9:00"
          value={trigger.when}
          onChange={(event) => {
            set({ ...trigger, when: event.target.value })
          }}
        />
        <p className="text-footnote text-fg-3">In words: the developer schedules it.</p>
      </div>
    </>
  )
}
