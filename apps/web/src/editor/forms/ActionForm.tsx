import { type Action, type ActionStep, type ActionType, newId, type StepId, telegram } from '@xdesign/spec'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { useDesign, useEditor } from '../context'
import { Field, FormSection, TargetSelect } from './fields'
import { GiftBubble } from './GiftBubble'
import { InvoiceSelect } from './InvoiceSelect'
import type { Item } from './logic'
import { SwitchRow } from './start/fields'

/**
 * The Action form (03 section 7.3, 04 section 6): "Does" (the kind of action), the kind's fields,
 * then "Then", its dot's arrow. A reaction has "Emoji" (Telegram's reaction emoji), "On" (the
 * user's last message or the message a step sent last) and "Big animation"; a pin, an unpin and a
 * delete their "Message" (an unpin also "The newest pinned message"); a gift its card with the
 * text written in place, "Which gift" and "Also pay for the upgrade"; a chat action "Show"; a
 * refund its invoice (PAY-02). EVT-02.
 */
export function ActionForm({ step }: { step: ActionStep }) {
  const { edits } = useEditor()
  const { action } = step
  return (
    <>
      <FormSection>
        <Field label="Does">
          {(labelId) => (
            <Select<string>
              items={KIND_ITEMS}
              value={action.type}
              onValueChange={(next) => {
                const kind = KIND_ITEMS.find((item) => item.value === next)?.value
                if (kind !== undefined && kind !== action.type) {
                  edits.steps.set(step.id, { action: newAction(kind, action) })
                }
              }}
            >
              <SelectTrigger size="sm" className="w-full" aria-labelledby={labelId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <ActionFields step={step} />
      </FormSection>
      <FormSection>
        <Field label="Then">
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
      </FormSection>
    </>
  )
}

/** The kinds of action in "Does". */
const KIND_ITEMS: readonly { value: ActionType; label: string }[] = [
  { value: 'react', label: 'Set a reaction' },
  { value: 'pin', label: 'Pin a message' },
  { value: 'unpin', label: 'Unpin a message' },
  { value: 'delete', label: 'Delete a message' },
  { value: 'gift', label: 'Send a gift' },
  { value: 'chatAction', label: 'Show a chat action' },
  { value: 'refund', label: 'Refund a payment' },
]

// A new action of a kind: a pin, an unpin or a delete keeps the message of the one before; a
// reaction starts with 👍 on the user's last message, a gift with an empty text, a chat action with
// "typing...".
function newAction(kind: ActionType, before: Action): Action {
  const message = 'step' in before ? before.step : before.type === 'react' ? before.onStep : undefined
  const step = message === 'userMessage' ? undefined : message
  switch (kind) {
    case 'react':
      return { type: 'react', emoji: '👍', onStep: step ?? 'userMessage' }
    case 'pin':
    case 'unpin':
    case 'delete':
      return step === undefined ? { type: kind } : { type: kind, step }
    case 'gift':
      return { type: 'gift', giftDescription: '', text: { id: newId(), doc: {} } }
    case 'chatAction':
      return { type: 'chatAction', action: 'typing' }
    case 'refund':
      return { type: 'refund' }
  }
}

// The fields of the action's kind.
function ActionFields({ step }: { step: ActionStep }) {
  const { edits } = useEditor()
  const { action } = step
  const set = (next: Action) => {
    edits.steps.set(step.id, { action: next })
  }
  switch (action.type) {
    case 'react':
      return (
        <>
          <Field label="Emoji" hint="One of Telegram's reaction emoji.">
            {(labelId) => (
              <EmojiPicker
                value={action.emoji}
                aria-labelledby={labelId}
                onChange={(emoji) => {
                  set({ ...action, emoji })
                }}
              />
            )}
          </Field>
          <Field label="On" hint="The bot reacts to the message this step sent the user last.">
            {(labelId) => (
              <MessageSelect
                aria-labelledby={labelId}
                extra={{ value: USER_MESSAGE, label: "The user's last message" }}
                value={action.onStep}
                onChange={(onStep) => {
                  set({ ...action, onStep })
                }}
              />
            )}
          </Field>
          <SwitchRow
            label="Big animation"
            checked={action.big === true}
            onChange={(big) => {
              set({ ...action, big: big ? true : undefined })
            }}
          />
        </>
      )
    case 'pin':
    case 'unpin':
    case 'delete':
      return (
        <Field label="Message" hint={MESSAGE_HINTS[action.type]}>
          {(labelId) => (
            <MessageSelect
              aria-labelledby={labelId}
              extra={action.type === 'unpin' ? { value: NEWEST, label: 'The newest pinned message' } : undefined}
              value={action.step ?? (action.type === 'unpin' ? NEWEST : undefined)}
              onChange={(next) => {
                const id = next === NEWEST || next === USER_MESSAGE ? undefined : next
                set(id === undefined ? { type: action.type } : { type: action.type, step: id })
              }}
            />
          )}
        </Field>
      )
    case 'gift':
      return <GiftFields action={action} set={set} />
    case 'chatAction':
      return (
        <Field label="Show" hint="Under the bot's name, for 5 seconds at most or until the bot's next message.">
          {(labelId) => (
            <Select<string>
              items={CHAT_ACTION_ITEMS}
              value={action.action}
              onValueChange={(next) => {
                const chosen = telegram.CHAT_ACTIONS.find((row) => row.id === next)?.id
                if (chosen !== undefined && chosen !== action.action) set({ type: 'chatAction', action: chosen })
              }}
            >
              <SelectTrigger size="sm" className="w-full" aria-labelledby={labelId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_ACTION_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )
    case 'refund':
      return (
        <Field label="Refund" hint="Gives back the user's Stars payment of this invoice.">
          {(labelId) => (
            <InvoiceSelect
              aria-labelledby={labelId}
              value={action.invoice}
              onChange={(invoice) => {
                set({ ...action, invoice })
              }}
            />
          )}
        </Field>
      )
  }
}

// What a pin, an unpin and a delete act on, under their message.
const MESSAGE_HINTS = {
  pin: 'Pins the message this step sent the user last. Telegram does not notify about it.',
  unpin: 'Unpins the message this step sent the user last.',
  delete: 'Deletes the message this step sent the user last, within 48 hours of sending it.',
}

const CHAT_ACTION_ITEMS: Item[] = telegram.CHAT_ACTIONS.map((row) => ({ value: row.id, label: row.label }))

// The select's values that are not steps.
const USER_MESSAGE = 'userMessage'
const NEWEST = 'newest'

/**
 * A step that sends a message (a message, a question or an invoice), by title, with `extra` first
 * ("The user's last message", "The newest pinned message"); a step no longer in the design shows
 * as "Deleted step".
 */
function MessageSelect({
  value,
  onChange,
  extra,
  ...label
}: {
  value: string | undefined
  onChange: (value: StepId) => void
  extra?: Item | undefined
  'aria-labelledby'?: string
}) {
  const design = useDesign()
  const steps = Object.values(design.steps)
    .filter((item) => item.kind === 'message' || item.kind === 'question' || item.kind === 'invoice')
    .sort((a, b) => (a.title || a.idName).localeCompare(b.title || b.idName))
  const items: Item[] = [
    ...(extra ? [extra] : []),
    ...steps.map((item) => ({ value: item.id, label: item.title || item.idName })),
  ]
  if (value !== undefined && !items.some((item) => item.value === value)) {
    items.push({ value, label: 'Deleted step' })
  }
  return (
    <Select<string>
      items={items}
      value={value ?? null}
      onValueChange={(next) => {
        if (next !== null && next !== value) onChange(next)
      }}
    >
      <SelectTrigger size="sm" className="w-full" {...label}>
        <SelectValue placeholder={steps.length === 0 ? 'No message yet' : 'Choose a message'} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <span className="truncate" dir="auto">
              {item.label}
            </span>
            {design.steps[item.value] ? (
              <span className="font-mono text-footnote text-fg-3">{design.steps[item.value]?.idName}</span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The reaction: the emoji chosen, and Telegram's reaction emoji in a grid to choose from. */
function EmojiPicker({
  value,
  onChange,
  ...label
}: {
  value: string
  onChange: (emoji: string) => void
  'aria-labelledby'?: string
}) {
  const [open, setOpen] = useState(false)
  const chosen = telegram.reactionEmoji(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="w-16 text-title-3" />}
        {...label}
      >
        {value === '' ? '?' : value}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div role="listbox" aria-label="Reaction emoji" className="grid grid-cols-8 gap-0.5">
          {telegram.REACTION_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={emoji === chosen}
              className="grid size-8 place-items-center rounded-md text-title-3 hover:bg-surface-2 aria-selected:bg-brand-weak"
              onClick={() => {
                onChange(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// A gift: its card on a small phone with the text written in place, "Which gift" in words and
// whether the bot also pays for the upgrade.
function GiftFields({ action, set }: { action: Extract<Action, { type: 'gift' }>; set: (action: Action) => void }) {
  const whichId = useId()
  return (
    <>
      {action.text ? <GiftBubble description={action.giftDescription} text={action.text} /> : null}
      <div className="grid gap-2">
        <label htmlFor={whichId} className="text-subhead font-semibold text-fg-2">
          Which gift
        </label>
        <p className="-mt-1.5 text-footnote text-fg-3">
          In words: the developer picks it from Telegram's gifts. It is paid from the bot's Stars.
        </p>
        <Textarea
          id={whichId}
          dir="auto"
          rows={2}
          placeholder="A teddy bear for 15 Stars"
          value={action.giftDescription}
          onChange={(event) => {
            set({ ...action, giftDescription: event.target.value })
          }}
        />
      </div>
      <SwitchRow
        label="Also pay for the upgrade"
        checked={action.payForUpgrade === true}
        onChange={(payForUpgrade) => {
          set({ ...action, payForUpgrade: payForUpgrade ? true : undefined })
        }}
      />
    </>
  )
}
