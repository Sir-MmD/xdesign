'use client'

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { useViewOnly } from '@/components/viewOnly'
import { cn } from '@/lib/utils'
import { CheckIcon, MinusIcon } from 'lucide-react'

/*
 * The design system's checkbox (17 section 4.6, the mockups' .x-check): 18 px (22 on phones,
 * with a 44 px hit area; docs/plan/35-owner-list-2026-11-04.md section 12.2), a 1.5 px control
 * border (3:1), radius 5; checked in the brand fill with the mark in --on-brand. It gives a
 * little while pressed, on the quick spring (only under On). The border stays visible in
 * forced colors (4.8).
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  const viewOnly = useViewOnly()
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer group/checkbox relative flex size-[18px] shrink-0 touch-manipulation items-center justify-center rounded-[5px] border-[1.5px] border-control bg-surface text-on-brand transition-[background-color,border-color,scale] duration-(--dur-fast) ease-(--ease) outline-none [-webkit-tap-highlight-color:transparent] group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid aria-invalid:border-error data-indeterminate:border-brand-strong data-indeterminate:bg-brand-strong motion-safe:active:scale-90 max-[760px]:size-[22px] max-[760px]:rounded-[6px] max-[760px]:after:-inset-[11px] data-checked:border-brand-strong data-checked:bg-brand-strong data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
      {...(viewOnly ? { disabled: true } : {})}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5 [&>svg]:stroke-[3] max-[760px]:[&>svg]:size-4"
      >
        {/* A dash while some rows are selected (indeterminate), a check once checked. */}
        <CheckIcon className="group-data-indeterminate/checkbox:hidden" />
        <MinusIcon className="hidden group-data-indeterminate/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
