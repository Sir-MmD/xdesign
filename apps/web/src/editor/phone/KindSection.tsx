import { type Content, type DiceEmoji, DiceEmojiSchema, newId, telegram } from '@xdesign/spec'

import { Button } from '@/components/ui/button'

import { Field, FormSection } from '../forms/fields'
import { SwitchRow } from '../forms/start/fields'
import { Choice, VariablePicker } from './keyboard/fields'
import { type PhoneStep, shownOf, useUpdateContent } from './message'
import { NumberInput } from './NumberInput'
import { PollSection } from './poll/PollSection'
import { RichSection } from './rich/RichSection'

type Dice = Extract<Content, { type: 'dice' }>
type PaidMedia = Extract<Content, { type: 'paidMedia' }>

const stars = telegram.limit('paidMediaStars')
const diceEmoji = DiceEmojiSchema.options.map((emoji) => ({ value: emoji, label: emoji }))

/**
 * The settings of stage 2's kinds under the phone (04 section 5.1, MSG-03): a poll's or quiz's
 * (PollSection), a dice's emoji and "Save the roll as", paid media's price in Stars, "Caption above
 * the media" and its caption, a rich message's blocks (RichSection, RICH-01). Paid media's items
 * are edited from the bubble (MSG-01's media slot).
 */
export function KindSection({ step }: { step: PhoneStep }) {
  const { content } = shownOf(step)
  switch (content.type) {
    case 'poll':
    case 'quiz':
      return <PollSection step={step} poll={content} />
    case 'dice':
      return <DiceSection step={step} dice={content} />
    case 'paidMedia':
      return <PaidMediaSection step={step} paid={content} />
    case 'rich':
      return <RichSection step={step} rich={content} />
    default:
      return null
  }
}

function DiceSection({ step, dice }: { step: PhoneStep; dice: Dice }) {
  const update = useUpdateContent(step.id)
  const set = (fields: Partial<Dice>) => {
    update((now) => (now.type === 'dice' ? { ...now, ...fields } : undefined))
  }
  return (
    <FormSection title="Dice">
      <Field label="Emoji">
        {() => (
          <Choice<DiceEmoji>
            label="Emoji"
            value={dice.emoji}
            options={diceEmoji}
            onChange={(emoji) => {
              set({ emoji })
            }}
          />
        )}
      </Field>
      <Field label="Save the roll as" hint="The number Telegram rolled.">
        {() => (
          <VariablePicker
            label="Save the roll as"
            value={dice.saveTo}
            type="number"
            source="question"
            onChange={(saveTo) => {
              set({ saveTo })
            }}
          />
        )}
      </Field>
    </FormSection>
  )
}

function PaidMediaSection({ step, paid }: { step: PhoneStep; paid: PaidMedia }) {
  const update = useUpdateContent(step.id)
  const set = (fields: Partial<PaidMedia>) => {
    update((now) => (now.type === 'paidMedia' ? { ...now, ...fields } : undefined))
  }
  return (
    <FormSection title="Paid media">
      <Field label="Price in Stars" hint="Click the media in the bubble to change its items.">
        {(labelId) => (
          <NumberInput
            aria-labelledby={labelId}
            value={paid.stars}
            min={stars.min}
            max={stars.max}
            whole
            onCommit={(value) => {
              set({ stars: value })
            }}
          />
        )}
      </Field>
      <SwitchRow
        label="Caption above the media"
        checked={paid.captionAbove === true}
        onChange={(above) => {
          set({ captionAbove: above ? true : undefined })
        }}
      />
      {paid.caption ? null : (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            set({ caption: { id: newId(), doc: {} } })
          }}
        >
          Add a caption
        </Button>
      )}
    </FormSection>
  )
}
