// A button's popover (docs/plan/04 section 5.3): "Text" per language, "Look", "Icon", "Disabled
// (does nothing)" for inline buttons, "When pressed" with its fields, and "Delete button". It
// opens beside the selected button of the phone (`useSelection((s) => s.button)`), in the page;
// every change goes through SPEC-04's accessors at once, so the phone and the map follow.
import {
  type Button as DesignButton,
  type InlineAction,
  type InlineButton,
  type Look,
  type ReplyAction,
  type ReplyButton,
  type StepId,
  telegram,
  type VariableType,
} from '@xdesign/spec'
import { type RefObject, useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

import { useDesign, useEditor } from '../../context'
import { RememberLines } from '../../forms/RememberForm'
import { isSending, rowsOf } from '../../map/arrows'
import { useSelectionStore } from '../../selection'
import { Choice, FormRow, LangInputs, Pick, SwitchRow, TargetPicker, VariablePicker } from './fields'

/** A "When pressed" choice's words, from the catalog (BUTTON_KINDS' editor names). */
function kindLabel(id: string): string {
  return telegram.BUTTON_KINDS.find((kind) => kind.id === id)?.label ?? id
}

const INLINE_ACTIONS: readonly { value: InlineAction['type']; kind: string }[] = [
  { value: 'goTo', kind: 'callback' },
  { value: 'url', kind: 'url' },
  { value: 'copyText', kind: 'copy_text' },
  { value: 'loginUrl', kind: 'login_url' },
  // An invoice's pay button (PAY-02): offered on invoices only.
  { value: 'pay', kind: 'pay' },
]

const REPLY_ACTIONS: readonly { value: ReplyAction['type']; kind: string }[] = [
  { value: 'text', kind: 'text' },
  { value: 'sharePhone', kind: 'request_contact' },
  { value: 'shareLocation', kind: 'request_location' },
  { value: 'pickUsers', kind: 'request_users' },
  { value: 'pickChat', kind: 'request_chat' },
  { value: 'createPoll', kind: 'request_poll' },
]

// The kind of variable each bottom button action saves.
const SAVES: Record<Exclude<ReplyAction['type'], 'text'>, VariableType> = {
  sharePhone: 'phone',
  shareLocation: 'location',
  pickUsers: 'users',
  pickChat: 'chat',
  createPoll: 'poll',
}

const SHOW: readonly { value: 'edit' | 'new' | 'replace'; label: string }[] = [
  { value: 'edit', label: 'Editing this message' },
  { value: 'new', label: 'Sending a new message' },
  { value: 'replace', label: 'Deleting this one and sending a new one' },
]

const POPUPS: readonly { value: 'none' | 'toast' | 'alert'; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'toast', label: 'Small toast' },
  { value: 'alert', label: 'Alert window' },
]

// The swatches' colors, as the map's pills draw the looks.
const SWATCHES: Record<Look, string> = {
  default: 'border border-border-strong bg-surface-2',
  primary: 'bg-tg-blue',
  success: 'bg-ok',
  danger: 'bg-error',
}

/** What a button does once its "When pressed" changes: the new kind's defaults. */
function newInlineAction(type: InlineAction['type']): InlineAction {
  switch (type) {
    case 'goTo':
      return { type, show: 'edit' }
    case 'url':
      return { type, url: '' }
    case 'copyText':
      return { type, text: {} }
    case 'loginUrl':
      return { type, url: '', requestWriteAccess: false }
    case 'pay':
      return { type }
  }
}

/** A bottom button's new action, keeping the step it goes to where the new kind can go there. */
function newReplyAction(type: ReplyAction['type'], old: ReplyAction): ReplyAction {
  const goTo = old.goTo === 'back' ? undefined : old.goTo
  switch (type) {
    case 'text':
      return { type, goTo: old.goTo }
    case 'sharePhone':
    case 'shareLocation':
      return { type, goTo }
    case 'pickUsers':
      return { type, max: 1, askName: false, askUsername: false, askPhoto: false, goTo }
    case 'pickChat':
      return { type, channel: false, askTitle: false, askUsername: false, askPhoto: false, goTo }
    case 'createPoll':
      return { type, pollType: 'any', goTo }
  }
}

/** A yes, no or either choice of an optional switch of the Bot API (left out: either). */
function either(value: boolean | undefined): 'any' | 'yes' | 'no' {
  return value === undefined ? 'any' : value ? 'yes' : 'no'
}

function fromEither(value: 'any' | 'yes' | 'no'): boolean | undefined {
  return value === 'any' ? undefined : value === 'yes'
}

