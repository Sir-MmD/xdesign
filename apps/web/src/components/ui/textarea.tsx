import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  // dir="auto": text typed in Persian runs right to left; a `dir` prop overrides it (UI-27).
  // The look of the text field (input.tsx, the mockups' .x-textarea), in the body style.
  return (
    <textarea
      dir="auto"
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-control bg-surface px-3 py-2 text-body text-foreground transition-[border-color,box-shadow] duration-(--dur-fast) ease-(--ease) outline-none placeholder:text-fg-3 read-only:bg-surface-2 hover:border-fg-3 focus-visible:border-focus focus-visible:shadow-[0_0_0_1px_var(--focus),0_0_0_4px_var(--focus-halo)] disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-surface-2 disabled:text-fg-3 aria-invalid:border-error aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--error),0_0_0_4px_var(--error-weak)]',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
