// The pieces the logic forms are made of (docs/plan/04 section 6): a section with its heading, a
// labeled field, the step's title, the step an arrow goes to, a note's or a section's color and
// a number that may be left empty. Read-only, a section's fields are off (its fieldset, and the
// design system's own controls through ViewOnlyContext).
import type { Step, StepId, Target } from '@xdesign/spec'
import { type ComponentProps, type ReactNode, useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useDesign, useEditor } from '../context'
import { MAP_COLORS } from '../map/colors'
import { type Item, targetSteps } from './logic'

/**
 * A part of a form under its heading (none for the first part of a form), with buttons beside
 * the heading (`actions`, left out while read-only).
 */
export function FormSection({
  title,
  actions,
  children,
}: {
  title?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { readOnly } = useEditor()
  const headingId = useId()
  return (
    <section
      aria-labelledby={title === undefined ? undefined : headingId}
      className="border-t px-4 py-4 first:border-t-0"
    >
      {title === undefined ? null : (
        <div className="mb-3 flex min-h-(--control-h-sm) items-center gap-1">
          <h2 id={headingId} dir="auto" className="min-w-0 flex-1 truncate text-callout font-semibold">
            {title}
          </h2>
          {readOnly ? null : actions}
        </div>
      )}
      <fieldset disabled={readOnly} className="grid min-w-0 gap-4">
        {children}
      </fieldset>
    </section>
  )
}

/**
 * A field with its label (and a line under it): the control gets the label's ID for its
 * `aria-labelledby`.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (labelId: string) => ReactNode
}) {
  const labelId = useId()
  return (
    <div className="grid min-w-0 gap-2">
      <p id={labelId} className="text-subhead font-semibold text-fg-2">
        {label}
      </p>
      {hint === undefined ? null : <p className="-mt-1.5 text-footnote text-fg-3">{hint}</p>}
      {children(labelId)}
    </div>
  )
}

/** The step's title, on its box on the map; the ID name follows it until it is fixed. */
export function TitleField({ step }: { step: Step }) {
  const { edits } = useEditor()
  const id = useId()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Title</Label>
      <Input
        id={id}
        value={step.title}
        onChange={(event) => {
          edits.steps.setTitle(step.id, event.target.value)
        }}
      />
    </div>
  )
}

/**
 * The step an arrow of `from` goes to, by title: "None", or any step that takes arrows but `from`
 * itself; `back` shows only while it is the target (the map draws no arrow for it).
 */
export function TargetSelect({
  from,
  value,
  onChange,
  ...label
}: {
  from: Step
  value: Target | undefined
  onChange: (target: StepId | undefined) => void
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  const design = useDesign()
  const steps = targetSteps(design.steps, from)
  const items: Item[] = [
    { value: 'none', label: 'None' },
    ...(value === 'back' ? [{ value: 'back', label: 'Back to the message the user came from' }] : []),
    ...steps.map((step) => ({ value: step.id, label: step.title || step.idName })),
  ]
  return (
    <Select<string>
      items={items}
      value={value ?? 'none'}
      onValueChange={(next) => {
        if (next === null || next === 'back' || next === value) return
        onChange(next === 'none' ? undefined : next)
      }}
    >
      <SelectTrigger size="sm" className="w-full" {...label}>
        <SelectValue />
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

const colorNames = Object.keys(MAP_COLORS) as (keyof typeof MAP_COLORS)[]

/** A note's or a section's color: the map's palette (map/colors.ts). */
export function ColorField({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <Field label="Color">
      {(labelId) => (
        <ToggleGroup
          aria-labelledby={labelId}
          className="flex-wrap"
          value={[value]}
          onValueChange={([color]) => {
            if (color !== undefined && color !== value) onChange(color)
          }}
        >
          {colorNames.map((name) => (
            <ToggleGroupItem
              key={name}
              value={name}
              aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
              title={name.charAt(0).toUpperCase() + name.slice(1)}
              className="rounded-full px-0"
            >
              <span aria-hidden className="size-5 rounded-full" style={{ backgroundColor: MAP_COLORS[name] }} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </Field>
  )
}

/**
 * A number that may be left empty (no check, no limit): while it is typed the field keeps the
 * text, each text that reads as a number in range goes into the design at once, an empty field
 * clears it; leaving the field shows the design's number again.
 */
export function OptionalNumber({
  value,
  onCommit,
  min,
  max = Number.MAX_SAFE_INTEGER,
  whole = false,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'min' | 'max'> & {
  value: number | undefined
  onCommit: (value: number | undefined) => void
  min: number
  max?: number
  /** Whole numbers only. */
  whole?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const read = (text: string): number | undefined | null => {
    if (text.trim() === '') return undefined
    const number = Number(text.trim().replace(',', '.'))
    if (!Number.isFinite(number) || number < min || number > max) return null
    return whole && !Number.isInteger(number) ? null : number
  }
  return (
    <Input
      {...props}
      inputMode={whole ? 'numeric' : 'decimal'}
      dir="ltr"
      value={draft ?? (value === undefined ? '' : String(value))}
      aria-invalid={draft !== null && read(draft) === null}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const number = read(text)
        if (number !== null && number !== value) onCommit(number)
      }}
      onBlur={() => {
        setDraft(null)
      }}
    />
  )
}