/**
 * The popover of the selected button, beside it on the phone (`anchor`); closing it (a click
 * elsewhere, Escape) unselects the button. Without a step it is a row part's button (PARTS-01's
 * part editor): no "Draw on the map", and its last button leaves the part empty.
 */
export function ButtonPopover({
  button,
  stepId,
  anchor,
  close,
}: {
  button: DesignButton | undefined
  stepId: StepId | undefined
  anchor: () => Element | null
  close: () => void
}) {
  const first = useRef<HTMLInputElement>(null)
  return (
    <Popover
      open={button !== undefined}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <PopoverContent
        anchor={anchor}
        side="left"
        align="start"
        sideOffset={12}
        aria-label="Button"
        className="flex w-80 flex-col gap-4"
        initialFocus={() => {
          // The text first, chosen whole, so typing replaces it.
          first.current?.select()
          return first.current ?? true
        }}
      >
        {button ? <ButtonForm key={button.id} button={button} stepId={stepId} first={first} close={close} /> : null}
      </PopoverContent>
    </Popover>
  )
}

function ButtonForm({
  button,
  stepId,
  first,
  close,
}: {
  button: DesignButton
  stepId: StepId | undefined
  first: RefObject<HTMLInputElement | null>
  close: () => void
}) {
  const design = useDesign()
  const { edits } = useEditor()
  const { id } = button
  const remove = () => {
    const step = stepId === undefined ? undefined : design.steps[stepId]
    const buttons = isSending(step) ? rowsOf(design, step).flat() : []
    // The keyboard's last button takes the keyboard with it (a keyboard without buttons sends nothing).
    if (stepId !== undefined && buttons.length === 1 && buttons[0]?.id === id) edits.keyboard.setType(stepId, null)
    else edits.buttons.remove(id)
    close()
  }
  return (
    <>
      <FormRow label="Text">
        <LangInputs
          label="Text"
          value={button.label}
          firstRef={first}
          onChange={(lang, text) => {
            edits.buttons.setLabel(id, lang, text)
          }}
        />
      </FormRow>
      <FormRow label="Look">
        <ToggleGroup
          variant="outline"
          spacing={1}
          aria-label="Look"
          className="grid w-full grid-cols-4"
          value={[button.look]}
          onValueChange={(next: unknown[]) => {
            const look = telegram.LOOKS.find((row) => row.id === next[0])
            if (look) edits.buttons.setLook(id, look.id)
          }}
        >
          {telegram.LOOKS.map((look) => (
            <ToggleGroupItem
              key={look.id}
              value={look.id}
              className="h-auto min-w-0 flex-col gap-0.5 rounded-lg px-1 py-1.5"
            >
              <span aria-hidden className={cn('size-4 rounded-full', SWATCHES[look.id])} />
              <span className="text-caption">{look.label}</span>
              <span className="text-caption-2 font-normal text-fg-3">{look.style ?? ' '}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FormRow>
      <FormRow label="Icon">
        <Choice
          label="Icon"
          value={button.icon ? 'custom' : 'none'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'custom', label: 'Custom emoji' },
          ]}
          onChange={(choice) => {
            edits.buttons.setIcon(id, choice === 'none' ? undefined : { customEmojiId: '', fallback: '' })
          }}
        />
        {button.icon ? <IconFields id={id} icon={button.icon} /> : null}
      </FormRow>
      {button.place === 'inline' ? (
        <>
          <SwitchRow
            label={kindLabel('disabled')}
            checked={button.disabled === true}
            onChange={(on) => {
              edits.buttons.setDisabled(id, on)
            }}
          />
          <InlineActionFields button={button} stepId={stepId} close={close} />
        </>
      ) : (
        <ReplyActionFields button={button} />
      )}
      <Button type="button" variant="destructive" size="sm" className="self-start" onClick={remove}>
        Delete button
      </Button>
    </>
  )
}

function IconFields({ id, icon }: { id: string; icon: NonNullable<DesignButton['icon']> }) {
  const { edits } = useEditor()
  return (
    <div className="flex gap-2">
      <Input
        dir="ltr"
        inputMode="numeric"
        aria-label="Custom emoji ID"
        placeholder="Custom emoji ID"
        value={icon.customEmojiId}
        onChange={(event) => {
          edits.buttons.setIcon(id, { ...icon, customEmojiId: event.target.value.replace(/\D/g, '') })
        }}
      />
      <Input
        aria-label="Fallback emoji"
        placeholder="Fallback emoji"
        className="w-32 shrink-0"
        value={icon.fallback}
        onChange={(event) => {
          edits.buttons.setIcon(id, { ...icon, fallback: event.target.value })
        }}
      />
    </div>
  )
}

function InlineActionFields({
  button,
  stepId,
  close,
}: {
  button: InlineButton
  stepId: StepId | undefined
  close: () => void
}) {
  const design = useDesign()
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const { id, action } = button
  const set = (next: InlineAction) => {
    edits.buttons.setAction(id, next)
  }
  const invoice = stepId === undefined ? undefined : design.steps[stepId]
  const actions = INLINE_ACTIONS.filter(
    (item) => item.value !== 'pay' || invoice?.kind === 'invoice' || action.type === 'pay',
  )
  return (
    <>
      <FormRow label="When pressed">
        <Pick
          label="When pressed"
          value={action.type}
          items={actions.map((item) => ({ value: item.value, label: kindLabel(item.kind) }))}
          onChange={(type) => {
            const chosen = actions.find((item) => item.value === type)
            if (chosen && chosen.value !== action.type) set(newInlineAction(chosen.value))
          }}
        />
      </FormRow>
      {action.type === 'goTo' ? (
        <>
          <FormRow label="Goes to">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <TargetPicker
                  label="Goes to"
                  value={action.target}
                  back
                  stay
                  onChange={(target) => {
                    edits.buttons.setTarget(id, target)
                  }}
                />
              </div>
              {stepId === undefined ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    close()
                    selection.reveal(stepId)
                    toast("Drag from the button's dot on the map to a step.")
                  }}
                >
                  Draw on the map
                </Button>
              )}
            </div>
          </FormRow>
          {action.target === 'stay' ? null : (
            <FormRow label="Show it by">
              <Pick
                label="Show it by"
                value={action.show}
                items={SHOW}
                onChange={(show) => {
                  const chosen = SHOW.find((item) => item.value === show)
                  if (chosen) set({ ...action, show: chosen.value })
                }}
              />
            </FormRow>
          )}
          <FormRow label="Popup">
            <Choice
              label="Popup"
              value={action.popup?.kind ?? 'none'}
              options={POPUPS}
              onChange={(kind) => {
                set({ ...action, popup: kind === 'none' ? undefined : { kind, text: action.popup?.text ?? {} } })
              }}
            />
            {action.popup ? (
              <LangInputs
                label="Popup text"
                value={action.popup.text}
                onChange={(lang, text) => {
                  edits.texts.setPlain({ button: id, field: 'popup' }, lang, text)
                }}
              />
            ) : null}
          </FormRow>
          <FormRow label="Also remember">
            <div className="grid gap-2">
              <RememberLines
                lines={action.remember ?? []}
                onChange={(lines) => {
                  set({ ...action, remember: lines.length > 0 ? lines : undefined })
                }}
              />
            </div>
          </FormRow>
        </>
      ) : null}
      {action.type === 'url' || action.type === 'loginUrl' ? (
        <FormRow label="Link">
          <Input
            dir="ltr"
            aria-label="Link"
            placeholder="https://"
            value={action.url}
            onChange={(event) => {
              set({ ...action, url: event.target.value })
            }}
          />
          {action.type === 'loginUrl' ? (
            <SwitchRow
              label="Ask to let the bot message them"
              checked={action.requestWriteAccess}
              onChange={(on) => {
                set({ ...action, requestWriteAccess: on })
              }}
            />
          ) : null}
        </FormRow>
      ) : null}
      {action.type === 'copyText' ? (
        <FormRow label="Text to copy">
          <LangInputs
            label="Text to copy"
            value={action.text}
            onChange={(lang, text) => {
              edits.texts.setPlain({ button: id, field: 'copyText' }, lang, text)
            }}
          />
        </FormRow>
      ) : null}
    </>
  )
}

