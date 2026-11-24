import type { Value } from '@xdesign/spec'
import { type ComponentProps, useState } from 'react'

import { Input } from '@/components/ui/input'

import { useDesign } from '../context'
import { readValue, type ValueKind, valueText } from './values'

/**
 * A value typed as text (values.ts): a number, yes or no, a text, or `{name}` for a variable.
 * While it is typed the field keeps the text and each reading goes into the design at once; a
 * number field that holds no number is marked and changes nothing. Leaving the field shows the
 * design's value again.
 */
export function ValueInput({
  value,
  kind,
  onCommit,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: Value | undefined
  kind: ValueKind
  onCommit: (value: Value | undefined) => void
}) {
  const design = useDesign()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      {...props}
      inputMode={kind === 'number' ? 'decimal' : undefined}
      value={draft ?? valueText(value, design)}
      aria-invalid={draft !== null && readValue(draft, design, kind) === null}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const next = readValue(text, design, kind)
        if (next !== null) onCommit(next)
      }}
      onBlur={() => {
        setDraft(null)
      }}
    />
  )
}
