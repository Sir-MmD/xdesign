import { TelegramMessage } from '@xdesign/preview'
import { type Content, newId, type RichTextRef, telegram } from '@xdesign/spec'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react'
import { createElement, type ReactNode, useId, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { useDesign, useLang } from '../../context'
import { Field, FormSection, OptionalNumber } from '../../forms/fields'
import { SwitchRow } from '../../forms/start/fields'
import { useLook } from '../../look'
import { VariablePicker } from '../keyboard/fields'
import { type PhoneStep, useUpdateContent } from '../message'
import { PhoneText } from '../text/PhoneText'

type Poll = Extract<Content, { type: 'poll' | 'quiz' }>

const options = telegram.limit('pollOptions')
const openPeriod = telegram.limit('pollOpenPeriod')

/** Where an option's index goes when the one at `from` moves to `to` (or is removed: `to` undefined). */
function moved(index: number, from: number, to: number | undefined): number | undefined {
  if (index === from) return to
  let at = index > from ? index - 1 : index
  if (to !== undefined && at >= to) at += 1
  return at
}

/**
 * A poll's or quiz's own settings under the phone (04 section 5.1, MSG-02's model): the options in
 * order (written in the bubble) with a quiz's right ones, moved up or down, removed and added (1 to
 * 12; a move or removal rewrites the right answers in the same change), "Anonymous voting",
 * "Multiple answers", revoting, shuffling, users adding options (a poll), hidden results, "Close
 * after (seconds)", a quiz's explanation (TXT-01's editor in a bubble of the look), and "Save the
 * vote as" (a poll's option text, a quiz's right or wrong as yes or no; not anonymous).
 */
export function PollSection({ step, poll }: { step: PhoneStep; poll: Poll }) {
  const design = useDesign()
  const lang = useLang()
  const update = useUpdateContent(step.id)
  const quiz = poll.type === 'quiz'
  const set = (change: (now: Poll) => Partial<Poll> | undefined) => {
    update((now) => {
      if ((now.type !== 'poll' && now.type !== 'quiz') || now.type !== poll.type) return undefined
      const fields = change(now)
      return fields ? ({ ...now, ...fields } as Content) : undefined
    })
  }
  const move = (from: number, to: number | undefined) => {
    set((now) => {
      const list = [...now.options]
      const [option] = list.splice(from, 1)
      if (option && to !== undefined) list.splice(to, 0, option)
      if (now.type !== 'quiz') return { options: list }
      const correct = now.correct.flatMap((index) => {
        const at = moved(index, from, to)
        return at === undefined ? [] : [at]
      })
      return { options: list, correct }
    })
  }
  const text = (index: number) => {
    const option = poll.options[index] ?? {}
    return option[lang] ?? option[design.languages.default] ?? ''
  }
  return (
    <FormSection title={quiz ? 'Quiz' : 'Poll'}>
      <Field label="Options" hint="Write each option in the bubble.">
        {(labelId) => (
          <ol aria-labelledby={labelId} className="grid gap-1">
            {poll.options.map((_, index) => (
              <li key={index} className="flex min-w-0 items-center gap-1">
                <span className="w-5 shrink-0 text-end text-footnote text-fg-3 tabular-nums">{index + 1}.</span>
                <span
                  dir="auto"
                  className={cn('min-w-0 flex-1 truncate text-callout', text(index) === '' && 'text-fg-3')}
                >
                  {text(index) || 'Empty'}
                </span>
                {quiz ? (
                  <RightAnswer
                    index={index}
                    checked={poll.correct.includes(index)}
                    onChange={(right) => {
                      set((now) =>
                        now.type === 'quiz'
                          ? {
                              correct: right
                                ? [...now.correct.filter((one) => one !== index), index].sort((a, b) => a - b)
                                : now.correct.filter((one) => one !== index),
                            }
                          : undefined,
                      )
                    }}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move option ${String(index + 1)} up`}
                  disabled={index === 0}
                  onClick={() => {
                    move(index, index - 1)
                  }}
                >
                  <ArrowUpIcon aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move option ${String(index + 1)} down`}
                  disabled={index === poll.options.length - 1}
                  onClick={() => {
                    move(index, index + 1)
                  }}
                >
                  <ArrowDownIcon aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove option ${String(index + 1)}`}
                  disabled={poll.options.length <= options.min}
                  onClick={() => {
                    move(index, undefined)
                  }}
                >
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Field>
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={poll.options.length >= options.max}
        onClick={() => {
          set((now) => ({ options: [...now.options, {}] }))
        }}
      >
        <PlusIcon aria-hidden data-icon="inline-start" />
        Add an option
      </Button>
      <SwitchRow
        label="Anonymous voting"
        checked={poll.anonymous}
        onChange={(anonymous) => {
          set(() => ({ anonymous }))
        }}
      />
      <SwitchRow
        label="Multiple answers"
        checked={poll.multiple}
        onChange={(multiple) => {
          set(() => ({ multiple }))
        }}
      />
      <SwitchRow
        label="Users can change their vote"
        checked={poll.revote ?? !quiz}
        onChange={(revote) => {
          // Telegram's default (polls yes, quizzes no) is left out.
          set(() => ({ revote: revote === !quiz ? undefined : revote }))
        }}
      />
      <SwitchRow
        label="Shuffle the options"
        checked={poll.shuffle === true}
        onChange={(shuffle) => {
          set(() => ({ shuffle: shuffle ? true : undefined }))
        }}
      />
      {poll.type === 'poll' ? (
        <SwitchRow
          label="Users can add options"
          checked={poll.addOptions === true}
          onChange={(addOptions) => {
            set(() => ({ addOptions: addOptions ? true : undefined }))
          }}
        />
      ) : null}
      <SwitchRow
        label="Hide the results until the poll closes"
        checked={poll.hideResults === true}
        onChange={(hideResults) => {
          set(() => ({ hideResults: hideResults ? true : undefined }))
        }}
      />
      <Field label="Close after (seconds)" hint="Empty: the poll stays open.">
        {(labelId) => (
          <OptionalNumber
            aria-labelledby={labelId}
            value={poll.closeAfterSec}
            min={openPeriod.min}
            max={openPeriod.max}
            whole
            onCommit={(closeAfterSec) => {
              set(() => ({ closeAfterSec }))
            }}
          />
        )}
      </Field>
      {poll.type === 'quiz' ? (
        <Field label="Explanation" hint="Shown to people who answer wrong.">
          {() =>
            poll.explanation ? (
              <div className="grid gap-2">
                <BubbleText text={poll.explanation} />
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => {
                    set(() => ({ explanation: undefined }))
                  }}
                >
                  Remove the explanation
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => {
                  set(() => ({ explanation: { id: newId(), doc: {} } }))
                }}
              >
                Add an explanation
              </Button>
            )
          }
        </Field>
      ) : null}
      <Field
        label="Save the vote as"
        hint={
          poll.anonymous
            ? 'An anonymous poll does not tell the bot who voted.'
            : quiz
              ? 'Yes when the answer is right, else no.'
              : "The chosen option's text in the default language."
        }
      >
        {() => (
          <VariablePicker
            label="Save the vote as"
            value={poll.saveTo}
            type={quiz ? 'yesNo' : 'text'}
            source="question"
            onChange={(saveTo) => {
              set(() => ({ saveTo }))
            }}
          />
        )}
      </Field>
    </FormSection>
  )
}

function RightAnswer({
  index,
  checked,
  onChange,
}: {
  index: number
  checked: boolean
  onChange: (right: boolean) => void
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex shrink-0 items-center gap-1 text-footnote text-fg-2">
      <Checkbox
        id={id}
        aria-label={`Option ${String(index + 1)} is a right answer`}
        checked={checked}
        onCheckedChange={(next) => {
          onChange(next)
        }}
      />
      Right
    </label>
  )
}

/**
 * A rich text in a bubble of the phone's look, written in place with TXT-01's editor: a quiz's
 * explanation, a rich message's block (RICH-01).
 */
export function BubbleText({ text }: { text: RichTextRef }) {
  const design = useDesign()
  const lang = useLang()
  const [look] = useLook()
  const message = useMemo(() => ({ content: { type: 'text' as const, text }, keyboard: null }), [text])
  const slots = useMemo(
    () => ({
      text: (shown: ReactNode) => createElement(PhoneText, { key: text.id, textId: text.id, doc: text.doc, shown }),
    }),
    [text],
  )
  return (
    <TelegramMessage
      message={message}
      design={design}
      lang={lang}
      skin={look.skin}
      theme={look.theme}
      maxWidth={320}
      slots={slots}
    />
  )
}