const ANY_YES_NO = (yes: string, no: string) =>
  [
    { value: 'any', label: 'Any' },
    { value: 'yes', label: yes },
    { value: 'no', label: no },
  ] as const

function ReplyActionFields({ button }: { button: ReplyButton }) {
  const { edits } = useEditor()
  const { id, action } = button
  const set = (next: ReplyAction) => {
    edits.buttons.setAction(id, next)
  }
  const pickUsers = telegram.limit('pickUsers')
  return (
    <>
      <FormRow label="When pressed">
        <Pick
          label="When pressed"
          value={action.type}
          items={REPLY_ACTIONS.map((item) => ({ value: item.value, label: kindLabel(item.kind) }))}
          onChange={(type) => {
            const chosen = REPLY_ACTIONS.find((item) => item.value === type)
            if (chosen && chosen.value !== action.type) set(newReplyAction(chosen.value, action))
          }}
        />
      </FormRow>
      {action.type === 'pickUsers' ? (
        <>
          <FormRow label="Users at most">
            <Input
              type="number"
              aria-label="Users at most"
              className="w-24"
              min={pickUsers.min}
              max={pickUsers.max}
              value={action.max}
              onChange={(event) => {
                const max = Math.round(Number(event.target.value))
                if (Number.isFinite(max)) {
                  set({ ...action, max: Math.min(pickUsers.max, Math.max(pickUsers.min, max)) })
                }
              }}
            />
          </FormRow>
          <FormRow label="Bots">
            <Choice
              label="Bots"
              value={either(action.bots)}
              options={ANY_YES_NO('Only bots', 'No bots')}
              onChange={(value) => {
                set({ ...action, bots: fromEither(value) })
              }}
            />
          </FormRow>
          <FormRow label="Premium users">
            <Choice
              label="Premium users"
              value={either(action.premium)}
              options={ANY_YES_NO('Only Premium', 'No Premium')}
              onChange={(value) => {
                set({ ...action, premium: fromEither(value) })
              }}
            />
          </FormRow>
          <FormRow label="Ask for">
            <SwitchRow
              label="Name"
              checked={action.askName}
              onChange={(on) => {
                set({ ...action, askName: on })
              }}
            />
            <SwitchRow
              label="Username"
              checked={action.askUsername}
              onChange={(on) => {
                set({ ...action, askUsername: on })
              }}
            />
            <SwitchRow
              label="Photo"
              checked={action.askPhoto}
              onChange={(on) => {
                set({ ...action, askPhoto: on })
              }}
            />
          </FormRow>
        </>
      ) : null}
      {action.type === 'pickChat' ? (
        <>
          <FormRow label="Pick">
            <Choice
              label="Pick"
              value={action.channel ? 'channel' : 'group'}
              options={[
                { value: 'group', label: 'A group' },
                { value: 'channel', label: 'A channel' },
              ]}
              onChange={(value) => {
                const channel = value === 'channel'
                set({ ...action, channel, forum: channel ? undefined : action.forum })
              }}
            />
          </FormRow>
          {action.channel ? null : (
            <FormRow label="Forum">
              <Choice
                label="Forum"
                value={either(action.forum)}
                options={ANY_YES_NO('A forum', 'Not a forum')}
                onChange={(value) => {
                  set({ ...action, forum: fromEither(value) })
                }}
              />
            </FormRow>
          )}
          <FormRow label="Username">
            <Choice
              label="Username"
              value={either(action.hasUsername)}
              options={ANY_YES_NO('Has one', 'Has none')}
              onChange={(value) => {
                set({ ...action, hasUsername: fromEither(value) })
              }}
            />
          </FormRow>
          <SwitchRow
            label="The user owns it"
            checked={action.userIsOwner === true}
            onChange={(on) => {
              set({ ...action, userIsOwner: on || undefined })
            }}
          />
          <SwitchRow
            label="The bot is in it"
            checked={action.botIsMember === true}
            onChange={(on) => {
              set({ ...action, botIsMember: on || undefined })
            }}
          />
          <FormRow label="Ask for">
            <SwitchRow
              label="Title"
              checked={action.askTitle}
              onChange={(on) => {
                set({ ...action, askTitle: on })
              }}
            />
            <SwitchRow
              label="Username"
              checked={action.askUsername}
              onChange={(on) => {
                set({ ...action, askUsername: on })
              }}
            />
            <SwitchRow
              label="Photo"
              checked={action.askPhoto}
              onChange={(on) => {
                set({ ...action, askPhoto: on })
              }}
            />
          </FormRow>
        </>
      ) : null}
      {action.type === 'createPoll' ? (
        <FormRow label="Poll type">
          <Choice
            label="Poll type"
            value={action.pollType}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'regular', label: 'Regular' },
              { value: 'quiz', label: 'Quiz' },
            ]}
            onChange={(pollType) => {
              set({ ...action, pollType })
            }}
          />
        </FormRow>
      ) : null}
      <FormRow label="Goes to">
        <TargetPicker
          label="Goes to"
          value={action.goTo}
          back={action.type === 'text'}
          stay={false}
          onChange={(target) => {
            edits.buttons.setTarget(id, target)
          }}
        />
      </FormRow>
      {action.type === 'text' ? (
        <FormRow label="Also remember">
          <div className="grid gap-2">
            <RememberLines
              lines={action.remember ?? []}
              onChange={(lines) => {
                set({ ...action, remember: lines.length > 0 ? lines : undefined })
              }}
            />
          </div>
        </FormRow>
      ) : (
        <FormRow label="Save it as">
          <VariablePicker
            label="Save it as"
            value={action.saveTo}
            type={SAVES[action.type]}
            onChange={(saveTo) => {
              set({ ...action, saveTo })
            }}
          />
        </FormRow>
      )}
    </>
  )
}
