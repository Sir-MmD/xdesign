import type { LangText, PlainTextAt } from '@xdesign/spec'
import { type ReactNode, useId } from 'react'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { useDesign, useEditor, useLang } from '../../context'
import { inLanguage } from './rules'

/** "12 / 64", red over the limit. */
function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn('font-normal tabular-nums', length > max ? 'text-error' : 'text-fg-3')}>
      {length} / {max}
    </span>
  )
}

/**
 * A plain text per language (the bot's name, about and description, a command's menu text, an
 * invoice's texts) in the language shown, with its counter against Telegram's limit (none without
 * `max`); another language's field shows the default language's text as its placeholder. Each
 * letter goes into the design at once.
 */
export function PlainTextField({
  at,
  text,
  label,
  max,
  description,
  multiline = false,
}: {
  at: PlainTextAt
  text: LangText
  label: string
  max?: number
  description?: ReactNode
  multiline?: boolean
}) {
  const design = useDesign()
  const lang = useLang()
  const { edits } = useEditor()
  const id = useId()
  const value = text[lang] ?? ''
  const fallback = lang === design.languages.default ? undefined : text[design.languages.default]
  const control = {
    id,
    dir: 'auto',
    value,
    placeholder: fallback,
    'aria-invalid': (max !== undefined && value.length > max) || undefined,
    'aria-describedby': description === undefined ? undefined : `${id}-description`,
    onChange: (event: { target: { value: string } }) => {
      edits.texts.setPlain(at, lang, event.target.value)
    },
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{inLanguage(label, design, lang)}</FieldLabel>
      <InputGroup>
        {multiline ? <InputGroupTextarea rows={4} {...control} /> : <InputGroupInput {...control} />}
        {max === undefined ? null : (
          <InputGroupAddon align={multiline ? 'block-end' : 'inline-end'} className={cn(multiline && 'justify-end')}>
            <Counter length={value.length} max={max} />
          </InputGroupAddon>
        )}
      </InputGroup>
      {description === undefined ? null : <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
    </Field>
  )
}

/** A text typed after a fixed start ("/" before a command), with the rule it follows under it. */
export function PrefixedField({
  label,
  prefix,
  value,
  onChange,
  rule,
  valid,
  problem,
  placeholder,
  autoFocus,
}: {
  label: string
  prefix: string
  value: string
  onChange: (value: string) => void
  rule: string
  valid: boolean
  /** Another problem than the rule's, under it ("Another start point has the command /help."). */
  problem?: string | undefined
  placeholder?: string
  autoFocus?: boolean
}) {
  const id = useId()
  const invalid = (value !== '' && !valid) || problem !== undefined
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>{prefix}</InputGroupAddon>
        <InputGroupInput
          id={id}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          autoFocus={autoFocus}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-rule`}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
      </InputGroup>
      <FieldDescription id={`${id}-rule`} className={cn(value !== '' && !valid && 'text-error')}>
        {rule}
      </FieldDescription>
      {problem === undefined ? null : <p className="text-footnote text-error">{problem}</p>}
    </Field>
  )
}

/** A switch with its words after it. */
export function SwitchRow({
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
