import { type ChatAction, type LinkPreview, type MessageStep, type Options, type Target, telegram } from '@xdesign/spec'
import { useId } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useDesign, useEditor } from '../../context'
import { type PhoneStep, setShown, shownOf, useUpdateContent } from '../message'
import { NumberInput } from '../NumberInput'

/**
 * "Options" under the phone (04 section 5.5): how the message is sent. "Silent (no sound)",
 * "Protect (no forwarding or saving)", the media's caption above it and spoiler where the kind
 * takes them, "Write it out like a draft" on a text or rich message (RICH-01) with a message's
 * stop button (RICH-02), a text's "Link preview", "Message effect", "Before sending" (a chat
 * action for N seconds, a wait) and a message's "Then".
 */
export function OptionsSection({ step }: { step: PhoneStep }) {
  const { edits, readOnly } = useEditor()
  const update = useUpdateContent(step.id)
  const { content, options } = shownOf(step)
  const kind = telegram.messageKind(content.type)
  const headingId = useId()
  const setOptions = (patch: Partial<Options>) => {
    setShown(edits, step, { options: { ...options, ...patch } })
  }
  // The draft's options; without its stop button "If the user stops it" goes too, in one change.
  const setDraft = (patch: Partial<Options>) => {
    const next = { ...options, ...patch }
    if (step.kind === 'message' && next.draftStop !== true && step.onStop !== undefined) {
      edits.steps.set(step.id, { options: next, onStop: undefined })
    } else setOptions(patch)
  }
  const media =
    content.type === 'photo' || content.type === 'livePhoto' || content.type === 'video' || content.type === 'animation'
      ? content
      : undefined
  const setMedia = (patch: { spoiler?: true | undefined; captionAbove?: true | undefined }) => {
    update((now) =>
      now.type === 'photo' || now.type === 'livePhoto' || now.type === 'video' || now.type === 'animation'
        ? { ...now, ...patch }
        : undefined,
    )
  }

  return (
    <section aria-labelledby={headingId} className="border-t px-4 py-4">
      <h2 id={headingId} className="mb-3 text-callout font-semibold">
        Options
      </h2>
      <fieldset disabled={readOnly} className="grid min-w-0 gap-4">
        <SwitchRow
          label="Silent (no sound)"
          checked={options.silent === true}
          onChange={(silent) => {
            setOptions({ silent: silent ? true : undefined })
          }}
        />
        <SwitchRow
          label="Protect (no forwarding or saving)"
          checked={options.protect === true}
          onChange={(protect) => {
            setOptions({ protect: protect ? true : undefined })
          }}
        />
        {telegram.draftMethod(content.type) ? (
          <SwitchRow
            label="Write it out like a draft"
            checked={options.draft === true}
            onChange={(draft) => {
              setDraft(draft ? { draft: true } : { draft: undefined, draftStop: undefined, draftKeep: undefined })
            }}
          />
        ) : null}
        {step.kind === 'message' && telegram.draftMethod(content.type) && options.draft === true ? (
          <DraftStop step={step} setDraft={setDraft} />
        ) : null}
        {media && kind.captionAbove ? (
          <SwitchRow
            label="Caption above the media"
            checked={media.captionAbove === true}
            onChange={(above) => {
              setMedia({ captionAbove: above ? true : undefined })
            }}
          />
        ) : null}
        {media && kind.spoiler ? (
          <SwitchRow
            label="Hide under a spoiler"
            checked={media.spoiler === true}
            onChange={(spoiler) => {
              setMedia({ spoiler: spoiler ? true : undefined })
            }}
          />
        ) : null}
        {content.type === 'text' ? (
          <LinkPreviewField
            value={options.linkPreview}
            onChange={(linkPreview) => {
              setOptions({ linkPreview })
            }}
          />
        ) : null}
        {kind.effect ? (
          <EffectField
            value={options.effect}
            onChange={(effect) => {
              setOptions({ effect })
            }}
          />
        ) : null}
        <BeforeSending options={options} contentType={content.type} setOptions={setOptions} />
        {step.kind === 'message' ? <ThenField step={step} /> : null}
      </fieldset>
    </section>
  )
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

const noPreviewSetting = (value: LinkPreview) =>
  !value.off && value.url === undefined && value.size === 'auto' && !value.above

// "Link preview": which link (the first one, none, or a given one), its picture's size and place.
function LinkPreviewField({
  value,
  onChange,
}: {
  value: LinkPreview | undefined
  onChange: (value: LinkPreview | undefined) => void
}) {
  const labelId = useId()
  const current: LinkPreview = value ?? { off: false, size: 'auto', above: false }
  const mode = current.off ? 'off' : current.url !== undefined ? 'url' : 'auto'
  // Automatic with Telegram's own size and place is no setting at all.
  const set = (patch: Partial<LinkPreview>) => {
    const next = { ...current, ...patch }
    onChange(noPreviewSetting(next) ? undefined : next)
  }
  return (
    <div className="grid gap-2">
      <p id={labelId} className="text-subhead font-semibold text-fg-2">
        Link preview
      </p>
      <ToggleGroup
        aria-labelledby={labelId}
        spacing={0}
        value={[mode]}
        onValueChange={([chosen]) => {
          if (chosen === 'auto') set({ off: false, url: undefined })
          else if (chosen === 'off') set({ off: true, url: undefined })
          else if (chosen === 'url') set({ off: false, url: current.url ?? '' })
        }}
      >
        <ToggleGroupItem value="auto">Automatic</ToggleGroupItem>
        <ToggleGroupItem value="off">Off</ToggleGroupItem>
        <ToggleGroupItem value="url">Use this link</ToggleGroupItem>
      </ToggleGroup>
      {mode === 'url' ? (
        <Input
          aria-label="Link"
          dir="ltr"
          placeholder="https://"
          value={current.url ?? ''}
          onChange={(event) => {
            set({ url: event.target.value })
          }}
        />
      ) : null}
      {mode === 'off' ? null : (
        <>
          <ToggleGroup
            aria-label="Picture size"
            spacing={0}
            value={current.size === 'auto' ? [] : [current.size]}
            onValueChange={([size]) => {
              set({ size: size === 'small' || size === 'large' ? size : 'auto' })
            }}
          >
            <ToggleGroupItem value="small">Small</ToggleGroupItem>
            <ToggleGroupItem value="large">Large</ToggleGroupItem>
          </ToggleGroup>
          <SwitchRow
            label="Show above the text"
            checked={current.above}
            onChange={(above) => {
              set({ above })
            }}
          />
        </>
      )}
    </div>
  )
}

// "thumbsUp" as "Thumbs up".
function effectName(id: string): string {
  const words = id.replace(/([A-Z])/g, ' $1').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// "Message effect": none or one of the catalog's effects, stored as its message_effect_id.
function EffectField({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const labelId = useId()
  const chosen = telegram.EFFECTS.find((row) => row.effectId === value || row.id === value)
  return (
    <div className="grid gap-2">
      <p id={labelId} className="text-subhead font-semibold text-fg-2">
        Message effect
      </p>
      <ToggleGroup
        aria-labelledby={labelId}
        spacing={0}
        className="flex-wrap"
        value={[chosen?.effectId ?? 'none']}
        onValueChange={([effect]) => {
          if (effect !== undefined) onChange(effect === 'none' ? undefined : effect)
        }}
      >
        <ToggleGroupItem value="none">None</ToggleGroupItem>
        {telegram.EFFECTS.map((row) => (
          <ToggleGroupItem
            key={row.id}
            value={row.effectId}
            aria-label={effectName(row.id)}
            title={effectName(row.id)}
            className="text-body"
          >
            {row.emoji}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

const actionItems = telegram.CHAT_ACTIONS.map((row) => ({ value: row.id, label: row.label }))
const firstSeconds = { action: 3, wait: 2 }

// "Before sending": "Show typing..." (or another chat action) for N seconds, and "Wait N seconds".
function BeforeSending({
  options,
  contentType,
  setOptions,
}: {
  options: Options
  contentType: string
  setOptions: (patch: Partial<Options>) => void
}) {
  const showId = useId()
  const waitId = useId()
  const fitting =
    telegram.CHAT_ACTIONS.find((row) => (row.kinds as readonly string[]).includes(contentType))?.id ?? 'typing'
  const { chatAction } = options
  const action = chatAction?.action ?? fitting
  const seconds = chatAction?.seconds ?? firstSeconds.action
  return (
    <div className="grid gap-2">
      <p className="text-subhead font-semibold text-fg-2">Before sending</p>
      <div className="flex flex-wrap items-center gap-2 text-body">
        <Switch
          id={showId}
          aria-label="Show a chat action"
          checked={chatAction !== undefined}
          onCheckedChange={(on) => {
            setOptions({ chatAction: on ? { action, seconds } : undefined })
          }}
        />
        <label htmlFor={showId}>Show</label>
        <Select<ChatAction>
          items={actionItems}
          value={action}
          disabled={chatAction === undefined}
          onValueChange={(next) => {
            if (next !== null) setOptions({ chatAction: { action: next, seconds } })
          }}
        >
          <SelectTrigger size="sm" aria-label="Chat action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>for</span>
        <NumberInput
          aria-label="Seconds of the chat action"
          className="h-(--control-h-sm) w-14"
          value={seconds}
          min={1}
          max={60}
          whole
          disabled={chatAction === undefined}
          onCommit={(next) => {
            setOptions({ chatAction: { action, seconds: next } })
          }}
        />
        <span>seconds</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-body">
        <Switch
          id={waitId}
          aria-label="Wait before sending"
          checked={options.delaySec !== undefined}
          onCheckedChange={(on) => {
            setOptions({ delaySec: on ? firstSeconds.wait : undefined })
          }}
        />
        <label htmlFor={waitId}>Wait</label>
        <NumberInput
          aria-label="Seconds to wait"
          className="h-(--control-h-sm) w-14"
          value={options.delaySec ?? firstSeconds.wait}
          min={1}
          max={60}
          whole
          disabled={options.delaySec === undefined}
          onCommit={(delaySec) => {
            setOptions({ delaySec })
          }}
        />
        <span>seconds</span>
      </div>
    </div>
  )
}

// The steps a message can go on to: not start points, notes, sections or itself.
const notTargets = new Set(['start', 'note', 'frame'])

// "Then": the step the message goes on to without a click (also drawn on the map, MAP-01).
function ThenField({ step }: { step: MessageStep }) {
  const { edits } = useEditor()
  return (
    <TargetField
      step={step}
      label="Then"
      hint="Go on to another step without a click."
      value={step.next}
      onChange={(target) => {
        edits.steps.connect({ step: step.id, arrow: 'next' }, target)
      }}
    />
  )
}

/**
 * A draft's stop button (RICH-02): "Let the user stop it" (can_stop), then "Keep what was
 * written" (keep_on_stop) and "If the user stops it", also a dot on the message's box.
 */
function DraftStop({ step, setDraft }: { step: MessageStep; setDraft: (patch: Partial<Options>) => void }) {
  const { edits } = useEditor()
  const { options } = step
  return (
    <div className="grid gap-4 ps-6">
      <SwitchRow
        label={telegram.draftStopLabel('can_stop')}
        checked={options.draftStop === true}
        onChange={(on) => {
          setDraft(on ? { draftStop: true } : { draftStop: undefined, draftKeep: undefined })
        }}
      />
      {options.draftStop === true ? (
        <>
          <SwitchRow
            label={telegram.draftStopLabel('keep_on_stop')}
            checked={options.draftKeep === true}
            onChange={(keep) => {
              setDraft({ draftKeep: keep ? true : undefined })
            }}
          />
          <TargetField
            step={step}
            label={telegram.draftStopLabel('stopped_message_generation')}
            hint="Go on to another step when the user stops it."
            value={step.onStop}
            onChange={(target) => {
              edits.steps.connect({ step: step.id, arrow: 'onStop' }, target)
            }}
          />
        </>
      ) : null}
    </div>
  )
}

// A step the message goes on to, by its title: "None", "Back" while it is set, or another step.
function TargetField({
  step,
  label,
  hint,
  value,
  onChange,
}: {
  step: MessageStep
  label: string
  hint: string
  value: Target | undefined
  onChange: (target: Target | undefined) => void
}) {
  const design = useDesign()
  const labelId = useId()
  const targets = Object.values(design.steps)
    .filter((other) => other.id !== step.id && !notTargets.has(other.kind))
    .sort((a, b) => a.title.localeCompare(b.title))
  const items = [
    { value: 'none', label: 'None' },
    ...(value === 'back' ? [{ value: 'back', label: 'Back' }] : []),
    ...targets.map((other) => ({ value: other.id, label: other.title || other.idName })),
  ]
  return (
    <div className="grid gap-2">
      <p id={labelId} className="text-subhead font-semibold text-fg-2">
        {label}
      </p>
      <p className="-mt-1.5 text-footnote text-fg-3">{hint}</p>
      <Select<string>
        items={items}
        value={value ?? 'none'}
        onValueChange={(next) => {
          onChange(next === null || next === 'none' ? undefined : next)
        }}
      >
        <SelectTrigger size="sm" aria-labelledby={labelId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
