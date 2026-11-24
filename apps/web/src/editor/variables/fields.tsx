// The fields the Variables and Test switches panels share (docs/plan/04 section 11): a text field
// written at each change, the ID name with its rule, and the steps that set or use an item, each a
// button that jumps to it.
import { isIdName, type Step } from '@xdesign/spec'
import { type ComponentProps, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { useDraft } from '../useDraft'

/** A labeled text field written through an accessor at each change (useDraft.ts). */
export function LiveField({
  label,
  value,
  onValue,
  multiline = false,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'onFocus' | 'onBlur'> & {
  label: string
  value: string
  onValue: (value: string) => void
  multiline?: boolean
}) {
  const id = useId()
  const draft = useDraft(value)
  const field = {
    id,
    value: draft.value,
    onFocus: draft.onFocus,
    onBlur: draft.onBlur,
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          {...field}
          placeholder={props.placeholder}
          className="min-h-16"
          onChange={(event) => {
            draft.set(event.target.value)
            onValue(event.target.value)
          }}
        />
      ) : (
        <Input
          {...props}
          {...field}
          onChange={(event) => {
            draft.set(event.target.value)
            onValue(event.target.value)
          }}
        />
      )}
    </Field>
  )
}

/**
 * The ID name (03 section 4): written at each change while it is a valid name no other item has;
 * otherwise the field says why and the design keeps the last good one.
 */
export function IdNameField({ value, onSet }: { value: string; onSet: (name: string) => boolean }) {
  const id = useId()
  const draft = useDraft(value)
  const [problem, setProblem] = useState<string>()
  return (
    <Field data-invalid={problem === undefined ? undefined : true}>
      <FieldLabel htmlFor={id}>ID name</FieldLabel>
      <Input
        id={id}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        aria-invalid={problem === undefined ? undefined : true}
        aria-describedby={problem === undefined ? undefined : `${id}-error`}
        value={draft.value}
        onFocus={draft.onFocus}
        onBlur={() => {
          draft.onBlur()
          setProblem(undefined)
        }}
        onChange={(event) => {
          const name = event.target.value
          draft.set(name)
          if (!isIdName(name)) setProblem('Use a to z, 0 to 9 and _, starting with a letter.')
          else if (name === value || onSet(name)) setProblem(undefined)
          else setProblem('This ID name is taken.')
        }}
      />
      <FieldError id={`${id}-error`}>{problem}</FieldError>
    </Field>
  )
}

/** "Set in" or "Used in": the steps in map order, each a button that jumps to it on the map. */
export function StepPlaces({
  label,
  steps,
  onJump,
}: {
  label: string
  steps: readonly Step[] | undefined
  onJump: (step: Step) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-footnote text-fg-3">{label}</span>
      {steps && steps.length > 0 ? (
        steps.map((step) => (
          <Button
            key={step.id}
            variant="outline"
            size="xs"
            dir="auto"
            onClick={() => {
              onJump(step)
            }}
          >
            {step.title.trim() || step.idName}
          </Button>
        ))
      ) : (
        <span className="text-footnote text-fg-3">Nowhere yet</span>
      )}
    </div>
  )
}
