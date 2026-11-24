import * as React from 'react'
import { cn } from '@/lib/utils'

/*
 * A field label of the design system (17 section 4.6, the mockups' .x-label): the subhead
 * style, semibold in the second ink, above its control. A label that follows a checkbox or a
 * switch is that control's text instead (.x-check): the body style in the first ink
 * (docs/plan/35-owner-list-2026-11-04.md section 12.2).
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-subhead font-semibold text-fg-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-[disabled]:cursor-not-allowed peer-data-[disabled]:opacity-50 [[data-slot=checkbox]~&]:text-body [[data-slot=checkbox]~&]:font-normal [[data-slot=checkbox]~&]:text-foreground [[data-slot=switch]~&]:text-body [[data-slot=switch]~&]:font-normal [[data-slot=switch]~&]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
