import { CircleAlertIcon } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'

import { Alert, AlertTitle } from '@/components/ui/alert'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * A text field of a form: the label above the input, an optional help line and the field's
 * error under it (the design system's Field). Spread react-hook-form's `register(name)` into it.
 */
export function TextField({
  label,
  error,
  description,
  ...input
}: ComponentProps<'input'> & {
  label: string
  /** The field's problem, from the form's schema or the server. */
  error?: string | undefined
  description?: ReactNode
}) {
  const id = useId()
  const invalid = error !== undefined
  const described = [description === undefined ? null : `${id}-description`, invalid ? `${id}-error` : null]
    .filter((part) => part !== null)
    .join(' ')
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={invalid || undefined} aria-describedby={described || undefined} {...input} />
      {description === undefined ? null : <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  )
}

/** A form's problem from the server ("Username or password is wrong."), above its button. */
export function FormProblem({ message }: { message: string | undefined }) {
  if (message === undefined) return null
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertTitle className="font-semibold">{message}</AlertTitle>
    </Alert>
  )
}
