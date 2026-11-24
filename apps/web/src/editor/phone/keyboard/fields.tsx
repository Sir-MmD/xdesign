// The pieces of the button popover and the keyboard's "More" (docs/plan/04 section 5.3): a labeled
// row, a plain text per language, a choice of a few, a switch, the step a button goes to and the
// variable it saves to (with "+ New variable", named in LOGIC-01's NewName). They draw in the
// page, outside the phone.
import type { LangText, VariableSource, VariableType } from '@xdesign/spec'
import { type ReactNode, type Ref, useState } from 'react'

import { LanguageFlag } from '@/components/LanguagePicker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { findLanguage, languageName } from '@/lib/languages'

import { useDesign, useEditor } from '../../context'
import { NewName } from '../../forms/VariableSelect'
import { takesArrows } from '../../map/arrows'

// Choices that are not an ID (IDs are letters, digits, `_` and `-`).
const NONE = ':none'
const NEW = ':new'

/** A part of a form: its name over its fields. */
export function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-footnote font-semibold text-fg-2">{label}</span>
      {children}
    </div>
  )
}

/**
 * A plain text in every language of the design, one field each (the language's flag and code
 * before it when there are several); a language without its text shows the default one greyed.
 */
export function LangInputs({
  label,
  value,
  onChange,
  firstRef,
}: {
  label: string
  value: LangText
  onChange: (lang: string, text: string) => void
  /** The first field, for the popover's first focus. */
  firstRef?: Ref<HTMLInputElement>
}) {
  const design = useDesign()
  const { list, default: fallback } = design.languages
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((lang, index) => (
        <div key={lang} className="flex items-center gap-2">
          {list.length > 1 ? (
            <span
              className="flex w-14 shrink-0 items-center gap-1 font-mono text-caption text-fg-3 uppercase"
              title={languageName(lang)}
            >
              <LanguageFlag language={findLanguage(lang)} />
              {lang}
            </span>
          ) : null}
          <Input
            ref={index === 0 ? firstRef : undefined}
            dir="auto"
            aria-label={list.length > 1 ? `${label}, ${languageName(lang)}` : label}
            placeholder={lang === fallback ? undefined : value[fallback]}
            value={value[lang] ?? ''}
            onChange={(event) => {
              onChange(lang, event.target.value)
            }}
          />
        </div>
      ))}
    </div>
  )
}

/** One of a few choices side by side (the design system's segmented control). */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <ToggleGroup
      spacing={0}
      size="sm"
      aria-label={label}
      className="w-full"
      value={[value]}
      onValueChange={(next: unknown[]) => {
        const chosen = options.find((option) => option.value === next[0])
        if (chosen) onChange(chosen.value)
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** A switch with its words before it. */
export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-(--control-h-sm) items-center justify-between gap-3 text-callout">
      {label}
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={(on: boolean) => {
          onChange(on)
        }}
      />
    </label>
  )
}

/** A list to pick from (the design system's select), its items' words shown in the trigger. */
export function Pick({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select<string>
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next)
      }}
    >
      <SelectTrigger size="sm" aria-label={label} className="w-full min-w-0">
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
  )
}

/**
 * Where a button goes: the steps that take arrows in map order (left to right, then top to
 * bottom), with "Back" and "Stay here" where the button can use them; "Nowhere yet" clears it.
 */
export function TargetPicker({
  label,
  value,
  back,
  stay,
  onChange,
}: {
  label: string
  value: string | undefined
  back: boolean
  stay: boolean
  onChange: (target: string | undefined) => void
}) {
  const design = useDesign()
  const steps = Object.values(design.steps)
    .filter(takesArrows)
    .sort((a, b) => a.x - b.x || a.y - b.y)
  const items = [
    { value: NONE, label: 'Nowhere yet' },
    ...(back ? [{ value: 'back', label: 'Back' }] : []),
    ...(stay ? [{ value: 'stay', label: 'Stay here' }] : []),
    ...steps.map((step) => ({ value: step.id, label: step.title.trim() || step.idName })),
  ]
  return (
    <Pick
      label={label}
      value={value ?? NONE}
      items={items}
      onChange={(next) => {
        onChange(next === NONE ? undefined : next)
      }}
    />
  )
}

/**
 * The variable a button saves what the user shares to ("Save it as"): "None", the variables of
 * that type, and "+ New variable" (a variable set by a button, or by `source`: a poll's vote and
 * a dice's roll are saved like a question's answer, MSG-03).
 */
export function VariablePicker({
  label,
  value,
  type,
  source = 'button',
  onChange,
}: {
  label: string
  value: string | undefined
  type: VariableType
  source?: VariableSource
  onChange: (id: string | undefined) => void
}) {
  const design = useDesign()
  const { edits } = useEditor()
  const [naming, setNaming] = useState(false)
  const variables = Object.values(design.variables)
    .filter((variable) => variable.id === value || (variable.type === type && variable.source !== 'builtin'))
    .sort((a, b) => a.label.localeCompare(b.label))
  const items = [
    { value: NONE, label: 'None' },
    ...variables.map((variable) => ({ value: variable.id, label: `${variable.label} {${variable.idName}}` })),
    { value: NEW, label: '+ New variable' },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <Pick
        label={label}
        value={value ?? NONE}
        items={items}
        onChange={(next) => {
          if (next === NEW) setNaming(true)
          else onChange(next === NONE ? undefined : next)
        }}
      />
      {naming ? (
        <NewName
          placeholder="Name"
          onAdd={(name) => {
            setNaming(false)
            onChange(edits.variables.add({ label: name, type, source }))
          }}
          onCancel={() => {
            setNaming(false)
          }}
        />
      ) : null}
    </div>
  )
}
