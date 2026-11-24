import { EyeIcon, EyeOffIcon, ShuffleIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { CopyButton } from '@/components/CopyButton'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'

// "Generate": 20 of a-z, A-Z and 0-9 from the browser's crypto.getRandomValues.
const passwordChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const passwordLength = 20

function randomPassword(): string {
  let password = ''
  while (password.length < passwordLength) {
    for (const byte of crypto.getRandomValues(new Uint8Array(passwordLength))) {
      // Bytes from 248 (4 times 62) up are skipped, so every character is as likely.
      if (byte < 248 && password.length < passwordLength) password += passwordChars.charAt(byte % passwordChars.length)
    }
  }
  return password
}

/**
 * The password the site owner gives a member (USER-02, docs/plan/18 section 3.4), in "Add member"
 * and "Set password": the field with the eye to show or hide it and "Generate", which fills a new
 * random password and shows it, then "Copy".
 */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  /** The field's problem, from the form's schema. */
  error?: string | undefined
  disabled?: boolean
}) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const invalid = error !== undefined
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <InputGroup>
          <InputGroupInput
            id={id}
            type={shown ? 'text' : 'password'}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            value={value}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(event) => {
              onChange(event.target.value)
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="Show the password"
              aria-pressed={shown}
              disabled={disabled}
              onClick={() => {
                setShown(!shown)
              }}
            >
              {shown ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
            </InputGroupButton>
            <InputGroupButton
              disabled={disabled}
              onClick={() => {
                onChange(randomPassword())
                setShown(true)
              }}
            >
              <ShuffleIcon aria-hidden />
              Generate
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <CopyButton value={value} showLabel disabled={disabled === true || value === ''} />
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  )
}
