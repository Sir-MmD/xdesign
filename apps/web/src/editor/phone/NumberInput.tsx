import { type ComponentProps, useState } from 'react'

import { Input } from '@/components/ui/input'

/**
 * A number typed in a text field: while it is being typed the field keeps the text ("-", "35."),
 * and each text that reads as a number in range goes into the design at once; leaving the field
 * shows the design's number again.
 */
export function NumberInput({
  value,
  onCommit,
  min,
  max,
  whole = false,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'min' | 'max'> & {
  value: number
  onCommit: (value: number) => void
  min: number
  max: number
  /** Whole numbers only. */
  whole?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const read = (text: string): number | undefined => {
    const number = Number(text.trim().replace(',', '.'))
    if (text.trim() === '' || !Number.isFinite(number) || number < min || number > max) return undefined
    return whole && !Number.isInteger(number) ? undefined : number
  }
  return (
    <Input
      {...props}
      inputMode={whole ? 'numeric' : 'decimal'}
      dir="ltr"
      value={draft ?? String(value)}
      aria-invalid={draft !== null && read(draft) === undefined}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const number = read(text)
        if (number !== undefined && number !== value) onCommit(number)
      }}
      onBlur={() => {
        setDraft(null)
      }}
    />
  )
}
