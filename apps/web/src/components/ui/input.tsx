import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from '@/lib/utils'

/*
 * A text field of the design system (17 section 4.6, the mockups' .x-input): --control-h high (36 px, 44 on phones,
 * docs/plan/35-owner-list-2026-11-04.md section 12.2), radius 8, the 3:1 control border, the body style (16 px on
 * phones, so iOS does not zoom in), on focus the --focus border with a 1 px ring and a 4 px halo, the error colors
 * while invalid.
 */
const inputClasses =
  'h-(--control-h) w-full min-w-0 rounded-md border border-control bg-surface px-3 py-1 text-body text-foreground transition-[border-color,box-shadow] duration-(--dur-fast) ease-(--ease) outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-callout file:font-medium file:text-foreground placeholder:text-fg-3 hover:border-fg-3 focus-visible:border-focus focus-visible:shadow-[0_0_0_1px_var(--focus),0_0_0_4px_var(--focus-halo)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-surface-2 disabled:text-fg-3 read-only:bg-surface-2 aria-invalid:border-error aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--error),0_0_0_4px_var(--error-weak)]'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  // dir="auto": a name, keyword or instruction typed in Persian runs right to left, a link or
  // number left to right; a `dir` prop overrides it (UI-27).
  return <InputPrimitive type={type} dir="auto" data-slot="input" className={cn(inputClasses, className)} {...props} />
}

export { Input }
